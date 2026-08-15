import type { SemesterEntry, Cohort } from './types';
import {
	GRADE_POINTS,
	isOperationalGrade,
	isPassingNumericGrade,
	CREDIT_ONLY_PASS_GRADES
} from './grades';

export type SgpaResult =
	| { status: 'ok'; value: number; credits: number }
	| { status: 'pending' } // contains an 'I' or 'Z' — §3(l), §3(n)
	| { status: 'excluded' } // contains a 'W' — whole semester withdrawn, §3(m)
	| { status: 'empty' };

export function computeSGPA(semester: SemesterEntry, cohort: Cohort): SgpaResult {
	const courses = semester.courses.filter((c) => c.name.trim().length > 0);
	if (courses.length === 0) return { status: 'empty' };

	// §3(m) — a 'W' grade means the WHOLE semester is excluded from SGPA/CGPA
	if (courses.some((c) => c.grade === 'W')) return { status: 'excluded' };

	// §3(l), §3(n) — 'I' or 'Z' pauses the semester's SGPA until resolved
	if (courses.some((c) => c.grade === 'I' || c.grade === 'Z')) return { status: 'pending' };

	// §3(b), §3(d) — operational grades (S/U/AP/AF/TR/R) are excluded entirely,
	// not weighted at zero
	const numeric = courses.filter((c) => !isOperationalGrade(c.grade));
	const totalCredits = numeric.reduce((sum, c) => sum + c.credits, 0);
	if (totalCredits === 0) return { status: 'empty' };

	const weighted = numeric.reduce(
		(sum, c) => sum + c.credits * (GRADE_POINTS[cohort][c.grade] ?? 0),
		0
	);

	return { status: 'ok', value: weighted / totalCredits, credits: totalCredits };
}

export interface CgpaResult {
	cgpa: number;
	percentage: number; // §12 — CGPA × 10
	totalCreditsEarned: number;
	totalCreditsRegistered: number;
}

export function computeCGPA(semesters: SemesterEntry[], cohort: Cohort): CgpaResult {
	const all = semesters.flatMap((s) => s.courses.filter((c) => c.name.trim().length > 0));

	// §3(b) — operational grades never enter SGPA/CGPA
	const numeric = all.filter((c) => !isOperationalGrade(c.grade));

	const totalCreditsRegistered = numeric.reduce((sum, c) => sum + c.credits, 0);
	const weighted = numeric.reduce(
		(sum, c) => sum + c.credits * (GRADE_POINTS[cohort][c.grade] ?? 0),
		0
	);
	const cgpa = totalCreditsRegistered ? weighted / totalCreditsRegistered : 0;

	// §9(c) — credits earned: numeric passes (D or above) + credit-only passes (S/AP/TR)
	const numericPasses = numeric.filter((c) => isPassingNumericGrade(c.grade, cohort));
	const creditOnlyPasses = all.filter((c) => CREDIT_ONLY_PASS_GRADES.includes(c.grade as any));

	const totalCreditsEarned =
		numericPasses.reduce((sum, c) => sum + c.credits, 0) +
		creditOnlyPasses.reduce((sum, c) => sum + c.credits, 0);

	return {
		cgpa: round2(cgpa),
		percentage: round2(cgpa * 10),
		totalCreditsEarned,
		totalCreditsRegistered
	};
}

export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}