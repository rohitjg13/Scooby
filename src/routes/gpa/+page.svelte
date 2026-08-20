<script lang="ts">
	import Seo from "$lib/components/Seo.svelte";
	import type { SemesterEntry, CourseEntry, TermEntry, Cohort } from "$lib/gpa/types";
	import {
		GRADE_POINTS,
		COHORT_LABELS,
		OPERATIONAL_GRADES,
		OPERATIONAL_GRADE_LABELS
	} from "$lib/gpa/grades";
	import {
		computeSGPA,
		computeCGPA,
		cgpaFromSgpa,
		type SgpaResult
	} from "$lib/gpa/calculator";
	import { loadState, saveState, clearState } from "$lib/gpa/storage";

	const firstGrade = (c: Cohort) => Object.keys(GRADE_POINTS[c])[0];

	const newCourse = (c: Cohort): CourseEntry => ({
		id: crypto.randomUUID(),
		name: "",
		credits: 4,
		grade: firstGrade(c)
	});

	const newSemester = (label: string, c: Cohort): SemesterEntry => ({
		id: crypto.randomUUID(),
		label,
		courses: [newCourse(c)]
	});

	const newTerm = (label: string): TermEntry => ({
		id: crypto.randomUUID(),
		label,
		sgpa: 0,
		credits: 0
	});

	let cohort = $state<Cohort>("post2025");
	let semesters = $state<SemesterEntry[]>([newSemester("Semester 1", "post2025")]);
	let mode = $state<"courses" | "sgpa">("courses");
	let terms = $state<TermEntry[]>([newTerm("Semester 1"), newTerm("Semester 2")]);
	let hydrated = $state(false);

	$effect(() => {
		const saved = loadState();
		if (saved) {
			cohort = saved.cohort;
			semesters = saved.semesters;
			if (saved.mode) mode = saved.mode;
			if (saved.terms?.length) terms = saved.terms;
		}
		hydrated = true;
	});

	$effect(() => {
		if (hydrated) saveState({ cohort, semesters, mode, terms });
	});

	const sgpas = $derived(semesters.map((s) => computeSGPA(s, cohort)));
	const cgpa = $derived(
		mode === "courses" ? computeCGPA(semesters, cohort) : cgpaFromSgpa(terms)
	);
	const scale = $derived(Object.entries(GRADE_POINTS[cohort]));

	// the two scales share letters that mean different things, so anything that
	// doesn't exist on the scale you switch to falls back to its top grade
	function switchCohort(next: Cohort) {
		const valid = new Set([...Object.keys(GRADE_POINTS[next]), ...OPERATIONAL_GRADES]);
		for (const s of semesters)
			for (const c of s.courses) if (!valid.has(c.grade)) c.grade = firstGrade(next);
		cohort = next;
	}

	function sgpaText(r: SgpaResult) {
		if (r.status === "ok") return r.value.toFixed(2);
		if (r.status === "pending") return "on hold";
		if (r.status === "excluded") return "withdrawn";
		return "—";
	}

	function resetAll() {
		if (!confirm("Clear every semester you've entered?")) return;
		cohort = "post2025";
		semesters = [newSemester("Semester 1", "post2025")];
		terms = [newTerm("Semester 1"), newTerm("Semester 2")];
		clearState();
	}
</script>

<Seo
	title="GPA Calculator"
	description="Work out your SGPA and CGPA on whichever grading scale your admission year falls under. Add courses semester by semester."
	image="gpa"
/>

