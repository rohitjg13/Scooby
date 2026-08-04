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

	const byRow = new Map<number, { row: Row; batches: Set<string>; blocks: Set<string> }>();
	for (const programmes of Object.values(data)) {
		for (const [programme, rows] of Object.entries(programmes)) {
			for (const row of rows) {
				let entry = byRow.get(row.rowid);
				if (!entry) {
					entry = { row, batches: new Set(), blocks: new Set() };
					byRow.set(row.rowid, entry);
				}
				entry.batches.add(programme);
				// Blocks stay listed separately as well: a row naming them is
				// for those blocks only, not for the whole programme.
				for (const b of expandBatchCodes(row.block ?? '')) {
					entry.batches.add(b);
					entry.blocks.add(b);
				}
			}
		}
	}

	const courses = [...byRow.values()]
		.filter(({ row }) => row.code && row.code !== '-')
		.map(({ row, batches, blocks }, index) => ({
			sno: index + 1,
			courseCode: row.sec ? `${row.code}-${row.sec}` : row.code,
			courseName: row.title ?? '',
			// ponytail: the dump has no credit hours, only seat caps
			credits: 0,
			faculty: row.inst ?? '',
			slot: row.sec ?? '',
			room: row.room ?? '',
			major: [...batches].join(', '),
			blocks: [...blocks].join(', '),
			day: row.day ?? '',
			startTime: row.start ?? '',
			endTime: row.end ?? '',
			courseType: row.type ?? '',
			component: row.comp ?? '',
			openAsUWE: (row.uwe ?? '').trim().toLowerCase() === 'yes',
			term: row.term ?? ''
		}));

	return mergeHalves(courses);
}

// Some courses (all CCCs so far) are listed twice for the same slot: one row
// for the first half, one for the second. That is one class holding the slot
// all semester, so show it once. Faculty can differ between the halves — team
// teaching — so both names are kept.
function mergeHalves(courses: Course[]): Course[] {
	const slot = (c: Course) =>
		[c.courseCode, c.day, c.startTime, c.endTime, c.room, c.major].join('|');

	const halves = new Map<string, Course[]>();
	for (const c of courses) {
		if (!/half/i.test(c.term ?? '')) continue;
		const group = halves.get(slot(c));
		if (group) group.push(c);
		else halves.set(slot(c), [c]);
	}

	const merged = new Set<string>();
	return courses
		.filter((c) => {
			const group = halves.get(slot(c));
			// only collapse when both halves are actually present
			if (!group || group.length < 2) return true;
			if (new Set(group.map((g) => g.term)).size < 2) return true;
			if (merged.has(slot(c))) return false;
			merged.add(slot(c));
			c.term = 'Full semester';
			c.faculty = [...new Set(group.flatMap((g) => g.faculty.split(',').map((f) => f.trim())))]
				.filter(Boolean)
				.join(', ');
			return true;
		})
		.map((c, index) => ({ ...c, sno: index + 1 }));
}
