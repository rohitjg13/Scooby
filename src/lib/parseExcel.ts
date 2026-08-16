import * as XLSX from 'xlsx';
import type { Course } from './types';
import { expandBatchCodes, minutesToTime, timeToMinutes } from './types';

// Most time cells format as "10:10 AM", a few as 24h "13:00:00". One shape out.
const clock = (raw: string) => (raw ? minutesToTime(timeToMinutes(raw)) : '');

// The Monsoon 2026 sheet: one row per class meeting, columns
//   Course Code | Course Title | School | Department | Major for Programme |
//   Course Type | Open as UWE | Component | Section | Major Elective for
//   Programmes | Student Block | Term | Day | Start Time | End Time | Room |
//   Instructor(s)
export function parseExcelFile(buffer: ArrayBuffer): Course[] {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    // raw:false so the time columns come back as "10:10 AM", not 0.4236…
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { raw: false });

    return rows
        .map((row) => {
            const get = (key: string) => (row[key] ?? '').toString().trim();

            // Who the row is for: the programme it is a major requirement of,
            // the programmes it is a major elective for, and any student blocks
            // it is split across. UWEs and CCCs name none of these — open to
            // all, found by search, so they stay opt-in.
            const blocks = expandBatchCodes(get('Student Block')).filter((b) => /\d/.test(b));
            const major = [
                ...new Set([
                    ...expandBatchCodes(get('Major for Programme')),
                    ...expandBatchCodes(get('Major Elective for Programmes')),
                    ...blocks
                ])
            ];

            const section = get('Section');
            const code = get('Course Code');
            const term = get('Term');

            return {
                sno: 0,
                courseCode: section ? `${code}-${section}` : code,
                courseName: get('Course Title'),
                // ponytail: the sheet has no credit hours column
                credits: 0,
                faculty: get('Instructor(s)'),
                slot: section,
                room: get('Room'),
                major: major.join(', '),
                blocks: blocks.join(', '),
                day: get('Day'),
                startTime: clock(get('Start Time')),
                endTime: clock(get('End Time')),
                courseType: get('Course Type'),
                component: get('Component'),
                openAsUWE: get('Open as UWE').toLowerCase() === 'yes',
                // "Both half" already covers the whole semester — one class in
                // the slot all term, not two halves to reconcile.
                term: term === 'Both half' ? 'Full semester' : term
            };
        })
        .filter((course) => course.courseCode && course.courseCode !== '-')
        .map((course, index) => ({ ...course, sno: index + 1 }));
}
