// Teaching days left in the semester, counted off the academic calendar PDF
// (see src/lib/server/academicCalendar.ts), so holidays, exam weeks and
// no-class days fall exactly where the calendar puts them. Nothing here is
// specific to one semester: a newer PDF in src/lib/data is the whole update.

import type { CalendarDay } from "./server/academicCalendar";

export type Semester = {
	/** ISO date classes start */
	start: string;
	/** ISO date of the last teaching day */
	end: string;
	/** every teaching date, with the weekday (1 = Mon … 6 = Sat) whose timetable runs */
	days: { date: string; weekday: number }[];
};

export const DAY_NAMES: Record<number, string> = {
	1: "Mon",
	2: "Tue",
	3: "Wed",
	4: "Thu",
	5: "Fri",
	6: "Sat"
};

export const WEEKDAYS = [1, 2, 3, 4, 5, 6];

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * The teaching dates in a parsed calendar. A day is off when the PDF colours
 * it in — university holidays, no-class days, exams — except restricted
 * holidays, which still have classes. The colour decides, not the text: an
 * uncoloured "Buffer day for class" is a teaching day.
 */
export function semesterFrom(calendar: CalendarDay[]): Semester {
	const start = calendar.find((d) => /start of classes/i.test(d.text))?.date;
	if (!start) throw new Error('no "Start of classes" entry in the academic calendar');
	// the latest one, since the calendar can also carry last summer's
	const end = calendar.filter((d) => d.date >= start && /last teaching day/i.test(d.text)).at(-1)?.date;
	if (!end) throw new Error('no "Last Teaching Day" entry after the start of classes');

	const days: Semester["days"] = [];
	for (const d of calendar) {
		if (d.date < start || d.date > end) continue;
		if (d.label && !/restricted/i.test(d.label)) continue;
		// "Last Teaching Day as per Tuesday schedule" runs Tuesday's classes
		const swap = /as per (\w+day)/i.exec(d.text);
		const weekday = swap
			? WEEKDAY_NAMES.indexOf(swap[1].toLowerCase())
			: new Date(d.date + "T00:00:00Z").getUTCDay();
		if (WEEKDAYS.includes(weekday)) days.push({ date: d.date, weekday });
	}
	return { start, end, days };
}

/** Teaching days still to come per weekday, today included (a class today hasn't happened yet). */
export function remainingDays(sem: Semester, today = new Date()): Record<number, number> {
	const now = today.toLocaleDateString("en-CA"); // local, so "today" means the user's today
	const out: Record<number, number> = {};
	for (const d of WEEKDAYS) out[d] = 0;
	for (const d of sem.days) if (d.date >= now) out[d.weekday] += 1;
	return out;
}

export const totalDays = (days: Record<number, number>) =>
	WEEKDAYS.reduce((n, d) => n + (days[d] ?? 0), 0);
