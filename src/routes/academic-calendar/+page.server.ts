import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { AcademicCalendar } from '$lib/server/academicCalendar';
import { extractPdf, parseAcademicCalendar } from '$lib/server/academicCalendar';

// Whatever calendar PDF is sitting in src/lib/data — drop a newer one in and
// it is picked up on the next build, no conversion step in between.
const pdfUrl = Object.entries(
	import.meta.glob('$lib/data/*calendar*.pdf', { query: '?url', import: 'default', eager: true })
).sort(([a], [b]) => b.localeCompare(a))[0]?.[1] as string | undefined;

// Parsing is pure work over a file that cannot change between requests.
let cached: Promise<{ calendar: AcademicCalendar }> | null = null;

export const load: PageServerLoad = async ({ fetch }) => {
	if (cached) return cached;
	if (!pdfUrl) throw error(404, 'No academic calendar PDF found in src/lib/data/');

	cached = (async () => {
		const response = await fetch(pdfUrl);
		if (!response.ok) throw error(500, `Could not read the calendar PDF: ${response.statusText}`);
		const { items, fills } = await extractPdf(new Uint8Array(await response.arrayBuffer()));
		return { calendar: parseAcademicCalendar(items, fills) };
	})();
	cached.catch(() => (cached = null));
	return cached;
};
