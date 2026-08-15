<script lang="ts">
	import { onMount } from 'svelte';
	import Seo from '$lib/components/Seo.svelte';
	import type { SemesterEntry, CourseEntry, Cohort } from '$lib/gpa/types';
	import {
		GRADE_POINTS,
		COHORT_LABELS,
		OPERATIONAL_GRADES,
		OPERATIONAL_GRADE_LABELS
	} from '$lib/gpa/grades';
	import { computeSGPA, computeCGPA, type SgpaResult } from '$lib/gpa/calculator';
	import { loadState, saveState, clearState } from '$lib/gpa/storage';

	function newId(): string {
		return crypto.randomUUID();
	}

	function emptyCourse(cohort: Cohort): CourseEntry {
		return {
			id: newId(),
			name: '',
			credits: 4,
			grade: Object.keys(GRADE_POINTS[cohort])[0]
		};
	}

	function emptySemester(label: string, cohort: Cohort): SemesterEntry {
		return { id: newId(), label, courses: [emptyCourse(cohort)] };
	}

	let cohort = $state<Cohort>('post2025');
	let semesters = $state<SemesterEntry[]>([emptySemester('Semester 1', 'post2025')]);
	let hydrated = $state(false);

	onMount(() => {
		const saved = loadState();
		if (saved) {
			cohort = saved.cohort;
			semesters = saved.semesters;
		}
		hydrated = true;
	});

	$effect(() => {
		if (!hydrated) return;
		saveState({ cohort, semesters });
	});

	// switching cohort resets any grade that doesn't exist on the new scale
	function handleCohortChange(next: Cohort) {
		const validGrades = new Set([...Object.keys(GRADE_POINTS[next]), ...OPERATIONAL_GRADES]);
		const fallback = Object.keys(GRADE_POINTS[next])[0];
		semesters = semesters.map((s) => ({
			...s,
			courses: s.courses.map((c) => (validGrades.has(c.grade) ? c : { ...c, grade: fallback }))
		}));
		cohort = next;
	}

	function addSemester() {
		semesters = [...semesters, emptySemester(`Semester ${semesters.length + 1}`, cohort)];
	}

	function removeSemester(id: string) {
		if (semesters.length === 1) return;
		semesters = semesters.filter((s) => s.id !== id);
	}

	function addCourse(semId: string) {
		semesters = semesters.map((s) =>
			s.id === semId ? { ...s, courses: [...s.courses, emptyCourse(cohort)] } : s
		);
	}

	function removeCourse(semId: string, courseId: string) {
		semesters = semesters.map((s) =>
			s.id === semId ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) } : s
		);
	}

	function updateCourse(semId: string, courseId: string, patch: Partial<CourseEntry>) {
		semesters = semesters.map((s) =>
			s.id === semId
				? {
						...s,
						courses: s.courses.map((c) => (c.id === courseId ? { ...c, ...patch } : c))
					}
				: s
		);
	}

	const sgpaResults = $derived(semesters.map((s) => computeSGPA(s, cohort)));
	const cgpaResult = $derived(computeCGPA(semesters, cohort));

	function formatSgpa(r: SgpaResult): string {
		if (r.status === 'ok') return r.value.toFixed(2);
		if (r.status === 'pending') return 'Pending';
		if (r.status === 'excluded') return 'Withdrawn';
		return '—';
	}

	function resetAll() {
		if (!confirm('Clear all saved GPA data? This cannot be undone.')) return;
		cohort = 'post2025';
		semesters = [emptySemester('Semester 1', 'post2025')];
		clearState();
	}
</script>

<Seo
	title="GPA Calculator"
	description="Calculate your SGPA and CGPA on the grading scale for your admission year — add courses, credits and grades semester by semester."
	image="gpa"
/>

