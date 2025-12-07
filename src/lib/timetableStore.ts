import { writable, derived } from 'svelte/store';
import type { Course } from './types';
import { parseDays, timesOverlap } from './types';

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

        // Optimize: Convert batches to Set/canonical form for faster lookup if needed, 
        // but for <3 items and string matching logic, simple iteration is fine.
        const validBatches = $currentBatches
            .map(b => b.toUpperCase().trim())
            .filter(b => b.length > 0);

        if (validBatches.length === 0) return [];

        return $allCourses.filter(course => {
            if (!course.major) return false;
            const majors = course.major.toUpperCase().split(/[\s,]+/);
            // Check if ANY of the user's batches matches ANY of the course's majors
            return validBatches.some(userBatch =>
                majors.some(m => m.includes(userBatch) || userBatch.includes(m))
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

// Check if two courses have a time conflict
export function hasTimeConflict(course1: Course, course2: Course): boolean {
    if (!course1.day || !course1.startTime || !course1.endTime) return false;
    if (!course2.day || !course2.startTime || !course2.endTime) return false;

    const days1 = parseDays(course1.day);
    const days2 = parseDays(course2.day);

    // Check if any days overlap
    const commonDays = days1.filter(d => days2.includes(d));
    if (commonDays.length === 0) return false;

    // Check if times overlap
    return timesOverlap(course1.startTime, course1.endTime, course2.startTime, course2.endTime);
}

// Get all conflicting courses for a given course
export function getConflicts(course: Course, batchCourses: Course[], selectedCourses: Course[]): Course[] {
    const allCurrent = [...batchCourses, ...selectedCourses];
    return allCurrent.filter(existing =>
        existing.courseCode !== course.courseCode && hasTimeConflict(course, existing)
    );
}
