import * as XLSX from 'xlsx';
import type { Course } from './types';

export function parseExcelFile(buffer: ArrayBuffer): Course[] {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    const courses: Course[] = jsonData.map((row, index) => {
        // Try to match various possible header names
        const getValue = (keys: string[]): string => {
            for (const key of keys) {
                const found = Object.keys(row).find(k =>
                    k.toLowerCase().replace(/[\s._-]/g, '').includes(key.toLowerCase().replace(/[\s._-]/g, ''))
                );
                if (found && row[found] !== undefined && row[found] !== null) {
                    return String(row[found]).trim();
                }
            }
            return '';
        };

        const getNumericValue = (keys: string[]): number => {
            const val = getValue(keys);
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        };

        return {
            sno: index + 1,
            courseCode: getValue(['coursecode', 'code', 'course_code', 'coursenumber']),
            courseName: getValue(['coursename', 'name', 'course_name', 'title', 'coursetitle']),
            credits: getNumericValue(['credits', 'credit', 'cr']),
            faculty: getValue(['faculty', 'instructor', 'teacher', 'professor', 'facultyname']),
            slot: getValue(['slot', 'slots', 'timeslot', 'time_slot']),
            room: getValue(['room', 'venue', 'classroom', 'location', 'roomno']),
            major: getValue(['major', 'batch', 'batches', 'program', 'department', 'dept'])
        };
    }).filter(course => course.courseCode || course.courseName); // Filter out empty rows

    return courses;
}

export function parseCSVFile(text: string): Course[] {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Parse headers
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[\s._-]/g, ''));

    const findHeaderIndex = (keys: string[]): number => {
        for (const key of keys) {
            const index = headers.findIndex(h => h.includes(key.toLowerCase().replace(/[\s._-]/g, '')));
            if (index !== -1) return index;
        }
        return -1;
    };

    const courseCodeIdx = findHeaderIndex(['coursecode', 'code']);
    const courseNameIdx = findHeaderIndex(['coursename', 'name', 'title']);
    const creditsIdx = findHeaderIndex(['credits', 'credit']);
    const facultyIdx = findHeaderIndex(['faculty', 'instructor', 'teacher']);
    const slotIdx = findHeaderIndex(['slot', 'slots', 'timeslot']);
    const roomIdx = findHeaderIndex(['room', 'venue', 'classroom']);
    const majorIdx = findHeaderIndex(['major', 'batch', 'batches']);

    const courses: Course[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;

        const course: Course = {
            sno: i,
            courseCode: courseCodeIdx >= 0 ? (values[courseCodeIdx] || '').trim() : '',
            courseName: courseNameIdx >= 0 ? (values[courseNameIdx] || '').trim() : '',
            credits: creditsIdx >= 0 ? parseFloat(values[creditsIdx]) || 0 : 0,
            faculty: facultyIdx >= 0 ? (values[facultyIdx] || '').trim() : '',
            slot: slotIdx >= 0 ? (values[slotIdx] || '').trim() : '',
            room: roomIdx >= 0 ? (values[roomIdx] || '').trim() : '',
            major: majorIdx >= 0 ? (values[majorIdx] || '').trim() : ''
        };

        if (course.courseCode || course.courseName) {
            courses.push(course);
        }
    }

    return courses;
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result;
}
