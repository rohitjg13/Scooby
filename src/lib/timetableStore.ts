import { writable, derived } from 'svelte/store';
import type { Course } from './types';
import { hasTimeConflict, isMajorElective } from './types';
import { getDepartment } from './coursePlanner';

function normalizeBatches(batches: string[]): string[] {
    return batches.map(b => b.toUpperCase().trim()).filter(b => b.length > 0);
}

// Is this row offered to one of the user's batches?
function offeredTo(course: Course, validBatches: string[]): boolean {
    if (!course.major) return false;
    // Exact match: ranges are expanded at parse time, and a substring
    // match would put ECE21 students into every ECE215 class.
    const majors = course.major.toUpperCase().split(/[\s,]+/);
    return validBatches.some(userBatch => majors.includes(userBatch));
}

// Store for all courses loaded from the spreadsheet
export const allCourses = writable<Course[]>([]);

// Store for the current batch codes (array of strings)
export const currentBatches = writable<string[]>([]);

// Store for selected/added courses
export const selectedCourses = writable<Course[]>([]);

// Store for search query
export const searchQuery = writable<string>('');

// Derived store for courses allocated to the current batches
export const batchCourses = derived(
    [allCourses, currentBatches],
    ([$allCourses, $currentBatches]) => {
        if (!$currentBatches || $currentBatches.length === 0) return [];
        const validBatches = normalizeBatches($currentBatches);
        if (validBatches.length === 0) return [];

        // Major Electives are offered to a programme, not assigned to it — a
        // 4th year is not enrolled in all seven at once. They stay opt-in.
        return $allCourses.filter(
            course => offeredTo(course, validBatches) && !isMajorElective(course)
        );
    }
);

// Major Electives the user's own programme can take. The same course is just a
// UWE to everyone else (when it is open as one).
export const myElectives = derived(
    [allCourses, currentBatches],
    ([$allCourses, $currentBatches]) => {
        const validBatches = normalizeBatches($currentBatches);
        if (validBatches.length === 0) return [];
        const myDepts = new Set(validBatches.map(getDepartment).filter(Boolean));

        return $allCourses.filter(course => {
            if (!isMajorElective(course)) return false;
            // Offered to my batch, or failing that (141 rows carry no
            // programme) an elective from my own department.
            return (
                offeredTo(course, validBatches) ||
                myDepts.has(getDepartment(course.courseCode))
            );
        });
    }
);

// Derived store for filtered courses based on search
export const filteredCourses = derived(
    [allCourses, searchQuery],
    ([$allCourses, $searchQuery]) => {
        if (!$searchQuery || $searchQuery.trim().length < 2) return [];
        const query = $searchQuery.toLowerCase().trim();
        return $allCourses.filter(course =>
            course.courseCode.toLowerCase().includes(query) ||
            course.courseName.toLowerCase().includes(query) ||
            course.faculty.toLowerCase().includes(query)
        ).slice(0, 30);
    }
);

export { hasTimeConflict };

// Get all conflicting courses for a given course
export function getConflicts(course: Course, batchCourses: Course[], selectedCourses: Course[]): Course[] {
    const allCurrent = [...batchCourses, ...selectedCourses];
    return allCurrent.filter(existing =>
        existing.courseCode !== course.courseCode && hasTimeConflict(course, existing)
    );
}
