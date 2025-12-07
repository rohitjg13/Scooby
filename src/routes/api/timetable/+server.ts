import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import type { Course } from '$lib/types';

export const GET: RequestHandler = async () => {
    try {
        const dataDir = path.join(process.cwd(), 'static', 'data');

        if (!fs.existsSync(dataDir)) {
            return json({ error: 'Data directory not found.' }, { status: 404 });
        }

        const files = fs.readdirSync(dataDir);
        const xlsxFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
        const csvFile = files.find(f => f.endsWith('.csv'));

        let courses: Course[] = [];

        if (xlsxFile) {
            const filePath = path.join(dataDir, xlsxFile);
            const buffer = fs.readFileSync(filePath);
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
            courses = parseData(jsonData);
        } else if (csvFile) {
            const filePath = path.join(dataDir, csvFile);
            const text = fs.readFileSync(filePath, 'utf-8');
            const workbook = XLSX.read(text, { type: 'string' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
            courses = parseData(jsonData);
        } else {
            return json({ error: 'No timetable file found in static/data/' }, { status: 404 });
        }

        return json({ courses });
    } catch (error) {
        console.error('Error loading timetable:', error);
        return json({ error: 'Failed to load timetable: ' + String(error) }, { status: 500 });
    }
};

function parseData(jsonData: Record<string, unknown>[]): Course[] {
    return jsonData.map((row, index) => {
        const getValue = (keys: string[]): string => {
            for (const key of keys) {
                if (row[key] !== undefined && row[key] !== null) {
                    return String(row[key]).trim();
                }
                const found = Object.keys(row).find(k =>
                    k.toLowerCase().replace(/[\s._-]/g, '') === key.toLowerCase().replace(/[\s._-]/g, '')
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

        const courseName = getValue(['Course Name', 'CourseName', 'Name', 'Title']);
        const courseCode = getValue(['Course Code', 'CourseCode', 'Code']);
        const section = getValue(['Section', 'Sec']); // LEC1, TUT1, PRAC1
        const batch = getValue(['Batch', 'Major', 'Batches', 'Program']);
        const room = getValue(['Room', 'Venue', 'Location', 'Classroom']);
        const days = getValue(['Day', 'Days', 'Weekday']);
        const startTime = getValue(['Start Time', 'StartTime', 'Start', 'From']);
        const endTime = getValue(['End Time', 'EndTime', 'End', 'To']);
        const credits = getNumericValue(['Credits', 'Credit', 'Cr']);
        const faculty = getValue(['Faculty', 'Instructor', 'Teacher', 'Professor']);

        // Course type: Major, Elective, etc - separate from code
        const courseType = getValue(['Type', 'CourseType', 'Category']);

        // Component: LEC, TUT, PRAC etc
        const component = getValue(['Component', 'Comp', 'ComponentType']);

        // Create code with section or component
        let fullCode = courseCode;
        if (section) {
            fullCode = `${courseCode}-${section}`;
        } else if (component) {
            fullCode = `${courseCode}-${component}`;
        }

        return {
            sno: index + 1,
            courseCode: fullCode,
            courseName,
            credits,
            faculty,
            slot: section,
            room,
            major: batch,
            day: days,
            startTime,
            endTime,
            courseType,
            component,
        };
    }).filter(course => course.courseCode && course.courseCode !== '-');
}
