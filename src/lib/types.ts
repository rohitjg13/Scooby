// Types for the timetable application

export interface Course {
    sno: number;
    courseCode: string;
    courseName: string;
    credits: number;
    faculty: string;
    slot: string;       // Section like LEC1, TUT1, PRAC1
    room: string;
    major: string;      // Batch codes
    day?: string;
    startTime?: string;
    endTime?: string;
    courseType?: string; // Major, Elective, etc.
    component?: string;  // LEC, TUT, PRAC, etc.
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DAY_ABBREV: Record<string, string[]> = {
    'M': ['Monday'],
    'T': ['Tuesday'],
    'W': ['Wednesday'],
    'Th': ['Thursday'],
    'F': ['Friday'],
    'S': ['Saturday'],
    'MW': ['Monday', 'Wednesday'],
    'MWF': ['Monday', 'Wednesday', 'Friday'],
    'TTh': ['Tuesday', 'Thursday'],
    'TT': ['Tuesday', 'Thursday'],
    'MF': ['Monday', 'Friday'],
    'WF': ['Wednesday', 'Friday'],
    'MT': ['Monday', 'Tuesday'],
    'WTh': ['Wednesday', 'Thursday'],
};

export function parseDays(dayStr: string): string[] {
    if (!dayStr) return [];
    const cleaned = dayStr.trim().replace(/\s+/g, '');

    if (DAY_ABBREV[cleaned]) return DAY_ABBREV[cleaned];

    const fullDays = DAYS.filter(d =>
        dayStr.toLowerCase().includes(d.toLowerCase())
    );
    if (fullDays.length > 0) return fullDays;

    const result: string[] = [];
    let i = 0;
    while (i < cleaned.length) {
        if (cleaned.substring(i, i + 2) === 'Th') {
            result.push('Thursday');
            i += 2;
        } else if (cleaned[i] === 'M') {
            result.push('Monday');
            i++;
        } else if (cleaned[i] === 'T') {
            result.push('Tuesday');
            i++;
        } else if (cleaned[i] === 'W') {
            result.push('Wednesday');
            i++;
        } else if (cleaned[i] === 'F') {
            result.push('Friday');
            i++;
        } else if (cleaned[i] === 'S') {
            result.push('Saturday');
            i++;
        } else {
            i++;
        }
    }

    return [...new Set(result)];
}

export function timeToMinutes(time: string): number {
    if (!time) return 0;
    const cleaned = time.trim().toUpperCase();

    let hours = 0;
    let minutes = 0;

    const match = cleaned.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
    if (match) {
        hours = parseInt(match[1]) || 0;
        minutes = parseInt(match[2]) || 0;

        if (match[3]?.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (match[3]?.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }

    return hours * 60 + minutes;
}

export function minutesToTime(mins: number): string {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    const h = hours % 12 || 12;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);
    return s1 < e2 && s2 < e1;
}
