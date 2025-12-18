import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as XLSX from 'xlsx';
import type { Course } from '$lib/types';

// Import data files dynamically using Vite
const dataFiles = import.meta.glob('$lib/data/*.{xlsx,xls,csv}', { query: '?url', import: 'default', eager: true });

export const GET: RequestHandler = async ({ fetch }) => {
    try {
        const filePaths = Object.keys(dataFiles);
        if (filePaths.length === 0) {
            return json({ error: 'No timetable file found in src/lib/data/' }, { status: 404 });
        }

        const xlsxFile = filePaths.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
        const csvFile = filePaths.find(f => f.endsWith('.csv'));
        const targetFile = xlsxFile || csvFile;

        if (!targetFile) {
            return json({ error: 'No supported file found.' }, { status: 404 });
        }

        const url = dataFiles[targetFile] as string;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch data file: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        let courses: Course[] = [];

        if (targetFile.endsWith('.csv')) {
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(buffer);
            const workbook = XLSX.read(text, { type: 'string' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
            courses = parseData(jsonData);
        } else {
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
            courses = parseData(jsonData);
        }

        return json({ courses }, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
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
        const room = getValue(['Room', 'Venue', 'Location', 'Classroom', 'Rooms']);
        const days = getValue(['Day', 'Days', 'Weekday']);
        const startTime = getValue(['Start Time', 'StartTime', 'Start', 'From']);
        const endTime = getValue(['End Time', 'EndTime', 'End', 'To']);
        const credits = getNumericValue(['Credits', 'Credit', 'Cr']);
        const faculty = getValue(['Faculty', 'Instructor', 'Teacher', 'Professor']);

        // Course type: Major, Elective, etc - separate from code
        const courseType = getValue(['Type', 'CourseType', 'Category']);

        // Component: LEC, TUT, PRAC etc
        const component = getValue(['Component', 'Comp', 'ComponentType']);

        // Open as UWE
        const openAsUWEVal = getValue(['Open as UWE', 'OpenAsUWE', 'UWE', 'Open As UWE']);
        const openAsUWE = openAsUWEVal.toLowerCase() === 'yes' || openAsUWEVal.toLowerCase() === 'true';

        // Remarks
        const remarks = getValue(['Remarks']);

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
            openAsUWE,
            remarks,
        };
    }).filter(course => course.courseCode && course.courseCode !== '-');
}
