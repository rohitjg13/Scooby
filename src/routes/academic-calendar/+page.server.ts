import type { PageServerLoad } from './$types';
import { loadCalendar } from '$lib/server/calendarPdf';

// The PDF ships with the build, so parse it once at build time: Vercel then
// serves plain HTML and never has to run pdfjs (or fetch its own assets) in a
// serverless function. "Today" is worked out in the browser, so the page stays
// correct however long the deploy has been up.
export const prerender = true;

export const load: PageServerLoad = ({ fetch }) => loadCalendar(fetch);
