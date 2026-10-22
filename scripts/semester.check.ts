// Runnable self-check for the semester day counter. No framework.
//   node scripts/semester.check.ts
// The real calendar PDF is checked against its own printed totals in
// academicCalendar.check.ts; this one pins the rules on a hand-built calendar.
import assert from "node:assert";
import { semesterFrom, remainingDays, totalDays } from "../src/lib/semester.ts";
import type { CalendarDay } from "../src/lib/server/academicCalendar.ts";

const on = (iso: string) => {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
};

// Sun 2 Aug … Sat 22 Aug 2026, blank unless overridden
const marked: Record<string, Partial<CalendarDay>> = {
	"2026-08-01": { text: "Summer Last Teaching Day" }, // last term's, before the start
	"2026-08-03": { text: "Start of classes for all students" }, // Mon
	"2026-08-04": { text: "Raksha Bandhan", label: "Restricted Holidays", category: "holiday" }, // Tue: classes run
	"2026-08-05": { text: "Independence Day", label: "University Holidays", category: "holiday" }, // Wed: off
	"2026-08-06": { text: "Buffer day for class", category: "break" }, // Thu: uncoloured, classes run
	"2026-08-07": { text: "No class day", label: "No Class Day", category: "break" }, // Fri: off
	"2026-08-10": { text: "Mid Term Examinations", label: "Mid/End Term Examinations", category: "exam" }, // Mon: off
	"2026-08-17": { text: "Last Teaching Day as per Friday Sschedule" }, // Mon, runs Friday
	"2026-08-18": { text: "End Term Break/Buffer Day", category: "break" } // after the end
};
const calendar: CalendarDay[] = [];
for (let d = 1; d <= 22; d++) {
	const date = `2026-08-${String(d).padStart(2, "0")}`;
	const weekday = new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
	calendar.push({ date, weekday, text: "", label: "", category: "event", ...marked[date] });
}

const sem = semesterFrom(calendar);
assert.equal(sem.start, "2026-08-03");
assert.equal(sem.end, "2026-08-17");
assert.deepEqual(
	sem.days.map((d) => `${d.date}:${d.weekday}`),
	[
		"2026-08-03:1",
		"2026-08-04:2", // restricted holiday still teaches
		"2026-08-06:4", // uncoloured buffer day still teaches
		"2026-08-08:6",
		// Sunday 9th never counts; 5th, 7th and 10th are coloured off
		"2026-08-11:2",
		"2026-08-12:3",
		"2026-08-13:4",
		"2026-08-14:5",
		"2026-08-15:6",
		"2026-08-17:5" // Monday on Friday's timetable
	]
);

// day one: everything is still ahead
assert.deepEqual(remainingDays(sem, on("2026-08-03")), { 1: 1, 2: 2, 3: 1, 4: 2, 5: 2, 6: 2 });
// before the start, the same
assert.deepEqual(remainingDays(sem, on("2026-07-20")), remainingDays(sem, on("2026-08-03")));

// Wed 12th: today itself still counts, the days before it don't
assert.deepEqual(remainingDays(sem, on("2026-08-12")), { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 1 });

// Sundays are ignored entirely: Sunday 16th and Monday 17th see the same future
assert.deepEqual(remainingDays(sem, on("2026-08-16")), remainingDays(sem, on("2026-08-17")));

// nothing left, and nothing negative, once the semester is over
assert.equal(totalDays(remainingDays(sem, on("2026-08-18"))), 0);
assert.equal(totalDays(remainingDays(sem, on("2027-06-01"))), 0);

// a calendar it can't read the semester out of says so, rather than guessing
assert.throws(() => semesterFrom(calendar.filter((d) => !/start of classes/i.test(d.text))), /Start of classes/);
assert.throws(() => semesterFrom(calendar.filter((d) => d.date !== "2026-08-17")), /Last Teaching Day/);

console.log("semester.check.ts OK");
