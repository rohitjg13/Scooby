// Runnable self-check for the semester day counter. No framework.
//   node scripts/semester.check.ts
import assert from "node:assert";
import { remainingDays, totalDays, TEACHING_DAYS, SEM_START } from "../src/lib/semester.ts";

const on = (iso: string) => {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
};

// day one: nothing has gone by yet
assert.deepEqual(remainingDays(on(SEM_START)), TEACHING_DAYS);
assert.equal(totalDays(remainingDays(on(SEM_START))), 13 + 13 + 14 + 14 + 13 + 12);

// Thu 20 Aug: Mon, Tue, Wed are done; Thursday itself still counts
const thu = remainingDays(on("2026-08-20"));
assert.equal(thu[1], 12);
assert.equal(thu[2], 12);
assert.equal(thu[3], 13);
assert.equal(thu[4], 14);
assert.equal(thu[6], 12);

// a full week later, one of each has gone
const week = remainingDays(on("2026-08-24"));
assert.equal(week[1], 12); // Monday the 24th hasn't happened yet
assert.equal(week[2], 12);
assert.equal(week[6], 11);

// Sundays are ignored entirely: Sunday 23rd and Monday 24th see the same past
assert.deepEqual(remainingDays(on("2026-08-23")), remainingDays(on("2026-08-24")));

// never goes negative, long after the semester ends
const over = remainingDays(on("2027-06-01"));
assert.equal(totalDays(over), 0);

// before the start date nothing is subtracted
assert.deepEqual(remainingDays(on("2026-08-01")), TEACHING_DAYS);

console.log("semester.check.ts OK");
