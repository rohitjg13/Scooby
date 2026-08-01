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
    openAsUWE?: boolean; // Whether course is open as UWE
    term?: string;       // "Full semester" | "First half" | "Second half"
}

export function isMajorElective(course: Course): boolean {
    return (course.courseType ?? '').trim().toLowerCase() === 'major elective';
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
    if (dayStr == "SAT"){
        return ['Saturday'];
    }
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
        }
        else if (cleaned[i] === 'SAT') {
            result.push('Saturday');
            i++;
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

// Batch codes as the sheet writes them: "CSD21, CSD22", "ECE29 to ECE215",
// "CSD310 to CSD311". Ranges expand to every code in between.
export function expandBatchCodes(raw: string): string[] {
    if (!raw) return [];
    return raw
        .split(',')
        .flatMap((part) => {
            const range = part.trim().match(/^(\S+)\s+to\s+(\S+)$/i);
            return range ? expandRange(range[1], range[2]) : [part.trim()];
        })
        .filter(Boolean);
}

// "ECE29".."ECE215" -> shared prefix "ECE2", numeric tail 9..15
function expandRange(from: string, to: string): string[] {
    for (let i = Math.min(from.length, to.length) - 1; i > 0; i--) {
        const prefix = from.slice(0, i);
        if (!to.startsWith(prefix)) continue;
        const start = from.slice(i);
        const end = to.slice(i);
        if (!/^\d+$/.test(start) || !/^\d+$/.test(end)) continue;
        const s = Number(start);
        const e = Number(end);
        if (s > e || e - s > 100) continue;
        return Array.from({ length: e - s + 1 }, (_, n) => prefix + (s + n));
    }
    return [from, to];
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

// Do two class rows overlap on a shared day?
export function hasTimeConflict(course1: Course, course2: Course): boolean {
    if (!course1.day || !course1.startTime || !course1.endTime) return false;
    if (!course2.day || !course2.startTime || !course2.endTime) return false;

    // Half-semester courses in opposite halves never run at the same time
    if (course1.term && course2.term && course1.term !== course2.term
        && !/full/i.test(course1.term) && !/full/i.test(course2.term)) return false;

    const days1 = parseDays(course1.day);
    const days2 = parseDays(course2.day);

    if (!days1.some(d => days2.includes(d))) return false;

    return timesOverlap(course1.startTime, course1.endTime, course2.startTime, course2.endTime);
}

// Club info (parsed from the Recruitment Forms workbook)
export interface Club {
    name: string;
    details: string;
    instagram: string;   // full URL, may be empty
    handle: string;      // e.g. "@culturalcommittee.snu", may be empty
    email: string;       // club email ID, may be empty
    logo: string;        // path under /club-logos, may be empty
    category: 'cultural' | 'technical';
}

// Exam type for mid-sem/end-sem exams
export interface Exam {
    courseCode: string;
    date: string;       // e.g. "Feb 16"
    day: string;        // e.g. "Monday"
    time: string;       // e.g. "9:30 AM" or "3:00 PM"
    slot: 'morning' | 'afternoon';
}