<main class="gpa">
	<a href="/" class="back">← Home</a>

	<div class="top">
		<div class="score">
			<span class="score-n">{cgpa.cgpa.toFixed(2)}</span>
			<span class="score-cap">CGPA</span>
		</div>
		<dl class="facts">
			<div><dt>Percentage</dt><dd>{cgpa.percentage.toFixed(2)}%</dd></div>
			<div><dt>Credits done</dt><dd>{cgpa.totalCreditsEarned}</dd></div>
		</dl>
	</div>

	<div class="tabs" role="group" aria-label="How you're entering marks">
		<button class="tab" class:on={mode === "courses"} onclick={() => (mode = "courses")}>
			Course by course
		</button>
		<button class="tab" class:on={mode === "sgpa"} onclick={() => (mode = "sgpa")}>
			From my SGPAs
		</button>
	</div>

	{#if mode === "sgpa"}
		<p class="mode-note">
			Already know each semester's SGPA? Put it in with that semester's credits —
			CGPA is their credit-weighted average, so a heavier semester pulls harder.
		</p>

		<section class="sem">
			<div class="terms-head">
				<span>Semester</span>
				<span>SGPA</span>
				<span>Credits</span>
				<span></span>
			</div>

			{#each terms as term (term.id)}
				<div class="term">
					<input class="c-name" placeholder="Semester" bind:value={term.label} />
					<input
						class="cr-input wide"
						type="number"
						min="0"
						max="10"
						step="0.01"
						inputmode="decimal"
						bind:value={term.sgpa}
						aria-label="SGPA for {term.label || 'semester'}"
					/>
					<input
						class="cr-input wide"
						type="number"
						min="0"
						step="0.5"
						inputmode="decimal"
						bind:value={term.credits}
						aria-label="Credits for {term.label || 'semester'}"
					/>
					<button
						class="x"
						onclick={() => (terms = terms.filter((t) => t.id !== term.id))}
						disabled={terms.length === 1}
						aria-label="Remove {term.label || 'semester'}">×</button
					>
				</div>
			{/each}

			<button
				class="ghost"
				onclick={() => (terms = [...terms, newTerm(`Semester ${terms.length + 1}`)])}
			>
				+ Semester
			</button>
		</section>

		<div class="actions">
			<button class="btn btn-danger" onclick={resetAll}>Clear everything</button>
		</div>
	{:else}
	<div class="switcher" role="group" aria-label="Curriculum">
		{#each Object.entries(COHORT_LABELS) as [key, label]}
			<button
				class="curric"
				class:on={cohort === key}
				onclick={() => switchCohort(key as Cohort)}
			>
				<span class="curric-t">{key === "post2025" ? "New curriculum" : "Old curriculum"}</span>
				<span class="curric-s">{label}</span>
			</button>
		{/each}
	</div>

	<div class="scale">
		{#each scale as [letter, points]}
			<span class="chip"><b>{letter}</b>{points}</span>
		{/each}
		<span class="chip chip-muted">S · AP · TR earn credit, no points</span>
	</div>

	<details class="ltp">
		<summary>What the L:T:P on a course means</summary>
		<p>
			A course's credits come from the contact hours it asks of you every week
			for the whole semester, written as <b>L:T:P</b> — lectures, tutorials, lab
			sessions. Add the three numbers and you have the credits.
		</p>
		<p>
			So a <b>2:1:1</b> course is worth 4 credits: two lectures, one tutorial
			and one lab every week, right through the semester. A lab session normally
			runs two to three hours.
		</p>
	</details>

	{#each semesters as sem, i (sem.id)}
		<section class="sem">
			<div class="sem-top">
				<input class="sem-name" bind:value={sem.label} aria-label="Semester name" />
				<span class="sgpa" class:soft={sgpas[i].status !== "ok"}>
					{sgpaText(sgpas[i])}
					<em>SGPA</em>
				</span>
				{#if semesters.length > 1}
					<button
						class="x"
						onclick={() => (semesters = semesters.filter((s) => s.id !== sem.id))}
						aria-label="Remove {sem.label}">×</button
					>
				{/if}
			</div>

			{#if sgpas[i].status === "excluded"}
				<p class="flag">A W here withdraws the whole semester from your GPA.</p>
			{:else if sgpas[i].status === "pending"}
				<p class="flag">An I or Z holds this semester's SGPA until the grade resolves.</p>
			{/if}

			{#each sem.courses as course (course.id)}
				<div class="line">
					<input class="c-name" placeholder="Course" bind:value={course.name} />

					<label class="credits">
						<input
							class="cr-input"
							type="number"
							min="0"
							step="0.5"
							inputmode="decimal"
							bind:value={course.credits}
							aria-label="Credits"
						/>
						<span>cr</span>
					</label>

					<select class="grade" bind:value={course.grade} aria-label="Grade">
						<optgroup label="Grade">
							{#each Object.keys(GRADE_POINTS[cohort]) as g}
								<option value={g}>{g} · {GRADE_POINTS[cohort][g]}</option>
							{/each}
						</optgroup>
						<optgroup label="Other">
							{#each OPERATIONAL_GRADES as g}
								<option value={g}>{g} · {OPERATIONAL_GRADE_LABELS[g]}</option>
							{/each}
						</optgroup>
					</select>

					<button
						class="x"
						onclick={() => (sem.courses = sem.courses.filter((c) => c.id !== course.id))}
						disabled={sem.courses.length === 1}
						aria-label="Remove course">×</button
					>
				</div>
			{/each}

			<button class="ghost" onclick={() => (sem.courses = [...sem.courses, newCourse(cohort)])}>
				+ Course
			</button>
		</section>
	{/each}

	<div class="actions">
		<button
			class="btn btn-primary"
			onclick={() =>
				(semesters = [...semesters, newSemester(`Semester ${semesters.length + 1}`, cohort)])}
		>
			+ Semester
		</button>
		<button class="btn btn-danger" onclick={resetAll}>Clear everything</button>
	</div>
	{/if}

	<p class="foot">
		Rows with no course name are ignored. S, U, AP, AF, TR, R, I, Z and W never
		enter the average — they're left out of the formula rather than counted as
		zero. Saved in this browser only.
		<a href="/policy-on-grading-system.pdf" target="_blank" rel="noopener">Grading policy (PDF)</a>
	</p>
</main>

<style>
	.gpa {
		flex: 1;
		width: 100%;
		max-width: 900px;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 3rem;
	}

	.back {
		display: inline-block;
		margin-bottom: 1.25rem;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.85rem;
	}

	.back:hover {
		color: var(--text);
	}

	/* Score strip */
	.top {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding: 1.25rem 1.4rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
	}

	.score {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.score-n {
		font-family: var(--font-mono);
		font-size: 3rem;
		line-height: 1;
		letter-spacing: -0.04em;
	}

	.score-cap {
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		color: var(--text-muted);
	}

	.facts {
		display: flex;
		gap: 1.75rem;
		margin-left: auto;
		flex-wrap: wrap;
	}

	.facts dt {
		font-size: 0.65rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.facts dd {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		color: var(--text-secondary);
	}

	/* Mode tabs */
	.tabs {
		display: flex;
		gap: 0.3rem;
		margin-top: 1rem;
		padding: 0.25rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-input);
	}

	.tab {
		flex: 1;
		padding: 0.5rem;
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 0.82rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tab:hover {
		color: var(--text);
	}

	.tab.on {
		background: var(--text);
		color: var(--bg);
		font-weight: 500;
	}

	.mode-note {
		margin: 0.85rem 0 1rem;
		font-size: 0.78rem;
		line-height: 1.6;
		color: var(--text-muted);
	}

	.terms-head,
	.term {
		display: grid;
		grid-template-columns: 1fr 5rem 5rem 1.7rem;
		gap: 0.5rem;
		align-items: center;
	}

	.terms-head {
		margin-bottom: 0.5rem;
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
		text-align: center;
	}

	.terms-head span:first-child {
		text-align: left;
	}

	.term {
		margin-bottom: 0.45rem;
	}

	.wide {
		width: 100%;
	}

	/* Curriculum switch */
	.switcher {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
		margin: 1rem 0 0.75rem;
	}

	.curric {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.7rem 0.9rem;
		text-align: left;
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s;
	}

	.curric:hover {
		border-color: var(--border-hover);
		color: var(--text);
	}

	.curric.on {
		background: var(--text);
		border-color: var(--text);
		color: var(--bg);
	}

	.curric-t {
		font-size: 0.9rem;
		font-weight: 500;
	}

	.curric-s {
		font-size: 0.7rem;
		opacity: 0.7;
	}

	/* Scale chips */
	.scale {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 1.5rem;
	}

	.chip {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.chip b {
		color: var(--text-secondary);
		font-weight: 500;
	}

	.chip-muted {
		font-family: var(--font);
	}

	/* L:T:P explainer */
	.ltp {
		margin-bottom: 1rem;
		padding: 0.7rem 1rem;
		border: 1px dashed var(--border-hover);
		border-radius: var(--radius);
		font-size: 0.78rem;
		line-height: 1.65;
		color: var(--text-muted);
	}

	.ltp summary {
		cursor: pointer;
		color: var(--text-secondary);
		font-size: 0.8rem;
	}

	.ltp summary:hover {
		color: var(--text);
	}

	.ltp p {
		margin-top: 0.6rem;
	}

	.ltp b {
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-weight: 500;
	}

	/* Semester */
	.sem {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		padding: 0.9rem 1rem 1rem;
		margin-bottom: 0.9rem;
	}

	.sem-top {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding-bottom: 0.75rem;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.sem-name {
		flex: 1;
		min-width: 0;
		padding: 0.2rem 0;
		background: none;
		border: none;
		border-bottom: 1px dashed transparent;
		color: var(--text);
		font-family: var(--font);
		font-size: 1rem;
		font-weight: 500;
	}

	.sem-name:hover {
		border-bottom-color: var(--border-hover);
	}

	.sem-name:focus {
		outline: none;
		border-bottom-color: var(--text-muted);
	}

	.sgpa {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		font-family: var(--font-mono);
		font-size: 1.15rem;
	}

	.sgpa em {
		font-family: var(--font);
		font-style: normal;
		font-size: 0.6rem;
		letter-spacing: 0.12em;
		color: var(--text-muted);
	}

	.sgpa.soft {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.flag {
		margin-bottom: 0.6rem;
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	/* Course line */
	.line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.45rem;
	}

	.c-name,
	.grade,
	.cr-input {
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text);
		font-size: 0.85rem;
		padding: 0.45rem 0.6rem;
		transition: border-color 0.15s;
	}

	.c-name:focus,
	.grade:focus,
	.cr-input:focus {
		outline: none;
		border-color: var(--text-muted);
	}

	.c-name {
		flex: 1;
		min-width: 0;
	}

	.c-name::placeholder {
		color: var(--text-muted);
	}

	/* credits are whatever the course says — 1.5 and 0.5 are real */
	.credits {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex: none;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.cr-input {
		width: 3.6rem;
		text-align: center;
		font-family: var(--font-mono);
		color: var(--text-secondary);
	}

	.grade {
		width: 8.5rem;
		flex: none;
		font-family: var(--font-mono);
	}

	.x {
		flex: none;
		width: 1.7rem;
		height: 1.7rem;
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}

	.x:hover:not(:disabled) {
		border-color: var(--border);
		color: var(--text);
	}

	.x:disabled {
		opacity: 0.25;
		cursor: default;
	}

	.ghost {
		width: 100%;
		margin-top: 0.4rem;
		padding: 0.45rem;
		background: none;
		border: 1px dashed var(--border-hover);
		border-radius: var(--radius-sm);
		color: var(--text-muted);
		font-size: 0.78rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.ghost:hover {
		color: var(--text);
		border-color: var(--text-secondary);
	}

	.actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 1.25rem;
	}

	.actions .btn {
		flex: 1;
	}

	.foot {
		margin-top: 1.75rem;
		font-size: 0.75rem;
		line-height: 1.7;
		color: var(--text-muted);
	}

	.foot a {
		color: var(--text-secondary);
	}

	/* Mobile */
	@media (max-width: 640px) {
		.gpa {
			padding-top: 2rem;
		}

		.top {
			gap: 1rem;
			padding: 1rem;
		}

		.score-n {
			font-size: 2.4rem;
		}

		.facts {
			gap: 1.1rem;
			margin-left: 0;
			width: 100%;
		}

		.switcher {
			grid-template-columns: 1fr;
		}

		.terms-head,
		.term {
			grid-template-columns: 1fr 4.2rem 4.2rem 1.7rem;
		}

		/* name on its own line, controls underneath */
		.line {
			flex-wrap: wrap;
			padding-bottom: 0.6rem;
			margin-bottom: 0.6rem;
			border-bottom: 1px solid var(--border);
		}

		.c-name {
			flex: 1 0 100%;
		}

		.grade {
			width: auto;
			flex: 1 0 7rem;
		}

		.actions {
			flex-direction: column;
		}
	}
</style>
