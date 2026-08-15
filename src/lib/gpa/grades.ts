import type { Cohort } from './types';

/**
 * §3(a)(i) — cohorts admitted 2025 and later
 * §3(a)(ii) — cohorts admitted before 2025
 * ('E' is discontinued for both; 'F*' only exists for the pre-2025 scale)
 */
export const GRADE_POINTS: Record<Cohort, Record<string, number>> = {
	post2025: {
		O: 10,
		'A+': 9,
		A: 8,
		'B+': 7,
		B: 6,
		C: 5,
		D: 4,
		F: 0,
		Ab: 0
	},
	pre2025: {
		A: 10,
		'A-': 9,
		B: 8,
		'B-': 7,
		C: 6,
		'C-': 5,
		D: 4,
		F: 0,
		'F*': 0
	}
};

export const COHORT_LABELS: Record<Cohort, string> = {
	post2025: 'Admitted 2025 or later',
	pre2025: 'Admitted before 2025'
};

/**
 * §3(b) — operational / non-academic grades.
 * These NEVER enter the SGPA or CGPA calculation — not even as a zero.
 * They are filtered out of the formula entirely, not just weighted at 0.
 */
export const OPERATIONAL_GRADES = ['I', 'R', 'W', 'Z', 'TR', 'AP', 'AF', 'S', 'U'] as const;
export type OperationalGrade = (typeof OPERATIONAL_GRADES)[number];

export const OPERATIONAL_GRADE_LABELS: Record<OperationalGrade, string> = {
	I: 'Incomplete',
	R: 'Result Withheld',
	W: 'Withdrawn from the Course',
	Z: 'In Progress (multi-semester) / Interim',
	TR: 'Transfer Credit',
	AP: 'Audit Pass',
	AF: 'Audit Fail',
	S: 'Satisfactory',
	U: 'Unsatisfactory'
};

/**
 * §3(h), §3(j), §9(c) — grades that still earn CREDIT on a pass outcome,
 * even though they carry no grade points and don't touch the GPA at all.
 * (AF and the rest of OPERATIONAL_GRADES earn nothing.)
 */
export const CREDIT_ONLY_PASS_GRADES: OperationalGrade[] = ['S', 'AP', 'TR'];

export function gradeOptionsFor(cohort: Cohort): string[] {
	return [...Object.keys(GRADE_POINTS[cohort]), ...OPERATIONAL_GRADES];
}

export function isOperationalGrade(grade: string): grade is OperationalGrade {
	return (OPERATIONAL_GRADES as readonly string[]).includes(grade);
}

/**
 * §3(e), §9(c) — 'D' or higher earns credit. Since D=4 and F/Ab/F*=0 on both
 * scales, "points > 0" is equivalent to "D or above" for every numeric grade.
 */
export function isPassingNumericGrade(grade: string, cohort: Cohort): boolean {
	const points = GRADE_POINTS[cohort][grade];
	return points !== undefined && points > 0;
}