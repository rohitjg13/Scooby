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

// Major Electives the user's own department can take. Matching is by
// department, not by exact batch: an elective offered to ECE4YR is still an ECE
// elective to an ECE 3rd year, and CSD365 lists ECE3YR without an ECE student
// necessarily having typed that exact code. The same course is just a UWE to
// everyone outside those departments (when it is open as one).
export const myElectives = derived(
    [allCourses, currentBatches],
    ([$allCourses, $currentBatches]) => {
        const validBatches = normalizeBatches($currentBatches);
        if (validBatches.length === 0) return [];
        const myDepts = new Set(validBatches.map(getDepartment).filter(Boolean));

        return $allCourses.filter(course => {
            if (!isMajorElective(course)) return false;
            // Any batch it is offered to that belongs to my department...
            if (course.major)
                for (const code of course.major.toUpperCase().split(/[\s,]+/))
                    if (code && myDepts.has(getDepartment(code))) return true;
            // ...or, for the 141 rows carrying no programme at all, the
            // department the course code itself belongs to.
            return myDepts.has(getDepartment(course.courseCode));
        });
    }
);

// Derived store for filtered courses based on search
export const filteredCourses = derived(
    [allCourses, searchQuery],
    ([$allCourses, $searchQuery]) => {
        if (!$searchQuery || $searchQuery.trim().length < 2) return [];
        const query = $searchQuery.toLowerCase().trim();
        // No limit here: the dropdown still has to drop what you can't add,
        // and truncating first threw away every result that would have shown.
        return $allCourses.filter(course =>
            course.courseCode.toLowerCase().includes(query) ||
            course.courseName.toLowerCase().includes(query) ||
            course.faculty.toLowerCase().includes(query)
        );
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
