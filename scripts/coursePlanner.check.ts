// Runnable self-check for the pure course-planner helpers. No framework.
//   node scripts/coursePlanner.check.ts
import assert from "node:assert";
import type { Course } from "../src/lib/types.ts";
import { parseDays, timeToMinutes, hasTimeConflict, expandBatchCodes } from "../src/lib/types.ts";
import {
	groupSections,
	sectionConflicts,
	findCombo,
	getDepartment,
	assignLanes,
} from "../src/lib/coursePlanner.ts";

// department bucketing
assert.equal(getDepartment("ECE101-LEC1"), "ECE");
assert.equal(getDepartment("ART210/AMP1001"), "ART");
assert.equal(getDepartment("BIO new code"), "BIO");
assert.equal(getDepartment("CCCNEW-LEC1"), "CCC", "long prefixes cap at 3");

let sno = 0;
const row = (
	code: string,
	component: string,
	day: string,
	startTime: string,
	endTime: string,
): Course => ({
	sno: ++sno,
	courseCode: `${code}-${component}`,
	courseName: code,
	credits: 3,
	faculty: "",
	slot: component,
	room: "",
	major: "",
	day,
	startTime,
	endTime,
	component,
});

// CS101: two lectures, two practicals, one lecture spans two rows
const cs = [
	row("CS101", "LEC1", "M", "9:00AM", "10:00AM"),
	row("CS101", "LEC1", "W", "9:00AM", "10:00AM"),
	row("CS101", "LEC2", "T", "9:00AM", "10:00AM"),
	row("CS101", "PRAC1", "M", "2:00PM", "4:00PM"),
	row("CS101", "PRAC2", "F", "2:00PM", "4:00PM"),
];

const groups = groupSections(cs);
assert.deepEqual(
	groups.map((g) => g.prefix),
	["LEC", "PRAC"],
);
assert.equal(groups[0].sections.length, 2);
assert.equal(groups[0].sections[0].rows.length, 2, "LEC1 keeps both meetings");

// Nothing else booked -> first of each group
assert.deepEqual(findCombo(groups, []), {
	LEC: "CS101-LEC1",
	PRAC: "CS101-PRAC1",
});

// Monday morning busy -> LEC1 (M+W) is out, LEC2 is picked
const monMorning = [row("MA101", "LEC1", "M", "9:00AM", "10:00AM")];
assert.equal(sectionConflicts(groups[0].sections[0].rows, monMorning).length, 1);
assert.equal(sectionConflicts(groups[0].sections[1].rows, monMorning).length, 0);
assert.deepEqual(findCombo(groups, monMorning), {
	LEC: "CS101-LEC2",
	PRAC: "CS101-PRAC1",
});

// Both lecture slots busy -> whole course cannot fit
const bothLectures = [
	row("MA101", "LEC1", "M", "9:00AM", "10:00AM"),
	row("PH101", "LEC1", "T", "9:00AM", "10:00AM"),
];
assert.equal(findCombo(groups, bothLectures), null);

// Locking LEC1 while Monday is busy also fails, even though LEC2 is free
assert.equal(findCombo(groups, monMorning, { LEC: "CS101-LEC1" }), null);

// A locked practical is honoured when it fits
assert.deepEqual(findCombo(groups, [], { PRAC: "CS101-PRAC2" }), {
	LEC: "CS101-LEC1",
	PRAC: "CS101-PRAC2",
});

// Cross-group clash: picking PRAC that collides with the only free LEC
const clashy = groupSections([
	row("EE101", "LEC1", "M", "9:00AM", "11:00AM"),
	row("EE101", "PRAC1", "M", "10:00AM", "12:00PM"),
	row("EE101", "PRAC2", "F", "10:00AM", "12:00PM"),
]);
assert.deepEqual(findCombo(clashy, []), {
	LEC: "EE101-LEC1",
	PRAC: "EE101-PRAC2",
});

// Monsoon 2026 sheet: 3-letter days and "01:00 PM" times
assert.deepEqual(parseDays("Mon"), ["Monday"]);
assert.deepEqual(parseDays("Tue"), ["Tuesday"]);
assert.deepEqual(parseDays("Wed"), ["Wednesday"]);
assert.deepEqual(parseDays("Thu"), ["Thursday"]);
assert.deepEqual(parseDays("Fri"), ["Friday"]);
assert.deepEqual(parseDays("Sat"), ["Saturday"]);
assert.equal(timeToMinutes("01:00 PM"), 13 * 60);
assert.equal(timeToMinutes("09:35 AM"), 9 * 60 + 35);

// Student Block codes, including the sheet's "X to Y" ranges
assert.deepEqual(expandBatchCodes("CSD21, CSD22"), ["CSD21", "CSD22"]);
assert.deepEqual(expandBatchCodes("CSD21,CSD22"), ["CSD21", "CSD22"]);
assert.deepEqual(expandBatchCodes("ECE29 to ECE215"), [
	"ECE29",
	"ECE210",
	"ECE211",
	"ECE212",
	"ECE213",
	"ECE214",
	"ECE215",
]);
assert.deepEqual(expandBatchCodes("CSD310 to CSD311"), ["CSD310", "CSD311"]);
assert.deepEqual(expandBatchCodes("BIO4YR"), ["BIO4YR"]);
assert.deepEqual(expandBatchCodes(""), []);

// Opposite half-semester courses share a slot without clashing
const half = (term: string): Course => ({
	...row("XX101", "LEC1", "Mon", "01:00 PM", "02:55 PM"),
	term,
});
assert.equal(hasTimeConflict(half("First half"), half("Second half")), false);
assert.equal(hasTimeConflict(half("First half"), half("First half")), true);
assert.equal(hasTimeConflict(half("Full semester"), half("Second half")), true);

// Overlapping calendar blocks get their own lane instead of stacking
const lane = (startMin: number, endMin: number) => ({
	startMin,
	endMin,
	col: 0,
	cols: 1,
});

// Two classes at the same time -> two lanes
const pair = [lane(540, 600), lane(540, 600)];
assignLanes(pair);
assert.deepEqual(
	pair.map((b) => [b.col, b.cols]),
	[
		[0, 2],
		[1, 2],
	],
);

// No overlap -> both full width, and the later one reuses lane 0
const apart = [lane(540, 600), lane(600, 660)];
assignLanes(apart);
assert.deepEqual(
	apart.map((b) => [b.col, b.cols]),
	[
		[0, 1],
		[0, 1],
	],
	"touching but not overlapping stays full width",
);

// A long block spanning two short ones. Shorter-ending blocks are laid out
// first, so the long one takes lane 1 and the two short ones share lane 0.
const chain = [lane(540, 720), lane(540, 600), lane(600, 660)];
assignLanes(chain);
assert.deepEqual(
	chain.map((b) => [b.col, b.cols]),
	[
		[1, 2],
		[0, 2],
		[0, 2],
	],
	"the second short block reuses the lane the first one freed",
);

// Independent clusters are sized separately, not by the busiest one
const two = [lane(540, 600), lane(540, 600), lane(700, 760)];
assignLanes(two);
assert.equal(two[2].cols, 1, "a later, non-overlapping block stays full width");

// Three-way clash
const triple = [lane(540, 660), lane(560, 620), lane(570, 700)];
assignLanes(triple);
assert.deepEqual(
	triple.map((b) => b.cols),
	[3, 3, 3],
);
assert.deepEqual(
	triple.map((b) => b.col).sort(),
	[0, 1, 2],
	"no two overlapping blocks share a lane",
);

console.log("coursePlanner: all checks passed");
