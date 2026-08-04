import type { Course } from './types.ts';
import { expandBatchCodes } from './types.ts';

// New timetable dump: { school: { programme: [row, ...] } }, one row per
// class meeting. A course shared by several programmes repeats under each of
// them with the same `rowid`, so rows are merged back on rowid and the
// programme keys become the batch list (what the old sheet's Batch column was).
interface Row {
	code: string;
	title: string;
	type: string;
	uwe: string;
	comp: string;
	sec: string;
	block: string;
	term: string;
	day: string;
	start: string;
	end: string;
	room: string;
	inst: string;
	cap: string;
	note: string;
	rowid: number;
}

export function parseTimetableJson(text: string): Course[] {
	// the dump ships with a trailing ";"
	const data = JSON.parse(text.trim().replace(/;\s*$/, '')) as Record<string, Record<string, Row[]>>;

	const byRow = new Map<number, { row: Row; batches: Set<string> }>();
	for (const programmes of Object.values(data)) {
		for (const [programme, rows] of Object.entries(programmes)) {
			for (const row of rows) {
				let entry = byRow.get(row.rowid);
				if (!entry) {
					entry = { row, batches: new Set() };
					byRow.set(row.rowid, entry);
				}
				entry.batches.add(programme);
				for (const b of expandBatchCodes(row.block ?? '')) entry.batches.add(b);
			}
		}
	}

	return [...byRow.values()]
		.filter(({ row }) => row.code && row.code !== '-')
		.map(({ row, batches }, index) => ({
			sno: index + 1,
			courseCode: row.sec ? `${row.code}-${row.sec}` : row.code,
			courseName: row.title ?? '',
			// ponytail: the dump has no credit hours, only seat caps
			credits: 0,
			faculty: row.inst ?? '',
			slot: row.sec ?? '',
			room: row.room ?? '',
			major: [...batches].join(', '),
			day: row.day ?? '',
			startTime: row.start ?? '',
			endTime: row.end ?? '',
			courseType: row.type ?? '',
			component: row.comp ?? '',
			openAsUWE: (row.uwe ?? '').trim().toLowerCase() === 'yes',
			term: row.term ?? ''
		}));
}
