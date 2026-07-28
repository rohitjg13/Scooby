// Runnable self-check for the pure course-planner helpers. No framework.
//   node scripts/coursePlanner.check.ts
import assert from "node:assert";
import type { Course } from "../src/lib/types.ts";
import {
	groupSections,
	sectionConflicts,
	findCombo,
	getDepartment,
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

console.log("coursePlanner: all checks passed");
