// Runnable self-check for the JSON timetable parser. No framework.
//   node scripts/parseTimetableJson.check.ts
import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { parseTimetableJson } from "../src/lib/parseTimetableJson.ts";
import { offeredTo, programmeOf } from "../src/lib/types.ts";

assert.equal(programmeOf("ENF21"), "ENF2YR");
assert.equal(programmeOf("CSD310"), "CSD3YR");
assert.equal(programmeOf("ENF2YR"), "", "programme codes are not block codes");
assert.equal(programmeOf("OtherALLYR"), "");

// shared rows merge on rowid, blocks join the batch list, trailing ";" survives
const sample = JSON.stringify({
	BIO: {
		BIO1YR: [
			{ code: "CHY111", title: "Chemical Principles", type: "Major", uwe: "Yes", comp: "LEC",
			  sec: "LEC1", block: "", term: "Full semester", day: "Tue", start: "09:35 AM",
			  end: "11:00 AM", room: "B016", inst: "Gole", cap: "120", note: "", rowid: 197 },
		],
	},
	CSD: {
		CSD2YR: [
			{ code: "CHY111", title: "Chemical Principles", type: "Major", uwe: "Yes", comp: "LEC",
			  sec: "LEC1", block: "", term: "Full semester", day: "Tue", start: "09:35 AM",
			  end: "11:00 AM", room: "B016", inst: "Gole", cap: "120", note: "", rowid: 197 },
			{ code: "CSD201", title: "Data Structures", type: "Major", uwe: "No", comp: "PRAC",
			  sec: "PRAC2", block: "CSD21, CSD22", term: "First half", day: "Fri", start: "01:00 PM",
			  end: "02:55 PM", room: "A101", inst: "Someone", cap: "30", note: "", rowid: 401 },
		],
	},
}) + ";";

const parsed = parseTimetableJson(sample);
assert.equal(parsed.length, 2, "rows sharing a rowid collapse into one course");

const chy = parsed.find((c) => c.courseCode === "CHY111-LEC1")!;
assert.equal(chy.major, "BIO1YR, CSD2YR");
assert.equal(chy.openAsUWE, true);
assert.equal(chy.day, "Tue");
assert.equal(chy.startTime, "9:35 AM", "dump times are normalised to the sheet's clock shape");
assert.equal(chy.term, "Full semester");

const csd = parsed.find((c) => c.courseCode === "CSD201-PRAC2")!;
assert.equal(csd.major, "CSD2YR, CSD21, CSD22", "student blocks join the batch list");
assert.equal(csd.openAsUWE, false);
assert.equal(csd.component, "PRAC");
assert.equal(csd.slot, "PRAC2");

// a slot listed once per half is one class, with both halves' faculty
const halved = parseTimetableJson(
	JSON.stringify({
		Other: {
			OtherALLYR: [
				{ code: "CCC634", title: "X", type: "CCC", uwe: "No", comp: "LEC", sec: "LEC1",
				  block: "", term: "First half", day: "Mon", start: "11:15 AM", end: "12:45 PM",
				  room: "B012", inst: "Nitin Kumar", cap: "30", note: "", rowid: 1 },
				{ code: "CCC634", title: "X", type: "CCC", uwe: "No", comp: "LEC", sec: "LEC1",
				  block: "", term: "Second half", day: "Mon", start: "11:15 AM", end: "12:45 PM",
				  room: "B012", inst: "Suchi Kumari", cap: "30", note: "", rowid: 2 },
				// only one half offered — stays a half-semester course
				{ code: "CCC700", title: "Y", type: "CCC", uwe: "No", comp: "LEC", sec: "LEC1",
				  block: "", term: "First half", day: "Tue", start: "09:00 AM", end: "10:30 AM",
				  room: "B013", inst: "Someone", cap: "30", note: "", rowid: 3 },
			],
		},
	}),
);
assert.equal(halved.length, 2, "both halves of one slot collapse into one class");
assert.equal(halved[0].term, "Full semester");
assert.equal(halved[0].faculty, "Nitin Kumar, Suchi Kumari");
assert.equal(halved[1].term, "First half", "a lone half is left alone");
assert.deepEqual(
	halved.map((c) => c.sno),
	[1, 2],
	"sno stays contiguous after merging",
);

// The rest only runs when a scraped dump is checked in; the synthetic cases
// above are what guard the parser itself.
const DUMP = "src/lib/data/tt.json";
if (!existsSync(DUMP)) {
	console.log("ok — synthetic cases pass (no src/lib/data/tt.json to check against)");
	process.exit(0);
}

const real = parseTimetableJson(readFileSync(DUMP, "utf8"));
assert.ok(real.length > 1000, `too few rows: ${real.length}`);

const slots = real.map((c) => [c.courseCode, c.day, c.startTime, c.room].join("|"));
assert.equal(new Set(slots).size, slots.length, "no course meets itself twice in a slot");
assert.ok(real.every((c) => c.courseCode && c.day && c.startTime && c.endTime));
assert.ok(real.some((c) => c.major.includes(",")), "shared courses list several batches");

// times come out as clock strings in the same shape the sheet parser emits
assert.ok(
	real.every((c) => !c.startTime || /^\d{1,2}:\d{2}\s(AM|PM)$/.test(c.startTime)),
	"start times are not normalised clock strings",
);

// A course split into per-block lectures reaches a block with its own lecture
// and the shared tutorial, never the other block's lecture.
{
	const split = real.find((c) => c.blocks && c.blocks.includes(","));
	assert.ok(split, "expected at least one row split across student blocks");
	const block = split!.blocks!.split(",")[0].trim();
	assert.ok(offeredTo(split!, [block]), "a row does not reach its own block");
	assert.ok(!offeredTo(split!, ["ZZZ9YR"]), "a row leaked to an unrelated programme");
}

// UWEs and CCCs are repeated under every programme in the dump; they must not
// land in anyone's batch timetable, only in search.
{
	const batch = real.find((c) => c.major && !c.major.includes(","))!.major;
	const mine = real.filter((c) => offeredTo(c, [batch]));
	assert.ok(mine.length > 0, `${batch} still has a timetable`);
	assert.deepEqual(
		mine.filter((c) => c.courseType === "UWE" || c.courseType === "CCC").map((c) => c.courseCode),
		[],
		"no UWE/CCC in a batch timetable",
	);
	assert.ok(
		real.some((c) => c.courseType === "UWE") && real.some((c) => c.courseType === "CCC"),
		"they are still in the list, addable by search",
	);
}

console.log(`ok — ${real.length} rows from tt.json`);
