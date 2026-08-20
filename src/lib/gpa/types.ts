export type Cohort = 'post2025' | 'pre2025';

export interface CourseEntry {
	id: string;
	name: string;
	credits: number;
	grade: string;
}

export interface SemesterEntry {
	id: string;
	label: string;
	courses: CourseEntry[];
}

/** A semester you know the SGPA of, without listing its courses. */
export interface TermEntry {
	id: string;
	label: string;
	sgpa: number;
	credits: number;
}

export interface GpaState {
	cohort: Cohort;
	semesters: SemesterEntry[];
	/** which input the page is showing; older saves predate it */
	mode?: 'courses' | 'sgpa';
	terms?: TermEntry[];
}