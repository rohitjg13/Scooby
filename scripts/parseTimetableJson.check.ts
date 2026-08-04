// Runnable self-check for the JSON timetable parser. No framework.
//   node scripts/parseTimetableJson.check.ts
import assert from "node:assert";
import { readFileSync } from "node:fs";
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
assert.equal(chy.startTime, "09:35 AM");
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

// ECO2101: two lectures split by block, one tutorial for the whole course.
// An ENF21 student gets LEC1 and the TUT, never ENF22's lecture.
{
	const eco = parseTimetableJson(readFileSync("src/lib/data/tt.json", "utf8")).filter((c) =>
		c.courseCode.startsWith("ECO2101"),
	);
	const forBatch = (batches: string[]) =>
		[...new Set(eco.filter((c) => offeredTo(c, batches)).map((c) => c.slot))].sort();

	assert.deepEqual(forBatch(["ENF21"]), ["LEC1", "TUT1"]);
	assert.deepEqual(forBatch(["ENF2YR", "ENF21"]), ["LEC1", "TUT1"]);
	assert.deepEqual(forBatch(["ENF22"]), ["LEC2", "TUT1"]);
	assert.deepEqual(forBatch(["ECO21"]), ["LEC1", "TUT1"]);
	// programme only, no block given: can't be placed, so show both lectures
	assert.deepEqual(forBatch(["ENF2YR"]), ["LEC1", "LEC2", "TUT1"]);
	assert.deepEqual(forBatch(["CSD2YR"]), []);
}

// the real dump
const real = parseTimetableJson(readFileSync("src/lib/data/tt.json", "utf8"));
assert.equal(real.length, 1175, "one row per class meeting, 16 half-pairs merged");
const slots = real.map((c) => [c.courseCode, c.day, c.startTime, c.room].join("|"));
assert.equal(new Set(slots).size, slots.length, "no course meets itself twice in a slot");
assert.ok(real.every((c) => c.courseCode && c.day && c.startTime && c.endTime));
assert.ok(real.some((c) => c.major.includes(",")), "shared courses list several batches");

console.log(`ok — ${real.length} rows from tt.json`);
