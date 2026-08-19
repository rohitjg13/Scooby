<script lang="ts">
	import { onMount } from "svelte";
	import {
		CourseGenerator,
		calculateStats,
		calculateCourseStats,
		type Course
	} from "$lib/attendanceCalculator";

	const STORAGE_KEY = "scooby_attendance";

	// State
	const PRESET_TARGETS = [50, 65, 70, 75];
	let targetPercentage = $state(75);
	let customTarget = $state('');
	let showTargetPicker = $state(false);
	let stateLoaded = $state(false);

	function setPreset(val: number) {
		targetPercentage = val;
		customTarget = '';
		showTargetPicker = false;
	}

	function applyCustom() {
		const n = parseFloat(customTarget);
		if (!isNaN(n) && n > 0 && n <= 100) {
			targetPercentage = n;
			showTargetPicker = false;
		}
	}

	function closeOnOutsideClick(node: HTMLElement) {
		function handle(e: MouseEvent) {
			if (!node.contains(e.target as Node)) showTargetPicker = false;
		}
		document.addEventListener('click', handle, true);
		return { destroy() { document.removeEventListener('click', handle, true); } };
	}

	let courses = $state<Course[]>([
		CourseGenerator()
	]);

	function addCourse() {
		courses.push(CourseGenerator());
	}

	function deleteCourse(id: string) {
		if (courses.length === 1) {
			courses = [CourseGenerator()];
		} else {
			courses = courses.filter((c) => c.id !== id);
		}
	}

	function selectOnFocus(e: FocusEvent) {
		(e.currentTarget as HTMLInputElement).select();
	}

	function isValidCourse(c: unknown): c is Course {
		if (!c || typeof c !== 'object') return false;
		const course = c as Course;
		return (
			typeof course.id === 'string' &&
			typeof course.title === 'string' &&
			typeof course.leaves === 'number' &&
			Array.isArray(course.Components) &&
			course.Components.length === 3
		);
	}

	onMount(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const data = JSON.parse(saved);
				if (typeof data.targetPercentage === 'number' && data.targetPercentage > 0 && data.targetPercentage <= 100) {
					targetPercentage = data.targetPercentage;
				}
				if (Array.isArray(data.courses) && data.courses.length > 0 && data.courses.every(isValidCourse)) {
					courses = data.courses;
				}
			}
		} catch (e) {
			console.error("Failed to restore attendance state", e);
		} finally {
			stateLoaded = true;
		}
	});

	$effect(() => {
		if (!stateLoaded) return;
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ targetPercentage, courses })
		);
	});
</script>

