import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseExcelFile } from '$lib/parseExcel';
import { parseTimetableJson } from '$lib/parseTimetableJson';

// The JSON dump scraped from the published timetable site, if it is checked in.
// It is the finer-grained source — it carries the school/programme nesting the
// sheet flattens away — so it wins whenever it is present.
const ttJson = Object.values(
    import.meta.glob('$lib/data/tt.json', { query: '?raw', import: 'default', eager: true })
)[0] as string | undefined;

// Fallback source of truth: the published spreadsheet.
const sheetUrl = Object.values(
    import.meta.glob('$lib/data/Monsoon 2026 Timetable-final.xlsx', {
        query: '?url',
        import: 'default',
        eager: true
    })
)[0] as string | undefined;

const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate' };

export const GET: RequestHandler = async ({ fetch }) => {
    try {
        if (ttJson) {
            return json({ courses: parseTimetableJson(ttJson) }, { headers: noCache });
        }

        if (!sheetUrl) {
            return json(
                { error: 'No timetable found in src/lib/data/ (expected tt.json or the xlsx)' },
                { status: 404 }
            );
        }

        const response = await fetch(sheetUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch timetable sheet: ${response.statusText}`);
        }

        return json({ courses: parseExcelFile(await response.arrayBuffer()) }, { headers: noCache });
    } catch (error) {
        console.error('Error loading timetable:', error);
        return json({ error: 'Failed to load timetable: ' + String(error) }, { status: 500 });
    }
};
