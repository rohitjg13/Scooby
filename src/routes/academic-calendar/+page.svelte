<script lang="ts">
	import Seo from "$lib/components/Seo.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	const cal = $derived(data.calendar);

	// local "today", as the same YYYY-MM-DD string the parser produces
	const today = new Date().toLocaleDateString("en-CA");

	type Day = (typeof cal.days)[number];

	const entries = $derived(cal.days.filter((d) => d.text));
	const todayEntry = $derived(cal.days.find((d) => d.date === today));
	const upcoming = $derived(entries.filter((d) => d.date >= today));
	const past = $derived(entries.filter((d) => d.date < today));

	// a week of "Mid Term Examinations" is one thing, not seven — collapse runs
	// of identical back-to-back entries into a single row.
	type Run = {
		start: string;
		end: string;
		text: string;
		category: Day["category"];
		label: string;
	};
	const runs = (list: Day[]) =>
		list.reduce<Run[]>((acc, d) => {
			const last = acc.at(-1);
			if (last && last.text === d.text && Date.parse(d.date) - Date.parse(last.end) === 86_400_000)
				last.end = d.date;
			else
				acc.push({
					start: d.date,
					end: d.date,
					text: d.text,
					category: d.category,
					label: d.label,
				});
			return acc;
		}, []);

	let showPast = $state(false);
	const listed = $derived(showPast ? runs(past).reverse() : runs(upcoming));

	const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
	const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

	const months = $derived(
		Object.values(
			cal.days.reduce<Record<string, Day[]>>((acc, d) => {
				(acc[d.date.slice(0, 7)] ??= []).push(d);
				return acc;
			}, {}),
		),
	);

	const monthLabel = (key: string) => {
		const [y, m] = key.split("-");
		return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
	};
	// how many blank cells before the 1st
	const offset = (day: Day) => new Date(day.date + "T00:00:00").getDay();

	const dayNum = (date: string) => Number(date.slice(8));

	const daysAway = (date: string) =>
		Math.round(
			(Date.parse(date + "T00:00:00") - Date.parse(today + "T00:00:00")) /
				86_400_000,
		);

	const relative = (date: string) => {
		const n = daysAway(date);
		if (n === 0) return "today";
		if (n === 1) return "tomorrow";
		if (n === -1) return "yesterday";
		return n > 0 ? `in ${n} days` : `${-n} days ago`;
	};

	const pretty = (date: string) =>
		new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
			weekday: "short",
			day: "numeric",
			month: "short",
		});

	// the PDF's own legend wording where it colour-coded the day, a plain word
	// for the rows it left white
	const FALLBACK: Record<Day["category"], string> = {
		exam: "Exam",
		break: "No class day",
		deadline: "Deadline",
		holiday: "Holiday",
		event: "Event",
	};
	const kindOf = (d: { label: string; category: Day["category"] }) =>
		d.label || FALLBACK[d.category];
	// restricted holidays are their own legend entry, so they get their own
	// colour rather than sharing the university-holiday red
	const cls = (d: { label: string; category: Day["category"] } | undefined) =>
		d ? `${d.category}${/restricted/i.test(d.label) ? " restricted" : ""}` : "";

	// upcoming rows grouped under their month, so a long list stays scannable
	const grouped = $derived(
		listed.reduce<{ key: string; items: Run[] }[]>((acc, r) => {
			const key = r.start.slice(0, 7);
			const last = acc.at(-1);
			if (last?.key === key) last.items.push(r);
			else acc.push({ key, items: [r] });
			return acc;
		}, []),
	);

	// how far through the teaching term today sits: from the day classes start
	// to the last teaching day, as the calendar itself names them, falling back
	// to the span of the whole sheet.
	const span = $derived({
		first: entries.find((d) => /start of class/i.test(d.text))?.date ?? cal.days[0]?.date ?? today,
		last:
			[...entries].reverse().find((d) => /last teaching day/i.test(d.text))?.date ??
			cal.days.at(-1)?.date ??
			today,
	});
	const total = $derived(
		Math.round((Date.parse(span.last) - Date.parse(span.first)) / 86_400_000) + 1,
	);
	const elapsed = $derived(Math.min(-daysAway(span.first) + 1, total));
	const progress = $derived(Math.min(100, Math.max(0, (elapsed / total) * 100)));
	const inSemester = $derived(today >= span.first && today <= span.last);
	const spanLabel = $derived(`${pretty(span.first)} → ${pretty(span.last)}`);
</script>

<Seo
	title="Academic Calendar"
	description="The university academic calendar — holidays, exam weeks, and every add/drop deadline, with what's coming up next."
	image="academic-calendar"
/>