<div class="gpa-page">
    <a href="/" class="back">← Home</a>

	<header class="gpa-header">
		
		<h1>GPA Calculator</h1>
		<p class="subtitle">
			Calculate your CGPA (Cumulative Grade Point Average) and SGPA (Semester Grade Point Average) based on the university's grading system. Add courses, credits, and grades across semesters to track your academic performance.
		</p>
	</header>

	<section class="card">
		<p>
			Letter grades have corresponding grade points assigned to them which is used to calculate your GPA. Your admission year determines which grading scale applies to you. Choose your admission year below, and the calculator will automatically apply the correct grades and grade points.
		</p>
		<div class="cohort-toggle" role="radiogroup" aria-label="Admission cohort">
			{#each Object.entries(COHORT_LABELS) as [key, label]}
				<button
					type="button"
					class:active={cohort === key}
					onclick={() => handleCohortChange(key as Cohort)}
				>
					{label}
				</button>
			{/each}
		</div>
	</section>

	<!-- Single overview section: cumulative GPA, credits done, and every semester's GPA -->
	<section class="card overview-card">
	    <div class="overview-header">
		    <div>
			    
			    <h2>Overview</h2>
		    </div>
	    </div>

	    <div class="overview-stats">
		    <div class="overview-stat primary-stat">
			    <span class="stat-label">CGPA</span>
			    <span class="stat-value">{cgpaResult.cgpa.toFixed(2)}</span>
		    </div>

            <div class="overview-stat">
                <span class="stat-label">Percentage equivalent</span>
                <span class="stat-value">{cgpaResult.percentage.toFixed(2)}%</span>
            </div>

            <div class="overview-stat">
                <span class="stat-label">Credits done</span>
                <span class="stat-value">{cgpaResult.totalCreditsEarned}</span>
            </div>
	    </div>

	    <div class="semester-overview">
		    <div class="semester-overview-header">
			    <span>Semester</span>
			    <span>SGPA</span>
		    </div>

		{#each semesters as semester, i (semester.id)}
			<div class="sem-overview-row">
				<span class="sem-overview-label">{semester.label}</span>
				<span
					class="sem-overview-sgpa"
					data-status={sgpaResults[i].status}
				>
					{formatSgpa(sgpaResults[i])}
				</span>
			</div>
		{/each}
	</div>
</section>

	{#each semesters as semester, i (semester.id)}
		<section class="card semester-card">
			<div class="semester-header">
				<input class="semester-label" bind:value={semester.label} aria-label="Semester name" />
				<span class="sgpa-badge" data-status={sgpaResults[i].status}>
					SGPA: {formatSgpa(sgpaResults[i])}
				</span>
				{#if semesters.length > 1}
					<button type="button" class="ghost danger" onclick={() => removeSemester(semester.id)}>
						Remove semester
					</button>
				{/if}
			</div>

			<div class="table-scroll">
				<table class="course-table">
					<thead>
						<tr>
							<th>Course</th>
							<th>Credits</th>
							<th>Grade</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each semester.courses as course (course.id)}
							<tr>
								<td>
									<input
										value={course.name}
										placeholder="Course name"
										oninput={(e) =>
											updateCourse(semester.id, course.id, {
												name: (e.target as HTMLInputElement).value
											})}
									/>
								</td>
								<td>
									<input
										class="credits-input"
										type="number"
										min="0"
										step="0.5"
										value={course.credits}
										oninput={(e) =>
											updateCourse(semester.id, course.id, {
												credits: Number((e.target as HTMLInputElement).value)
											})}
									/>
								</td>
								<td>
									<select
										value={course.grade}
										onchange={(e) =>
											updateCourse(semester.id, course.id, {
												grade: (e.target as HTMLSelectElement).value
											})}
									>
										<optgroup label="Letter grades">
											{#each Object.entries(GRADE_POINTS[cohort]) as [g, p]}
												<option value={g}>{g} ({p})</option>
											{/each}
										</optgroup>
										<optgroup label="Operational grades">
											{#each OPERATIONAL_GRADES as g}
												<option value={g}>{g} — {OPERATIONAL_GRADE_LABELS[g]}</option>
											{/each}
										</optgroup>
									</select>
								</td>
								<td>
									<button
										type="button"
										class="ghost danger icon-btn"
										aria-label="Remove course"
										onclick={() => removeCourse(semester.id, course.id)}
									>
										✕
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<button type="button" class="ghost" onclick={() => addCourse(semester.id)}>
				+ Add course
			</button>
		</section>
	{/each}

	<div class="actions-row">
		<button type="button" class="primary" onclick={addSemester}>+ Add semester</button>
		<button type="button" class="ghost danger" onclick={resetAll}>Reset all data</button>
	</div>

	<section class="card legend">
		<details class="legend-toggle">
			<summary>Grade points &amp; operational grades reference</summary>

			<h2>Grade points — {COHORT_LABELS[cohort]}</h2>
			<table class="legend-table">
				<thead><tr><th>Grade</th><th>Points</th></tr></thead>
				<tbody>
					{#each Object.entries(GRADE_POINTS[cohort]) as [g, p]}
						<tr><td>{g}</td><td>{p}</td></tr>
					{/each}
				</tbody>
			</table>

			<h2>Operational grades (excluded from SGPA/CGPA)</h2>
			<table class="legend-table">
				<thead><tr><th>Grade</th><th>Meaning</th></tr></thead>
				<tbody>
					{#each OPERATIONAL_GRADES as g}
						<tr><td>{g}</td><td>{OPERATIONAL_GRADE_LABELS[g]}</td></tr>
					{/each}
				</tbody>
			</table>

			<p class="note">
				'I' and 'Z' pause that semester's SGPA until converted to a letter grade. A 'W' excludes
				the whole semester. 'S', 'AP' and 'TR' count toward credits done but carry no grade
				points and don't affect SGPA/CGPA.
			</p>
		</details>

		<p class="policy-link-note">
			For a detailed explanation of the grading system, GPA calculations, and related rules, refer
			to the
			<a href="/policy-on-grading-system.pdf" target="_blank" rel="noopener noreferrer"
				>Policy on Grading System</a
			>.
		</p>

		<p class="disclaimer-note">
			This calculator gives you a quick estimate of your SGPA and CGPA. It is not a
			substitute for your official transcript. Always confirm your final grades with the
			University's records.
		</p>
	</section>
</div>

<style>
	.gpa-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		color: var(--text, #f5f5f5);
	}

	/* Header */
	.gpa-header .eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--text-secondary, #a0a0a0);
		margin: 0 0 0.25rem;
	}

	.gpa-header h1 {
		margin: 0 0 0.5rem;
		font-size: 2rem;
		color: var(--text, #f5f5f5);
	}

	.gpa-header .subtitle {
		margin: 0;
		color: var(--text-secondary, #b0b0b0);
		line-height: 1.5;
	}

	/* Cards */
	.card {
		border: 1px solid var(--border, #2a2a2a);
		border-radius: 12px;
		padding: 1.25rem;
		background: var(--bg-card, #141414);
		color: var(--text, #f5f5f5);
	}

	.card h2 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
		color: var(--text, #f5f5f5);
	}

	.card p {
		color: var(--text-secondary, #b0b0b0);
		line-height: 1.5;
	}

	/* Cohort selector */
	.cohort-toggle {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.cohort-toggle button {
		padding: 0.5rem 1rem;
		border-radius: 999px;
		border: 1px solid var(--border, #2a2a2a);
		background: var(--bg-input, #101010);
		color: var(--text, #f5f5f5);
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			color 0.2s ease;
	}

	.cohort-toggle button:hover {
		background: var(--bg-hover, #1c1c1c);
		border-color: var(--border-hover, #444);
		color: var(--text, #ffffff);
	}

	.cohort-toggle button.active {
		background: var(--accent, #4f9dff);
		border-color: var(--accent, #4f9dff);
		color: #050505;
		font-weight: 600;
	}

	/* GPA summary */
    /* Overview: GPA + percentage + credits done side by side, then semester list */
	.overview-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.overview-eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.7rem;
		color: var(--text-secondary, #a0a0a0);
		margin: 0 0 0.2rem;
	}

	.overview-header h2 {
		margin: 0;
	}

	.overview-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.overview-stat {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.9rem 1rem;
		border-radius: 10px;
		border: 1px solid var(--border, #2a2a2a);
		background: var(--bg-input, #101010);
	}

	.overview-stat.primary-stat {
		border-color: rgba(79, 157, 255, 0.4);
		background: rgba(79, 157, 255, 0.08);
	}

	.stat-label {
		font-size: 0.78rem;
		color: var(--text-secondary, #b0b0b0);
	}

	.stat-value {
		font-size: 1.7rem;
		font-weight: 700;
		color: var(--text, #f5f5f5);
	}

	.primary-stat .stat-value {
		color: var(--accent, #4f9dff);
	}

    

    .back {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.semester-overview {
		border-top: 1px solid var(--border, #2a2a2a);
		padding-top: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.semester-overview-header {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary, #808080);
		padding: 0 0.1rem 0.25rem;
	}

	.sem-overview-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0.1rem;
		border-bottom: 1px solid var(--border, #1e1e1e);
	}

	.sem-overview-row:last-child {
		border-bottom: none;
	}

	.sem-overview-label {
		color: var(--text, #f5f5f5);
		font-size: 0.9rem;
	}

	.sem-overview-sgpa {
		font-weight: 600;
		font-size: 0.85rem;
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		background: rgba(79, 157, 255, 0.15);
		color: var(--text, #f5f5f5);
		border: 1px solid rgba(79, 157, 255, 0.25);
	}

	.sem-overview-sgpa[data-status='pending'] {
		background: rgba(255, 193, 7, 0.15);
		color: #ffd75a;
		border-color: rgba(255, 193, 7, 0.3);
	}

	.sem-overview-sgpa[data-status='excluded'] {
		background: rgba(255, 90, 90, 0.15);
		color: #ff8585;
		border-color: rgba(255, 90, 90, 0.3);
	}

	@media (max-width: 600px) {
		.overview-stats {
			grid-template-columns: 1fr;
		}
	}
	

	.summary-item .label {
		font-size: 0.8rem;
		color: var(--text-secondary, #b0b0b0);
	}

	.summary-item .value {
		font-size: 1.6rem;
		font-weight: 600;
		color: var(--text, #f5f5f5);
	}

	/* Semester header */
	.semester-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}

	.semester-label {
		font-weight: 600;
		font-size: 1rem;
		background: transparent;
		color: var(--text, #f5f5f5);
		border: none;
		border-bottom: 1px solid transparent;
		padding: 0.25rem 0;
		flex: 1;
		min-width: 120px;
	}

	.semester-label::placeholder {
		color: var(--text-muted, #777);
	}

	.semester-label:focus {
		border-bottom-color: var(--accent, #4f9dff);
		outline: none;
	}

	/* SGPA badge */
	.sgpa-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
		background: rgba(79, 157, 255, 0.15);
		color: var(--text, #f5f5f5);
		font-size: 0.85rem;
		font-weight: 600;
		border: 1px solid rgba(79, 157, 255, 0.25);
	}

	.sgpa-badge[data-status='pending'] {
		background: rgba(255, 193, 7, 0.15);
		color: #ffd75a;
		border-color: rgba(255, 193, 7, 0.3);
	}

	.sgpa-badge[data-status='excluded'] {
		background: rgba(255, 90, 90, 0.15);
		color: #ff8585;
		border-color: rgba(255, 90, 90, 0.3);
	}

	/* Course table */
	.table-scroll {
		overflow-x: auto;
	}

	.course-table {
		width: 100%;
		border-collapse: collapse;
		min-width: 640px;
		color: var(--text, #f5f5f5);
	}

	.course-table th,
	.course-table td {
		padding: 0.4rem 0.5rem;
		text-align: left;
		border-bottom: 1px solid var(--border, #2a2a2a);
		font-size: 0.9rem;
		color: var(--text, #f5f5f5);
	}

	.course-table th {
		color: var(--text-secondary, #b0b0b0);
		font-weight: 600;
	}

	.course-table tbody tr:last-child td {
		border-bottom: none;
	}

	/* Inputs and selects */
	.course-table input,
	.course-table select {
		width: 100%;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid var(--border, #2a2a2a);
		background: var(--bg-input, #101010);
		color: var(--text, #f5f5f5);
		font: inherit;
		transition:
			border-color 0.2s ease,
			background 0.2s ease;
	}

	.course-table input:hover,
	.course-table select:hover {
		border-color: var(--border-hover, #444);
	}

	.course-table input:focus,
	.course-table select:focus {
		outline: none;
		border-color: var(--accent, #4f9dff);
		background: var(--bg-hover, #181818);
	}

	.course-table input::placeholder {
		color: var(--text-muted, #777);
		opacity: 1;
	}

	/* Native dropdown options */
	.course-table select option,
	.course-table select optgroup {
		background: var(--bg-card, #141414);
		color: var(--text, #f5f5f5);
	}

	.course-table select optgroup {
		font-weight: 600;
	}

	.credits-input {
		max-width: 70px;
	}

	.replace-cell {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 180px;
	}

	/* Buttons */
	.actions-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	button {
		font: inherit;
	}

	button.ghost {
		background: transparent;
		color: var(--text, #f5f5f5);
		border: 1px solid var(--border, #2a2a2a);
		border-radius: 8px;
		padding: 0.5rem 0.9rem;
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease;
	}

	button.ghost:hover {
		background: var(--bg-hover, #1c1c1c);
		border-color: var(--border-hover, #444);
		color: var(--text, #ffffff);
	}

	button.danger {
		color: #983737;
		border-color: rgba(255, 90, 90, 0.4);
	}

	button.danger:hover {
		background: rgba(255, 90, 90, 0.1);
		border-color: rgba(255, 90, 90, 0.65);
		color: #ff9090;
	}

	button.primary {
		background: var(--accent, #4f9dff);
		border: 1px solid var(--accent, #4f9dff);
		color: #050505;
		border-radius: 8px;
		padding: 0.6rem 1.1rem;
		cursor: pointer;
		font-weight: 600;
		transition:
			filter 0.2s ease,
			transform 0.2s ease;
	}

	button.primary:hover {
		filter: brightness(1.1);
		transform: translateY(-1px);
	}

	.icon-btn {
		padding: 0.3rem 0.55rem;
	}

	/* Grade legend */
	.legend-toggle {
		border: 1px solid var(--border, #2a2a2a);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		background: var(--bg-input, #101010);
	}

	.legend-toggle summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--text, #f5f5f5);
		list-style: revert;
	}

	.legend-toggle summary:hover {
		color: var(--accent, #4f9dff);
	}

	.legend-toggle[open] summary {
		margin-bottom: 0.75rem;
	}

	.legend-toggle h2 {
		margin-top: 1rem;
	}

	.legend-toggle h2:first-of-type {
		margin-top: 0.5rem;
	}

	.legend-table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1rem;
		color: var(--text, #f5f5f5);
	}

	.legend-table th,
	.legend-table td {
		padding: 0.3rem 0.5rem;
		border-bottom: 1px solid var(--border, #2a2a2a);
		font-size: 0.85rem;
		text-align: left;
		color: var(--text, #f5f5f5);
	}

	.legend-table th {
		color: var(--text-secondary, #b0b0b0);
		font-weight: 600;
	}

	.legend-table tbody tr:last-child td {
		border-bottom: none;
	}

	.note {
		font-size: 0.8rem;
		color: var(--text-secondary, #b0b0b0);
		line-height: 1.5;
		opacity: 1;
		margin: 0;
	}

	.policy-link-note {
		font-size: 0.85rem;
		color: var(--text-secondary, #b0b0b0);
		line-height: 1.5;
		margin: 0 0 0.5rem;
	}

	.policy-link-note a {
		color: var(--accent, #4f9dff);
		text-decoration: underline;
	}

	.disclaimer-note {
		font-size: 0.8rem;
		color: var(--text-secondary, #808080);
		line-height: 1.5;
		margin: 0;
	}

	/* Accessibility / keyboard visibility */
	button:focus-visible,
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--accent, #4f9dff);
		outline-offset: 2px;
	}

	/* Keep native controls readable on the dark Scooby theme */
	.course-table input,
	.course-table select,
	.semester-label {
		color-scheme: dark;
	}

	@media (max-width: 600px) {
		.gpa-page {
			padding: 3rem 1rem 2rem;
		}

		.card {
			padding: 1rem;
		}

		.course-table {
			min-width: 640px;
		}
	}
</style>