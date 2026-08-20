// Teaching days left in the semester.
// The per-weekday totals are the instructional days the academic calendar
// actually holds (they differ because of holidays), so they're a given, not
// something we can count off a calendar. What we do count is how many of each
// weekday have already gone by since the semester started.
// ponytail: update these two constants each semester — a calendar-file parser
// would be a lot of code for six numbers and a date.

export const SEM_START = "2026-08-17"; // Monday

/** keyed by Date#getDay(): 1 = Monday … 6 = Saturday */
export const TEACHING_DAYS: Record<number, number> = { 1: 13, 2: 13, 3: 14, 4: 14, 5: 13, 6: 12 };

export const DAY_NAMES: Record<number, string> = {
	1: "Mon",
	2: "Tue",
	3: "Wed",
	4: "Thu",
	5: "Fri",
	6: "Sat"
};

export const WEEKDAYS = [1, 2, 3, 4, 5, 6];

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function parseDay(iso: string) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d); // local, so "today" means the user's today
}

/**
 * Weekdays still to come, today included (a class today hasn't happened yet).
 * Days that have already passed are subtracted from the semester's totals.
 */
export function remainingDays(today = new Date(), start = SEM_START): Record<number, number> {
	const cursor = parseDay(start);
	const end = midnight(today);
	const out: Record<number, number> = {};
	for (const d of WEEKDAYS) out[d] = TEACHING_DAYS[d];

	while (cursor < end) {
		const day = cursor.getDay();
		if (out[day] > 0) out[day] -= 1;
		cursor.setDate(cursor.getDate() + 1);
	}
	return out;
}

export const totalDays = (days: Record<number, number>) =>
	WEEKDAYS.reduce((n, d) => n + (days[d] ?? 0), 0);