<div class="calc-wrap">
	<!-- Header -->
	<header class="header">
		<div class="header-left">
			<a href="/" class="btn btn-sm">← Home</a>
			<h1>Attendance Calculator</h1>
		</div>

		<div class="header-right">
			<!-- Target % Picker -->
			<div class="target-picker-wrap" use:closeOnOutsideClick>
				<button
					type="button"
					class="btn btn-sm"
					onclick={() => (showTargetPicker = !showTargetPicker)}
					aria-expanded={showTargetPicker}
				>
					Target: <strong>{targetPercentage}%</strong>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron" class:open={showTargetPicker}>
						<path d="M6 9l6 6 6-6" />
					</svg>
				</button>

				{#if showTargetPicker}
					<div class="target-picker-panel">
						<p class="picker-label">Preset targets</p>
						<div class="preset-options">
							{#each PRESET_TARGETS as preset}
								<label class="preset-option" class:active={targetPercentage === preset && customTarget === ''}>
									<input
										type="radio"
										name="target-preset"
										value={preset}
										checked={targetPercentage === preset && customTarget === ''}
										onchange={() => setPreset(preset)}
									/>
									{preset}%
								</label>
							{/each}
						</div>
						<p class="picker-label">Custom</p>
						<div class="custom-target-row">
							<input
								type="number"
								min="1"
								max="100"
								placeholder="e.g. 80"
								class="input custom-target-input"
								bind:value={customTarget}
								onfocus={selectOnFocus}
								onkeydown={(e) => e.key === 'Enter' && applyCustom()}
							/>
							<button type="button" class="btn btn-primary btn-sm" onclick={applyCustom}>Set</button>
						</div>
					</div>
				{/if}
			</div>

			<button type="button" class="btn btn-primary btn-sm" onclick={addCourse}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-sm">
					<path d="M12 5v14M5 12h14" />
				</svg>
				Add Course
			</button>
		</div>
	</header>

	<!-- Cards Grid -->
	<div class="cards-grid">
		{#each courses as course (course.id)}
			{@const overallStats = calculateCourseStats(course, targetPercentage)}

			<div class="course-card">
				<!-- Course Top Bar -->
				<div class="course-header">
					<input
						type="text"
						class="input course-title-input"
						placeholder="Course Name..."
						bind:value={course.title}
					/>
					<button
						type="button"
						class="btn btn-sm btn-danger"
						onclick={() => deleteCourse(course.id)}
						title="Remove Course"
						aria-label="Remove Course"
					>
						✕
					</button>
				</div>

				<!-- Table of Components -->
				<div class="comp-table">
					<div class="table-header-row">
						<span class="col-type"></span>
						<span class="col-head">Attended</span>
						<span class="col-slash"></span>
						<span class="col-head">Total</span>
						<span class="col-head">Pending</span>
					</div>

					{#each course.Components as comp}
						<div class="table-data-row">
							<span class="comp-label">{comp.type === 'PRAC' ? 'PRA' : comp.type}</span>
							<input
								type="number"
								step="any"
								min="0"
								class="num-input"
								onfocus={selectOnFocus}
								bind:value={comp.attended}
							/>
							<span class="slash">/</span>
							<input
								type="number"
								step="any"
								min="0"
								class="num-input"
								onfocus={selectOnFocus}
								bind:value={comp.totalSoFar}
							/>
							<input
								type="number"
								step="any"
								min="0"
								class="num-input"
								onfocus={selectOnFocus}
								bind:value={comp.remaining}
							/>
						</div>
					{/each}
					<div class="table-data-row">
						<span class="comp-label">LVS</span>
						<input
							type="number"
							step="any"
							min="0"
							class="num-input"
							onfocus={selectOnFocus}
							bind:value={course.leaves}
						/>
					</div>
				</div>

				<!-- Stats Summary List -->
				<div class="stats-summary">
					<div class="stat-line">
						<span class="stat-label">Current</span>
						<span class="stat-value">{overallStats.currentPercentage.toFixed(2)}%</span>
					</div>
					<div class="stat-line">
						<span class="stat-label">Best case</span>
						<span class="stat-value">{overallStats.bestCasePercentage.toFixed(2)}%</span>
					</div>
					<div class="stat-line">
						<span class="stat-label">Worst case</span>
						<span class="stat-value">{overallStats.worstCasePercentage.toFixed(2)}%</span>
					</div>
					<div class="stat-line">
						<span class="stat-label">Hours left to target</span>
						<span class="stat-value">{overallStats.hoursLeft.toFixed(2)}</span>
					</div>
					<div class="stat-line">
						{#if overallStats.isMeetingTarget}
							<span class="stat-label">Safe to miss (hrs)</span>
							<span class="stat-value">{overallStats.marginHours.toFixed(2)}</span>
						{:else}
							<span class="stat-label">Need to attend (hrs)</span>
							<span class="stat-value">{overallStats.neededHours.toFixed(2)}</span>
						{/if}
					</div>
				</div>

				<!-- Bottom Status -->
				<div class="status-badge" class:safe={overallStats.bestCasePercentage >= targetPercentage} class:danger={overallStats.bestCasePercentage < targetPercentage}>
					{#if overallStats.bestCasePercentage >= targetPercentage}
						Can reach {targetPercentage}%
					{:else}
						Cannot reach {targetPercentage}%
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	/* ── Layout ──────────────────────────────────── */
	.calc-wrap {
		width: 100%;
		max-width: 1080px;
		margin: 0 auto;
		min-height: 100vh;
	}

	/* ── Header ──────────────────────────────────── */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-left h1 {
		font-size: 1.1rem;
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.icon-sm {
		width: 14px;
		height: 14px;
	}

	/* ── Target Picker ───────────────────────────── */
	.target-picker-wrap {
		position: relative;
	}

	.chevron {
		width: 13px;
		height: 13px;
		transition: transform 0.18s;
		opacity: 0.6;
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.target-picker-panel {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.875rem;
		min-width: 190px;
		z-index: 100;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		animation: fadeDown 0.13s ease;
	}

	@keyframes fadeDown {
		from { opacity: 0; transform: translateY(-5px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	.picker-label {
		font-family: var(--font-mono);
		font-size: 0.67rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		margin: 0 0 0.45rem;
	}

	.preset-options + .picker-label {
		margin-top: 0.75rem;
	}

	.preset-options {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.preset-option {
		display: inline-flex;
		align-items: center;
		padding: 0.3rem 0.65rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--bg-input);
		color: var(--text-secondary);
		font-size: 0.82rem;
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
	}

	.preset-option input[type="radio"] {
		display: none;
	}

	.preset-option:hover {
		border-color: var(--border-hover);
		color: var(--text);
	}

	.preset-option.active {
		border-color: var(--text);
		color: var(--text);
	}

	.custom-target-row {
		display: flex;
		gap: 0.35rem;
		margin-top: 0.45rem;
	}

	.custom-target-input {
		padding: 0.35rem 0.6rem !important;
		font-size: 0.82rem !important;
	}

	/* ── Content area ────────────────────────────── */
	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
		gap: 1.25rem;
		padding: 1.5rem;
	}

	@media (max-width: 480px) {
		.cards-grid { grid-template-columns: 1fr; }
		.header { padding: 0.75rem 1rem; }
	}

	/* ── Course Card ─────────────────────────────── */
	.course-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.course-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.course-title-input {
		flex: 1;
		font-size: 0.9rem !important;
		padding: 0.55rem 0.85rem !important;
	}

	/* ── Component Table ─────────────────────────── */
	.comp-table {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.table-header-row {
		display: grid;
		grid-template-columns: 36px 1fr 12px 1fr 1fr;
		align-items: center;
		text-align: center;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 0 0.1rem;
	}

	.col-head { text-align: center; }

	.table-data-row {
		display: grid;
		grid-template-columns: 36px 1fr 12px 1fr 1fr;
		align-items: center;
		gap: 0.3rem;
	}

	.comp-label {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.num-input {
		width: 100%;
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text);
		padding: 0.4rem 0.5rem;
		font-size: 0.875rem;
		font-family: var(--font-mono);
		outline: none;
		text-align: center;
		transition: border-color 0.15s;
	}

	.num-input:focus {
		border-color: var(--border-hover);
	}

	.slash {
		color: var(--text-muted);
		text-align: center;
		font-size: 0.85rem;
	}

	/* ── Stats ───────────────────────────────────── */
	.stats-summary {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-top: 0.25rem;
		border-top: 1px solid var(--border);
	}

	.stat-line {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}

	.stat-label {
		font-size: 0.82rem;
		color: var(--text-secondary);
	}

	.stat-value {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--text);
		white-space: nowrap;
	}

	/* ── Status badge ────────────────────────────── */
	.status-badge {
		display: inline-flex;
		align-self: flex-start;
		padding: 0.2rem 0.55rem;
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		border: 1px solid;
	}

	.status-badge.safe {
		color: #4ade80;
		border-color: rgba(74, 222, 128, 0.3);
		background: rgba(74, 222, 128, 0.06);
	}

	.status-badge.danger {
		color: #f87171;
		border-color: rgba(248, 113, 113, 0.3);
		background: rgba(248, 113, 113, 0.06);
	}
</style>
