<script lang="ts">
	import Seo from "$lib/components/Seo.svelte";
	import { newCourse, stats, statsFor, courseTotals, type Course } from "$lib/attendance";
	import {
		remainingDays,
		totalDays,
		WEEKDAYS,
		DAY_NAMES,
		SEM_START
	} from "$lib/semester";

	const KEY = "scooby.attendance";
	const PRESETS = [75, 70, 65, 50];

	let courses = $state<Course[]>([newCourse()]);
	let target = $state(75);

	// ponytail: localStorage, not a server store — it's your own numbers on your own device.
	$effect(() => {
		const saved = localStorage.getItem(KEY);
		if (!saved) return;
		try {
			const v = JSON.parse(saved);
			if (
				Array.isArray(v.courses) &&
				v.courses.length &&
				v.courses[0].components?.[0]?.missed !== undefined
			)
				courses = v.courses;
			if (typeof v.target === "number") target = v.target;
		} catch {
			// corrupt blob, start clean
		}
	});

	$effect(() => {
		localStorage.setItem(KEY, JSON.stringify({ courses, target }));
	});

	const fmt = (n: number) => n.toFixed(1);
	// counts stay classes until some component says a class is worth more than an hour
	const unit = (c: Course) => (c.components.every((k) => k.hrs === 1) ? "" : " hrs");

	// teaching days left, and how many of them are yours
	const left = remainingDays();
	let picked = $state<number[]>([]);
	const myDays = $derived(picked.reduce((n, d) => n + left[d], 0));

	const toggle = (d: number) =>
		(picked = picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d]);

	const bump = (comp: { attended: number }, by: number) =>
		(comp.attended = Math.max(0, (comp.attended || 0) + by));

	function remove(id: string) {
		courses = courses.filter((c) => c.id !== id);
		if (!courses.length) courses = [newCourse()];
	}
</script>

<Seo
	title="Attendance Calculator"
	description="See where your attendance stands across LEC, TUT and PRAC, how far behind you are, and how many classes you can still afford to skip."
	image="attendance-calculator"
/>