<main class="page">
	<a href="/" class="back">← Home</a>

	<header class="head">
		<h1>{cal.title}</h1>
		{#each cal.notes as note}<p class="note">{note}</p>{/each}
	</header>

	<section class="hero {cls(todayEntry)}">
		<div class="hero-date">
			<span class="hero-dow">
				{new Date(today + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" })}
			</span>
			<span class="hero-num">{dayNum(today)}</span>
			<span class="hero-month">
				{new Date(today + "T00:00:00").toLocaleDateString("en-GB", { month: "long" })}
			</span>
		</div>

		<div class="hero-body">
			{#if todayEntry?.text}
				<span class="pill {cls(todayEntry)}">{kindOf(todayEntry)}</span>
				<p class="hero-text">{todayEntry.text}</p>
			{:else if todayEntry}
				<p class="hero-text muted">Nothing on the calendar — a regular day.</p>
			{:else}
				<p class="hero-text muted">Outside this calendar's semester.</p>
			{/if}

			{#if inSemester}
				<div class="bar"><span style="width: {progress}%"></span></div>
				<p class="hero-meta">Day {elapsed} of {total} · {spanLabel}</p>
			{/if}
		</div>
	</section>

	<section class="list">
		<div class="list-head">
			<h2>{showPast ? "Already happened" : "Coming up"}</h2>
			<div class="switch" role="group" aria-label="Which entries to show">
				<button class:on={!showPast} onclick={() => (showPast = false)}>Upcoming</button>
				<button class:on={showPast} onclick={() => (showPast = true)}>Past</button>
			</div>
		</div>

		{#if grouped.length}
			{#each grouped as group (group.key)}
				<h3 class="group-head">{monthLabel(group.key)}</h3>
				<ul>
					{#each group.items as d (d.start)}
						<li class="row {cls(d)}" class:now={d.start <= today && today <= d.end}>
							<span class="marker"></span>
							<div class="row-top">
								<span class="row-date">
									{pretty(d.start)}{d.end !== d.start ? ` – ${pretty(d.end)}` : ""}
								</span>
								<span class="row-rel">{relative(d.start)}</span>
								<span class="pill {cls(d)}">{kindOf(d)}</span>
							</div>
							<p class="row-text">{d.text}</p>
						</li>
					{/each}
				</ul>
			{/each}
		{:else}
			<p class="muted">Nothing here.</p>
		{/if}
	</section>

	<section class="grid-section">
		<h2>The whole semester</h2>
		<div class="legend">
			{#each cal.legend as l}
				<span class="pill {cls(l)}">{l.label}</span>
			{/each}
		</div>
		<div class="months">
			{#each months as month (month[0].date)}
				<div class="month">
					<h3>{monthLabel(month[0].date.slice(0, 7))}</h3>
					<div class="dow-row">
						{#each DOW as d}<span>{d}</span>{/each}
					</div>
					<div class="cells">
						{#each Array(offset(month[0])) as _}<span class="cell blank"></span>{/each}
						{#each month as d (d.date)}
							<span
								class="cell {d.text ? cls(d) : ''}"
								class:past={d.date < today}
								class:today={d.date === today}
								title={d.text || undefined}
							>
								{dayNum(d.date)}
							</span>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>
</main>

<style>
	/* One hue per legend entry. Everything tinted on the page — pills, rails,
	   grid cells, the hero — reads the same --cat, so a kind of day looks the
	   same wherever it turns up. */
	.exam { --cat: #a78bfa; }
	.deadline { --cat: #fbbf24; }
	.holiday { --cat: #fb7185; }
	.break { --cat: #34d399; }
	.event { --cat: #38bdf8; }
	.holiday.restricted { --cat: #f0abfc; }

	.page {
		max-width: 1040px;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 4rem;
		width: 100%;
	}

	.back {
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.85rem;
	}
	.back:hover { color: var(--text); }

	.head { margin: 1.25rem 0 1.5rem; }
	.head h1 {
		font-size: clamp(1.5rem, 5vw, 2rem);
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.note,
	.muted {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.note { margin-top: 0.5rem; max-width: 60ch; }

	h2 {
		font-size: 1.05rem;
		letter-spacing: -0.01em;
	}

	/* the coloured chip that names a kind of day */
	.pill {
		align-self: flex-start;
		font-size: 0.7rem;
		letter-spacing: 0.03em;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		white-space: nowrap;
		color: var(--cat, var(--text-secondary));
		background: color-mix(in srgb, var(--cat, var(--text-muted)) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--cat, var(--text-muted)) 30%, transparent);
	}

	/* today ------------------------------------------------------------- */
	.hero {
		display: flex;
		gap: 1.25rem;
		align-items: stretch;
		padding: 1.25rem;
		border-radius: 16px;
		border: 1px solid color-mix(in srgb, var(--cat, var(--border)) 35%, var(--border));
		background: color-mix(in srgb, var(--cat, transparent) 8%, var(--bg-card));
	}
	.hero-date {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 6rem;
		padding: 0.25rem 1.25rem 0.25rem 0.25rem;
		border-right: 1px solid var(--border);
	}
	.hero-dow,
	.hero-month {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.hero-num {
		font-size: 3rem;
		font-weight: 600;
		line-height: 1.05;
		font-family: var(--font-mono);
		color: var(--cat, var(--text));
	}
	.hero-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		justify-content: center;
		min-width: 0;
		flex: 1;
	}
	.hero-text {
		font-size: clamp(1.05rem, 3.5vw, 1.35rem);
		letter-spacing: -0.01em;
		line-height: 1.3;
	}
	.bar {
		margin-top: 0.35rem;
		height: 5px;
		border-radius: 999px;
		background: var(--bg-hover);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--cat, var(--text));
	}
	.hero-meta {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	/* the timeline ------------------------------------------------------ */
	.list { margin-top: 2.5rem; }
	.list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.switch {
		display: flex;
		padding: 2px;
		gap: 2px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg-card);
	}
	.switch button {
		border: 0;
		background: none;
		font: inherit;
		font-size: 0.78rem;
		color: var(--text-muted);
		padding: 0.3rem 0.8rem;
		border-radius: 999px;
		cursor: pointer;
	}
	.switch button.on {
		background: var(--bg-hover);
		color: var(--text);
	}

	.group-head {
		position: sticky;
		top: 0;
		z-index: 1;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
		padding: 0.6rem 0;
		background: var(--bg);
	}
	.list ul {
		list-style: none;
		margin-left: 0.35rem;
	}

	/* each entry hangs off a single vertical line, with its own dot */
	.row {
		position: relative;
		padding: 0 0 1.1rem 1.4rem;
		border-left: 1px solid var(--border);
	}
	.row:last-child {
		border-left-color: transparent;
	}
	.marker {
		position: absolute;
		left: -4.5px;
		top: 0.45rem;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--cat, var(--text-muted));
		box-shadow: 0 0 0 4px var(--bg);
	}
	.row.now > .marker {
		box-shadow:
			0 0 0 4px var(--bg),
			0 0 0 7px color-mix(in srgb, var(--cat, var(--text)) 35%, transparent);
	}
	.row-top {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.row-date {
		font-size: 0.82rem;
		font-family: var(--font-mono);
		color: var(--text-secondary);
	}
	.row-rel {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.row-top .pill { margin-left: auto; }
	.row-text {
		margin-top: 0.15rem;
		font-size: 0.98rem;
		line-height: 1.35;
	}
	.row.now .row-text { color: var(--cat, var(--text)); }

	/* month grids -------------------------------------------------------- */
	.grid-section { margin-top: 2.5rem; }
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.75rem 0 1.25rem;
	}
	.months {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
		gap: 0.85rem;
	}
	.month {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 1rem;
	}
	.month h3 {
		font-size: 0.9rem;
		margin-bottom: 0.7rem;
	}
	.dow-row,
	.cells {
		display: grid;
		/* minmax(0, 1fr), not 1fr: an aspect-ratio cell's min-content
		   contribution otherwise widens the column and a six-row month
		   (August) overflows its card. */
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 3px;
	}
	.dow-row span {
		text-align: center;
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		padding-bottom: 0.3rem;
	}
	.cell {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.78rem;
		border-radius: 8px;
		font-family: var(--font-mono);
		color: var(--text-secondary);
	}
	.cell.exam,
	.cell.holiday,
	.cell.break,
	.cell.deadline,
	.cell.event {
		color: var(--cat);
		background: color-mix(in srgb, var(--cat) 16%, transparent);
	}
	.cell.blank { visibility: hidden; }
	.cell.past { opacity: 0.4; }
	.cell.today {
		outline: 2px solid var(--text);
		outline-offset: -2px;
		color: var(--text);
	}

	@media (max-width: 640px) {
		.page { padding: 1.25rem 1rem 3rem; }
		.hero {
			flex-direction: column;
			gap: 0.9rem;
			padding: 1rem;
		}
		.hero-date {
			flex-direction: row;
			align-items: baseline;
			gap: 0.5rem;
			min-width: 0;
			padding: 0 0 0.75rem;
			border-right: 0;
			border-bottom: 1px solid var(--border);
		}
		.hero-num { font-size: 2rem; }
		.list-head {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.6rem;
		}
		.switch { width: 100%; }
		.switch button { flex: 1; }
		/* the pill drops under the date rather than squeezing it */
		.row-top .pill { margin-left: 0; }
	}
</style>
