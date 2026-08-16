// Run: npx vite-node scripts/parseExcel.check.ts
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import { parseExcelFile } from '../src/lib/parseExcel';
import { offeredTo } from '../src/lib/types';

const buf = readFileSync('src/lib/data/Monsoon 2026 Timetable-final.xlsx');
const courses = parseExcelFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

assert.ok(courses.length > 1000, `too few rows: ${courses.length}`);

// times must be clock strings, not Excel serial fractions
assert.ok(
	courses.every((c) => !c.startTime || /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(c.startTime)),
	'unformatted start times'
);

// a major course reaches its programme and its blocks; UWEs reach nobody by batch
const bio = courses.find((c) => c.courseCode === 'BIO1001-LEC1')!;
assert.ok(offeredTo(bio, ['BIO11']), 'block missed');
assert.ok(offeredTo(bio, ['BIO1YR']), 'programme missed');
assert.ok(!offeredTo(bio, ['CSD2YR']), 'leaked to other programme');

const uwe = courses.find((c) => c.courseType === 'UWE' && c.openAsUWE)!;
assert.equal(uwe.major, '', 'UWE should not be assigned to a batch');

// major electives keep their type and reach the programmes they list
const elective = courses.find((c) => c.courseCode === 'BIO323-LEC1')!;
assert.equal(elective.courseType, 'Major Elective');
assert.ok(offeredTo(elective, ['BIO3YR']) && offeredTo(elective, ['BIO4YR']));

assert.ok(!courses.some((c) => c.term === 'Both half'), '"Both half" not normalised');

console.log(`ok — ${courses.length} rows`);
