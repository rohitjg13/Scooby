export type ComponentType = 'LEC' | 'TUT' | 'PRAC';

export const PREDEFINED_COMPONENTS = ['LEC', 'TUT', 'PRAC'];

export interface ComponentInput {
    type: ComponentType;
    attended: number;
    totalSoFar: number;
    remaining: number;
}

export interface Course {
    id: string;
    title: string;
    leaves: number;
    Components: [ComponentInput, ComponentInput, ComponentInput];
}

export interface AttendanceStats {
    currentPercentage: number;
    bestCasePercentage: number;
    worstCasePercentage: number;
    isMeetingTarget: boolean;
    neededHours: number;
    marginHours: number;
    hoursLeft: number;
}

export function CourseGenerator(title = ''): Course {
    return {
        id: crypto.randomUUID(),
        title,
        leaves: 0,
        Components: [
            { type: 'LEC', attended: 0, totalSoFar: 0, remaining: 0 },
            { type: 'TUT', attended: 0, totalSoFar: 0, remaining: 0 },
            { type: 'PRAC', attended: 0, totalSoFar: 0, remaining: 0 },
        ]
    };
}

export function calculateStats(
    attended: number,
    totalSoFar: number,
    remaining: number,
    leaves: number,
    targetPercentage = 75
): AttendanceStats {
    if (totalSoFar <= 0) {
        return {
            currentPercentage: 0,
            bestCasePercentage: 0,
            worstCasePercentage: 0,
            isMeetingTarget: true,
            neededHours: 0,
            marginHours: 0,
            hoursLeft: 0,
        };
    }

    const currentPercentage = (attended / (totalSoFar - leaves)) * 100;
    const bestCasePercentage = ((attended + remaining) / (totalSoFar + remaining - leaves)) * 100;
    const worstCasePercentage = (attended) / (totalSoFar + remaining - leaves) * 100;
    const isMeetingTarget = currentPercentage >= targetPercentage;
    let neededHours = 0;
    let marginHours = 0;
    let hoursLeft = 0;

    const p = targetPercentage / 100;

    if (!isMeetingTarget) {
        const rawNeeded = (p * (totalSoFar - leaves) - attended) / (1 - p);
        neededHours = Math.max(0, Math.ceil(rawNeeded * 100) / 100);
    }
    else {
        const rawMargin = (attended - p * (totalSoFar - leaves)) / p;
        const boundedMargin = Math.min(rawMargin, remaining);
        marginHours = Math.max(0, Math.floor(boundedMargin * 100) / 100);
    }

    hoursLeft = p * (totalSoFar + remaining - leaves) - attended;
    hoursLeft = Math.max(0, Math.ceil(hoursLeft * 100) / 100);

    return {
        currentPercentage,
        bestCasePercentage,
        worstCasePercentage,
        isMeetingTarget,
        neededHours,
        marginHours,
        hoursLeft
    }
}

export function calculateCourseStats(
    course: Course,
    targetPercentage = 75
): AttendanceStats {
    let totalAttended = 0;
    let totalHeld = 0;
    let totalRemaining = 0;
    for (const comp of course.Components) {
        totalAttended += comp.attended;
        totalHeld += comp.totalSoFar;
        totalRemaining += comp.remaining;
    }
    return calculateStats(totalAttended, totalHeld, totalRemaining, course.leaves, targetPercentage);
}