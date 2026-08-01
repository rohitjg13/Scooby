// Pure helpers for "does this whole course fit?".
// A course = one section from each component group (one LEC, one TUT, one PRAC).
import type { Course } from './types.ts';
import { hasTimeConflict } from './types.ts';

export type Section = { code: string; rows: Course[] };
export type Group = { prefix: string; sections: Section[] };

export const GROUP_ORDER = ['LEC', 'TUT', 'PRAC', 'OTHER'];
export const GROUP_LABEL: Record<string, string> = {
    LEC: 'Lecture',
    TUT: 'Tutorial',
    PRAC: 'Practical',
    OTHER: 'Other'
};

export function getBaseCourseCode(courseCode: string): string {
    return courseCode.split('-')[0];
}

// Department = the letters a course code starts with, e.g. ECE101 -> ECE.
// Capped at 3 so oddities like "CCCNEW" land in the right bucket.
export function getDepartment(courseCode: string): string {
    return (getBaseCourseCode(courseCode).match(/^[A-Za-z]{1,3}/)?.[0] ?? '').toUpperCase();
}

export function getComponentPrefix(course: Course): string {
    const val = (course.component || course.slot || '').toUpperCase();
    if (val.startsWith('LEC')) return 'LEC';
    if (val.startsWith('TUT')) return 'TUT';
    if (val.startsWith('PRAC')) return 'PRAC';
    return '';
}

// Rows of one course, bucketed into component groups and sections within them
export function groupSections(rows: Course[]): Group[] {
    const byPrefix = new Map<string, Map<string, Course[]>>();

    for (const row of rows) {
        const prefix = getComponentPrefix(row) || 'OTHER';
        if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Map());
        const sections = byPrefix.get(prefix)!;
        if (!sections.has(row.courseCode)) sections.set(row.courseCode, []);
        sections.get(row.courseCode)!.push(row);
    }

    return GROUP_ORDER.filter((p) => byPrefix.has(p)).map((prefix) => ({
        prefix,
        sections: [...byPrefix.get(prefix)!]
            .map(([code, sectionRows]) => ({ code, rows: sectionRows }))
            .sort((a, b) => a.code.localeCompare(b.code))
    }));
}

// Courses already on the timetable that clash with any row of this section
export function sectionConflicts(rows: Course[], existing: Course[]): Course[] {
    const out = new Map<string, Course>();
    for (const row of rows) {
        for (const other of existing) {
            if (other.courseCode === row.courseCode) continue;
            if (hasTimeConflict(row, other)) out.set(other.courseCode, other);
        }
    }
    return [...out.values()];
}

// Calendar blocks that overlap in time have to sit side by side, or the later
// one just covers the earlier. Split a day into clusters of overlapping blocks
// and give each block a lane within its cluster.
export type Lane = { startMin: number; endMin: number; col: number; cols: number };

export function assignLanes(dayBlocks: Lane[]): void {
    const sorted = [...dayBlocks].sort(
        (a, b) => a.startMin - b.startMin || a.endMin - b.endMin
    );

    let cluster: Lane[] = [];
    let clusterEnd = -1;

    const close = () => {
        const cols = Math.max(...cluster.map((b) => b.col)) + 1;
        for (const b of cluster) b.cols = cols;
        cluster = [];
    };

    for (const block of sorted) {
        // A gap means nothing from here on can overlap what came before
        if (cluster.length && block.startMin >= clusterEnd) close();

        const taken = new Set(
            cluster.filter((b) => b.endMin > block.startMin).map((b) => b.col)
        );
        let col = 0;
        while (taken.has(col)) col++;

        block.col = col;
        block.cols = 1;
        cluster.push(block);
        clusterEnd = Math.max(clusterEnd, block.endMin);
    }
    if (cluster.length) close();
}

// One section per group with no clashes, or null if the course can't fit.
// `locked` pins a group to a section (e.g. one the user already has).
// ponytail: plain DFS — a handful of groups with a handful of sections each.
export function findCombo(
    groups: Group[],
    existing: Course[],
    locked: Record<string, string> = {}
): Record<string, string> | null {
    function pick(
        i: number,
        chosen: Course[],
        picks: Record<string, string>
    ): Record<string, string> | null {
        if (i >= groups.length) return picks;
        const group = groups[i];
        const options = locked[group.prefix]
            ? group.sections.filter((s) => s.code === locked[group.prefix])
            : group.sections;

        for (const section of options) {
            if (sectionConflicts(section.rows, [...existing, ...chosen]).length) continue;
            const res = pick(i + 1, [...chosen, ...section.rows], {
                ...picks,
                [group.prefix]: section.code
            });
            if (res) return res;
        }
        return null;
    }

    return pick(0, [], {});
}