<main class="att">
	<header class="att-head">
		<a href="/" class="back">← Home</a>
		<h1>Attendance Calculator</h1>
		<p class="sub">
			One card per course. Fill in each component and it tells you how many
			classes you still have to make, and how many you can skip.
		</p>
	</header>

	<div class="warn">
		<p>
			Shiv Nadar IoE expects you at every scheduled class. Nothing below is an
			allowance to skip — the only absences you're permitted are the ones covered
			by a waiver you've actually been granted. This page just does the
			arithmetic on where that leaves you.
		</p>
	</div>

	<div class="howto">
		<h2>Where to get your numbers</h2>
		<p>
			<a href="https://snulinks.snu.edu.in/" target="_blank" rel="noopener">SNU Links</a>
			→ <b>Student Attendance Recording</b> → <b>Reports</b> → <b>Summary</b>.
			Read the <b>Attendance</b> column: that's what you've attended and what's
			been held so far. <b>Missed</b> below is the difference between the two.
		</p>
	</div>

	<div class="bar">
		<label for="target">Target</label>
		<input
			id="target"
			class="input target-input"
			type="number"
			min="1"
			max="100"
			bind:value={target}
		/>
		<span class="pcnt">%</span>
		<div class="presets">
			{#each PRESETS as preset}
				<button
					class="btn btn-sm"
					class:on={target === preset}
					onclick={() => (target = preset)}>{preset}%</button
				>
			{/each}
		</div>
	</div>

	<section class="sem">
		<div class="sem-head">
			<span class="sem-count">{totalDays(left)}</span>
			<span class="sem-label">
				teaching days left this semester
				<span class="sem-sub">since {SEM_START}</span>
			</span>
		</div>

		<p class="sem-hint">Tap the days your class meets</p>

		<div class="days">
			{#each WEEKDAYS as d}
				<button
					class="day"
					class:on={picked.includes(d)}
					onclick={() => toggle(d)}
					aria-pressed={picked.includes(d)}
					title="{left[d]} {DAY_NAMES[d]}s left this semester"
				>
					<span class="tick">{picked.includes(d) ? "✓" : "+"}</span>
					<span class="day-name">{DAY_NAMES[d]}</span>
					<span class="day-n">{left[d]}</span>
					<span class="day-unit">left</span>
				</button>
			{/each}
		</div>

		<div class="sem-out" class:live={picked.length > 0}>
			{#if picked.length}
				<span class="sem-out-n">{myDays}</span>
				<span>
					more classes this semester
					<span class="sem-out-sub">
						{picked.map((d) => `${DAY_NAMES[d]} ${left[d]}`).join(" + ")}
					</span>
				</span>
			{:else}
				<span class="sem-out-idle">
					Pick your days above and you'll get the number to put in "Left".
				</span>
			{/if}
		</div>
	</section>

	<div class="cards">
		{#each courses as course (course.id)}
			{@const s = stats(course, target)}
			{@const t = courseTotals(course)}
			<section class="card">
				<div class="card-head">
					<input
						class="input name"
						placeholder="Course name (optional)"
						bind:value={course.name}
					/>
					<button
						class="btn btn-sm btn-danger"
						onclick={() => remove(course.id)}
						aria-label="Remove course">Remove</button
					>
				</div>

				<div class="grid grid-head">
					<span></span>
					<span>Attended</span>
					<span>Missed</span>
					<span>Left</span>
					<span title="Menstrual or medical leave — doesn't count against you">
						Excused
						<span class="sub-label">leave</span>
					</span>
					<span>Hrs each</span>
					<span class="col-pct">Now</span>
				</div>

				{#each course.components as comp (comp.type)}
					{@const cs = statsFor(comp.attended, comp.missed, comp.remaining, target)}
					<div class="grid">
						<span class="ctype">{comp.type}</span>
						<label>
							<span class="m-label">Attended</span>
							<span class="stepper">
								<button
									class="step"
									onclick={() => bump(comp, -1)}
									aria-label="One less {comp.type} attended">−</button
								>
								<input class="input n" type="number" min="0" bind:value={comp.attended} />
								<button
									class="step"
									onclick={() => bump(comp, 1)}
									aria-label="One more {comp.type} attended">+</button
								>
							</span>
						</label>
						<label>
							<span class="m-label">Missed</span>
							<input class="input n" type="number" min="0" bind:value={comp.missed} />
						</label>
						<label>
							<span class="m-label">Left</span>
							<input class="input n" type="number" min="0" bind:value={comp.remaining} />
						</label>
						<label>
							<span class="m-label">Excused (leave)</span>
							<input
								class="input n"
								type="number"
								min="0"
								title="Menstrual or medical leave — counts as neither attended nor missed"
								bind:value={comp.leaves}
							/>
						</label>
						<label>
							<span class="m-label">Hrs each</span>
							<input class="input n hrs" type="number" min="0" step="0.5" bind:value={comp.hrs} />
						</label>
						<span class="col-pct mono" class:bad={cs.current !== null && cs.current < target}>
							{cs.current === null ? "—" : fmt(cs.current) + "%"}
						</span>
					</div>
				{/each}

				<p class="card-hint">
					<b>Excused</b> = menstrual or medical leave. It counts as neither
					attended nor missed, so it never drags your percentage down.
				</p>

				<div class="out">
					<div class="big" class:bad={s.current !== null && s.current < target}>
						{s.current === null ? "—" : fmt(s.current) + "%"}
						<span class="big-label">course total</span>
					</div>
					<div class="range">
						<span>Best case <b>{fmt(s.best)}%</b></span>
						<span>Skip everything left <b>{fmt(s.worst)}%</b></span>
						<span>
							Counted <b>{fmt(t.attended + t.missed)}</b>{#if t.leaves > 0}
								· excused <b>{fmt(t.leaves)}</b>{/if}
						</span>
					</div>
				</div>

				<p class="verdict" class:bad={s.impossible}>
					{#if s.impossible}
						Can't reach {target}% any more — best you can finish at is {fmt(s.best)}%.
					{:else if s.mustAttend > 0}
						Attend <b>{fmt(s.mustAttend)}{unit(course)}</b> of what's left
						{#if s.canSkip > 0}— you can skip <b>{fmt(s.canSkip)}{unit(course)}</b>.
						{:else}— every single one.{/if}
					{:else if s.canSkip > 0}
						You're clear. You can skip <b>{fmt(s.canSkip)}{unit(course)}</b> more and
						still hold {target}%.
					{:else}
						Nothing left to attend.
					{/if}
				</p>
			</section>
		{/each}
	</div>

	<button class="btn add" onclick={() => (courses = [...courses, newCourse()])}>
		+ Add course
	</button>

	<div class="note">
		<p>
			<b>Missed</b> — classes that count against you. <b>Excused</b> — menstrual
			or medical leave: those go in their own box and count as neither attended
			nor missed, so they never touch your percentage.
		</p>
		<p>
			<b>Hrs each</b> — how many hours one class of that component is worth.
			Leave it at 1 to type hours straight in; set it to 2 if a practical counts
			as two hours and you'd rather count sessions.
		</p>
		<p>
			LEC, TUT and PRAC are added up, since attendance is judged on the course
			total. Saved in this browser only.
		</p>
	</div>
</main>

<style>
	.att {
		flex: 1;
		width: 100%;
		max-width: 1140px;
		margin: 0 auto;
		padding: 4rem 1.5rem 3rem;
	}

	.att-head {
		margin-bottom: 2rem;
	}

	.back {
		display: inline-block;
		margin-bottom: 1rem;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.85rem;
	}

	.back:hover {
		color: var(--text);
	}

	.sub {
		margin-top: 0.5rem;
		color: var(--text-secondary);
		font-size: 0.9rem;
		max-width: 60ch;
	}

	.warn {
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		padding: 0.85rem 1rem;
		margin-bottom: 0.75rem;
		font-size: 0.8rem;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.howto {
		border: 1px dashed var(--border-hover);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		margin-bottom: 1.25rem;
		font-size: 0.8rem;
		line-height: 1.7;
		color: var(--text-muted);
	}

	.howto h2 {
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 0.3rem;
	}

	.howto b {
		color: var(--text-secondary);
		font-weight: 500;
	}

	.howto a {
		color: var(--text);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.target-input {
		width: 5rem;
	}

	.pcnt {
		margin-left: -0.25rem;
	}

	.presets {
		display: flex;
		gap: 0.4rem;
		margin-left: auto;
	}

	.presets .on {
		background: var(--text);
		color: var(--bg);
		border-color: var(--text);
	}

	/* Semester day counter */
	.sem {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem 1.25rem;
		margin-bottom: 1rem;
	}

	.sem-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.sem-count {
		font-family: var(--font-mono);
		font-size: 1.75rem;
		letter-spacing: -0.02em;
	}

	.sem-label {
		display: flex;
		flex-direction: column;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.sem-sub {
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	.sem-hint {
		margin-top: 1rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.days {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.day {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		padding: 0.55rem 0.2rem 0.5rem;
		background: var(--bg-input);
		border: 1px dashed var(--border-hover);
		border-radius: var(--radius);
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s;
	}

	.day:hover {
		border-color: var(--text-secondary);
		color: var(--text);
		transform: translateY(-1px);
	}

	.day.on {
		background: var(--text);
		border-style: solid;
		border-color: var(--text);
		color: var(--bg);
	}

	.tick {
		position: absolute;
		top: 0.25rem;
		right: 0.35rem;
		font-size: 0.6rem;
		line-height: 1;
		opacity: 0.45;
	}

	.day.on .tick {
		opacity: 1;
	}

	.day-name {
		font-size: 0.7rem;
		letter-spacing: 0.04em;
	}

	.day-n {
		font-family: var(--font-mono);
		font-size: 1.35rem;
		line-height: 1.2;
	}

	.day-unit {
		font-size: 0.58rem;
		opacity: 0.6;
	}

	.sem-out {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.9rem;
		padding-top: 0.85rem;
		border-top: 1px solid var(--border);
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.sem-out-n {
		font-family: var(--font-mono);
		font-size: 1.75rem;
		color: var(--text);
		letter-spacing: -0.02em;
	}

	.sem-out span {
		display: block;
	}

	.sem-out-sub {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	.sem-out-idle {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	/* two courses side by side once there's room, instead of one long column */
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(28rem, 1fr));
		gap: 1rem;
		align-items: start;
	}

	.card {
		/* without this the inputs' intrinsic width pushes cards past their track,
		   and the row overflows wider than the semester box above it */
		min-width: 0;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1.25rem;
	}

	.card-head {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 1rem;
	}

	.name {
		font-weight: 500;
	}

	.grid {
		display: grid;
		min-width: 0;
		grid-template-columns: 2.8rem 1.7fr repeat(4, 1fr) 3.2rem;
		gap: 0.4rem;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.grid-head {
		font-size: 0.66rem;
		color: var(--text-muted);
		margin-bottom: 0.3rem;
		text-align: center;
	}

	.grid-head .col-pct {
		text-align: right;
	}

	.grid label {
		min-width: 0;
	}

	.ctype {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-secondary);
	}

	.n {
		min-width: 0;
		padding: 0.45rem 0.25rem;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.stepper {
		display: flex;
		align-items: stretch;
		gap: 0.15rem;
	}

	.stepper .n {
		flex: 1;
		min-width: 0;
	}

	.step {
		flex: none;
		width: 1.5rem;
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-size: 0.9rem;
		line-height: 1;
		cursor: pointer;
		transition: all 0.15s;
	}

	.step:hover {
		background: var(--bg-hover);
		border-color: var(--border-hover);
		color: var(--text);
	}

	.step:active {
		background: var(--text);
		color: var(--bg);
	}

	/* set-once, so it recedes */
	.hrs {
		background: transparent;
		color: var(--text-secondary);
	}

	.sub-label {
		display: block;
		font-size: 0.58rem;
		opacity: 0.75;
	}

	.card-hint {
		margin-top: 0.65rem;
		font-size: 0.7rem;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.card-hint b {
		color: var(--text-secondary);
		font-weight: 500;
	}

	.col-pct {
		text-align: right;
		font-size: 0.78rem;
	}

	.mono {
		font-family: var(--font-mono);
		color: var(--text-secondary);
	}

	.mono.bad {
		color: var(--text-muted);
	}

	/* per-field labels only appear once the grid stacks on narrow screens */
	.m-label {
		display: none;
	}

	.out {
		display: flex;
		align-items: baseline;
		gap: 1.25rem;
		flex-wrap: wrap;
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.big {
		font-family: var(--font-mono);
		font-size: 1.75rem;
		letter-spacing: -0.02em;
	}

	.big.bad {
		color: var(--text-secondary);
	}

	.big-label {
		font-family: var(--font);
		font-size: 0.7rem;
		color: var(--text-muted);
		margin-left: 0.4rem;
	}

	.range {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.range b {
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-weight: 500;
	}

	.verdict {
		margin-top: 0.9rem;
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.verdict b {
		color: var(--text);
	}

	.verdict.bad {
		color: var(--text-muted);
	}

	.add {
		width: 100%;
		margin-top: 1rem;
	}

	.note {
		margin-top: 1.5rem;
		font-size: 0.78rem;
		line-height: 1.6;
		color: var(--text-muted);
		max-width: 65ch;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.note b {
		color: var(--text-secondary);
		font-weight: 500;
	}

	@media (max-width: 560px) {
		.grid-head {
			display: none;
		}

		/* six units so the five fields split 3 + 2 evenly instead of trailing a
		   ragged half-row */
		.grid {
			grid-template-columns: repeat(6, 1fr);
			gap: 0.5rem;
			padding-bottom: 0.75rem;
			margin-bottom: 0.75rem;
			border-bottom: 1px solid var(--border);
		}

		.ctype {
			grid-column: 1 / 5;
		}

		.col-pct {
			grid-column: 5 / 7;
			grid-row: 1;
		}

		.grid label {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
			grid-column: span 2;
			min-width: 0;
		}

		.step {
			width: 1.9rem;
		}

		.grid label:nth-of-type(4),
		.grid label:nth-of-type(5) {
			grid-column: span 3;
		}

		.m-label {
			display: block;
			font-size: 0.68rem;
			color: var(--text-muted);
			white-space: nowrap;
		}
	}
</style>
