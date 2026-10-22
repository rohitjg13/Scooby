import type { PageServerLoad } from './$types';
import { loadCalendar } from '$lib/server/calendarPdf';
import { semesterFrom } from '$lib/semester';

// Same deal as the calendar page: the PDF is parsed once at build time and
// only the list of teaching dates ships to the browser, which counts the ones
// still ahead of today itself.
export const prerender = true;

export const load: PageServerLoad = async ({ fetch }) => {
	const { calendar } = await loadCalendar(fetch);
	return { semester: semesterFrom(calendar.days) };
};
