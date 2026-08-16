import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseExcelFile } from '$lib/parseExcel';

// The one source of truth for the timetable.
const sheetUrl = Object.values(
    import.meta.glob('$lib/data/Monsoon 2026 Timetable-final.xlsx', {
        query: '?url',
        import: 'default',
        eager: true
    })
)[0] as string | undefined;

export const GET: RequestHandler = async ({ fetch }) => {
    try {
        if (!sheetUrl) {
            return json({ error: 'Timetable sheet not found in src/lib/data/' }, { status: 404 });
        }

        const response = await fetch(sheetUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch timetable sheet: ${response.statusText}`);
        }

        return json(
            { courses: parseExcelFile(await response.arrayBuffer()) },
            { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
        );
    } catch (error) {
        console.error('Error loading timetable:', error);
        return json({ error: 'Failed to load timetable: ' + String(error) }, { status: 500 });
    }
};
