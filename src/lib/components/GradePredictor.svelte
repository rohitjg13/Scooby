<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import CourseCard from './CourseCard.svelte';
	import { createEmptyCourse, type Course } from '$lib/grade';
	import { studentTotalPct } from '$lib/gradeCalculations';
	import { generateId } from '$lib/id';

	const STORAGE_KEY = 'grade-predictor:courses';

	let courses: Course[] = [];

	// Only one course can be expanded at a time. Expanding a course
	// automatically collapses whichever one was open before, since
	// there's only ever a single id tracked here.
	let expandedId: string | null = null;

	// Guards against overwriting saved data with the initial empty
	// array before the onMount load has actually run.
	let hydrated = false;

	onMount(() => {
		if (browser) {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw) {
					courses = JSON.parse(raw) as Course[];
				}
			} catch (e) {
				console.error('Grade Predictor: failed to load saved courses', e);
			}
		}
		hydrated = true;
	});

	// Persist on every change, once hydration has happened.
	$: if (hydrated && browser) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
		} catch (e) {
			console.error('Grade Predictor: failed to save courses', e);
		}
	}

	function addCourse() {
		const course = createEmptyCourse(generateId('course'));
		courses = [...courses, course];
		// Auto-expand the new course; this alone collapses any previously
		// expanded one since expandedId can only hold one id.
		expandedId = course.id;
	}

	function removeCourse(id: string) {
		courses = courses.filter((c) => c.id !== id);
		if (expandedId === id) expandedId = null;
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<div class="predictor-wrap">
	<header class="hero">
		<p class="eyebrow">Grades</p>
		<h1>Grade Predictor</h1>
		<p class="tagline">Predict your grade and keep track of your progress in a course.</p>
	</header>

	<section class="courses-grid" aria-label="Courses">
		{#each courses as course (course.id)}
			<div class="course-tile" class:expanded={expandedId === course.id}>
				{#if expandedId === course.id}
					<div class="tile-expanded-content">
						<CourseCard bind:course onRemove={removeCourse} />
					</div>
					<div class="expand-toggle-row">
						<button class="expand-toggle" on:click={() => toggleExpand(course.id)}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M18 15l-6-6-6 6" />
							</svg>
							Collapse
						</button>
					</div>
				{:else}
					<button
						class="tile-button"
						aria-expanded="false"
						on:click={() => toggleExpand(course.id)}
					>
						<span class="tile-top">
							<span class="tile-tag">{course.mode === 'relative' ? 'Relative' : 'Absolute'}</span>
							<span class="tile-count">
								{course.components.length}
								{course.components.length === 1 ? 'component' : 'components'}
							</span>
						</span>
						<span class="tile-name">{course.name || 'Untitled course'}</span>
						<span class="tile-bottom">
							{#if course.components.length > 0}
								<span class="tile-total">{studentTotalPct(course.components.filter((c) => !c.isFuture)).toFixed(1)}%</span>
							{:else}
								<span class="tile-total-placeholder">No components yet</span>
							{/if}
							<span class="tile-open">
								Open
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<path d="M9 6l6 6-6 6" />
								</svg>
							</span>
						</span>
					</button>
				{/if}
			</div>
		{/each}

		<button class="course-tile add-tile" on:click={addCourse}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M12 6v12M6 12h12" />
			</svg>
			Add Course
		</button>
	</section>

	{#if courses.length === 0}
		<p class="empty-state">No courses yet — tap "Add Course" to start predicting your grade.</p>
	{/if}
</div>

<style>
	.predictor-wrap {
		position: relative;
		width: 100%;
		margin: 0 auto;
		padding: 5rem 3rem 3rem;
		box-sizing: border-box;
	}

	.hero {
		text-align: center;
		margin-bottom: 3rem;
	}

	.eyebrow {
		font-family: var(--font-mono, monospace);
		font-size: 0.72rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--text-secondary, #9ca3af);
		margin-bottom: 1rem;
	}

	.hero h1 {
		font-size: clamp(2.25rem, 6vw, 3rem);
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 1;
		color: var(--text, #f5f5f5);
	}

	.tagline {
		margin: 1rem auto 0;
		max-width: 42ch;
		color: var(--text-secondary, #9ca3af);
		font-size: 1.05rem;
		line-height: 1.5;
	}

	/* Fixed 3-per-row grid that spans the full width of the container.
	   Collapsed tiles are all the same fixed height, so courses with
	   differing component counts don't distort the grid. An expanded
	   tile spans the full row width via .expanded below. */
	.courses-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2rem;
		align-items: start;
		width: 100%;
	}

	.course-tile {
		border-radius: 16px;
		display: flex;
		flex-direction: column;
	}
	.course-tile.expanded {
		grid-column: 1 / -1;
	}

	/* -- Collapsed tile: the whole card is one button -- */
	.tile-button {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 100%;
		min-height: 190px;
		padding: 1.5rem 1.6rem;
		box-sizing: border-box;
		text-align: left;
		font-family: inherit;
		color: inherit;
		cursor: pointer;
		border-radius: 16px;
		background: linear-gradient(180deg, var(--bg-card, #0d0d0d), rgba(10, 10, 10, 0.4));
		border: 1px solid var(--border, #262626);
		transition:
			border-color 0.2s ease,
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}
	.tile-button:hover,
	.tile-button:focus-visible {
		border-color: var(--border-hover, #525252);
		transform: translateY(-2px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
		outline: none;
	}
	.tile-button:focus-visible {
		border-color: var(--text, #f5f5f5);
	}

	.tile-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.tile-tag {
		font-family: var(--font-mono, monospace);
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-muted, #6b7280);
	}

	.tile-count {
		font-family: var(--font-mono, monospace);
		font-size: 0.72rem;
		color: var(--text-muted, #6b7280);
	}

	.tile-name {
		font-size: 1.4rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		color: var(--text, #f5f5f5);
		overflow-wrap: anywhere;
	}

	.tile-bottom {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-top: auto;
	}

	.tile-total {
		font-size: 2.1rem;
		font-weight: 700;
		line-height: 1;
		color: #60a5fa;
	}
	.tile-total-placeholder {
		font-size: 0.85rem;
		color: var(--text-muted, #6b7280);
		font-style: italic;
	}

	.tile-open {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
		color: var(--text-secondary, #9ca3af);
		transition: color 0.2s ease, transform 0.2s ease;
	}
	.tile-open svg {
		width: 14px;
		height: 14px;
	}
	.tile-button:hover .tile-open,
	.tile-button:focus-visible .tile-open {
		color: var(--text, #f5f5f5);
		transform: translateX(2px);
	}

	/* -- Expand / collapse control, centered at the bottom of every tile -- */
	.expand-toggle-row {
		display: flex;
		justify-content: center;
		padding: 0.75rem 1.25rem 1.25rem;
		margin-top: auto;
	}

	.expand-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: var(--bg-input, #171717);
		border: 1px solid var(--border, #2e2e2e);
		border-radius: 999px;
		color: var(--text-secondary, #d1d5db);
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		padding: 0.45rem 1.1rem;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			color 0.2s ease;
	}
	.expand-toggle:hover {
		border-color: var(--border-hover, #525252);
		color: var(--text, #f5f5f5);
	}
	.expand-toggle svg {
		width: 15px;
		height: 15px;
	}

	.tile-expanded-content {
		background: linear-gradient(180deg, var(--bg-card, #0d0d0d), rgba(10, 10, 10, 0.4));
		border: 1px solid var(--border, #262626);
		border-radius: 16px 16px 0 0;
		border-bottom: none;
	}
	.course-tile.expanded .expand-toggle-row {
		background: linear-gradient(180deg, rgba(10, 10, 10, 0.4), var(--bg-card, #0d0d0d));
		border: 1px solid var(--border, #262626);
		border-top: none;
		border-radius: 0 0 16px 16px;
		margin-top: 0;
		padding-top: 1rem;
	}

	.add-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		min-height: 190px;
		border-radius: 16px;
		background: transparent;
		border: 1px dashed var(--border, #3f3f3f);
		color: var(--text-secondary, #d1d5db);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}
	.add-tile svg {
		width: 24px;
		height: 24px;
	}
	.add-tile:hover {
		border-color: var(--border-hover, #737373);
		color: var(--text, #ffffff);
	}

	.empty-state {
		color: var(--text-muted, #6b7280);
		font-size: 0.9rem;
		margin-top: 1.5rem;
		text-align: center;
	}

	/* Drop to 2 per row, then 1 per row, as space narrows. */
	@media (max-width: 1100px) {
		.courses-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 640px) {
		.predictor-wrap {
			padding: 3rem 1rem 2rem;
		}
		.courses-grid {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}
		.course-tile.expanded {
			max-width: 100%;
		}
		.tile-button {
			min-height: 0;
			padding: 1.25rem;
		}
		.tile-name {
			font-size: 1.2rem;
		}
		.tile-total {
			font-size: 1.8rem;
		}
		.add-tile {
			min-height: 110px;
		}
	}
</style>