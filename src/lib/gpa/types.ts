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

export interface GpaState {
	cohort: Cohort;
	semesters: SemesterEntry[];
}