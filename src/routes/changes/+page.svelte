<script lang="ts">
	import { page } from "$app/state";
	import Seo from "$lib/components/Seo.svelte";
	import data from "$lib/data/ttchanges.json";

	const { versions, pairs } = data;

	// Query param rather than local state, so a particular revision can be
	// linked and the server renders it — same pattern as /minors.
	const i = $derived(
		Math.min(Math.max(Number(page.url.searchParams.get("v") ?? pairs.length - 1) || 0, 0), pairs.length - 1),
	);
	const pair = $derived(pairs[i]);

	const KINDS = ["added", "removed", "changed"] as const;
	// "2026-08-09 7:25 PM" -> "9th Aug, 7:25 PM". Every version is from this
	// term, so the year is noise.
	const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
	function pretty(stamp: string) {
		const m = stamp.match(/^\d{4}-(\d\d)-(\d\d)(.*)$/);
		if (!m) return stamp;
		const day = +m[2];
		const th = day % 100 >= 11 && day % 100 <= 13
			? "th"
			: ["th", "st", "nd", "rd"][day % 10] ?? "th";
		return `${day}${th} ${MONTHS[+m[1] - 1]}${m[3] ? `,${m[3]}` : ""}`;
	}

	// keyed loosely: the kinds come off a JSON import, so they read as strings
	const MARK: Record<string, string> = { added: "+", removed: "−", changed: "~" };

	let hidden = $state(new Set<string>());
	let query = $state("");

	const toggle = (k: string) => {
		const next = new Set(hidden);
		next.has(k) ? next.delete(k) : next.add(k);
		hidden = next;
	};

	const q = $derived(query.trim().toLowerCase());
	const rows = $derived(
		pair.changes.filter(
			(c) =>
				!hidden.has(c.kind) &&
				(!q ||
					`${c.code} ${c.name} ${c.at}`.toLowerCase().includes(q) ||
					c.deltas.some((d) => d.join(" ").toLowerCase().includes(q))),
		),
	);

	// Consecutive rows of the same course read as one block, as in the PDF report.
	const groups = $derived(
		rows.reduce<(typeof rows)[]>((acc, r) => {
			const last = acc.at(-1);
			if (last && last[0].code === r.code) last.push(r);
			else acc.push([r]);
			return acc;
		}, []),
	);
</script>

<Seo
	title="Timetable Changes"
	description="Every change the university has made to the Monsoon 2026 timetable, version by version — what moved, when, and from what to what."
	image="changes"
/>

<main>
	<header class="top">
		<a href="/" class="home-link" title="Back to Scooby home">←</a>
		<div>
			<h1>Timetable Changes</h1>
			<p class="sub">
				{versions.length} versions received so far. Every difference between
				consecutive ones, read straight from the files.
			</p>
		</div>
	</header>

	<!-- Timeline: one entry per revision, newest first — the latest drop is what
	     anyone is here for, so it leads and is the default. -->
	<nav class="timeline" aria-label="Revisions">
		{#each pairs.map((p, n) => ({ p, n })).reverse() as { p, n }}
			<a
				class="step"
				class:active={n === i}
				href="?v={n}"
				title="{p.from} → {p.to}"
			>
				<span class="step-title">{p.from} → {p.to}</span>
				<span class="step-when">{pretty(versions[n + 1].stamp)}</span>
				<span class="step-counts">
					{#if p.added}<span class="c-added">+{p.added}</span>{/if}
					{#if p.removed}<span class="c-removed">−{p.removed}</span>{/if}
					{#if p.changed}<span class="c-changed">~{p.changed}</span>{/if}
					{#if !p.added && !p.removed && !p.changed}<span class="c-none">no change</span>{/if}
				</span>
			</a>
		{/each}
	</nav>

	<section class="summary">
		<h2>{pair.from} → {pair.to}</h2>
		<p class="meta">
			{pretty(versions[i].stamp)} → {pretty(versions[i + 1].stamp)}
			· {pair.oldCount} class rows → {pair.newCount}
			{#if pair.newCourses || pair.goneCourses}
				· {pair.newCourses} new course codes, {pair.goneCourses} dropped
			{/if}
		</p>

		{#if pair.crossFormat}
			<p class="note">Excel ↔ JSON</p>
		{/if}

		<div class="controls">
			<div class="chips">
				{#each KINDS as k}
					<button
						class="chip"
						class:off={hidden.has(k)}
						onclick={() => toggle(k)}
						aria-pressed={!hidden.has(k)}
						title="Show or hide {k} classes"
					>
						{MARK[k]} {pair[k]} {k}
					</button>
				{/each}
			</div>
			<input
				class="input search"
				type="search"
				bind:value={query}
				placeholder="Search by course code, course name, faculty..."
			/>
		</div>

		{#if pair.fields.length}
			<div class="chips fields">
				{#each pair.fields as [f, n]}
					<span class="chip soft">{f} <b>{n}</b></span>
				{/each}
			</div>
		{/if}
	</section>

	{#if groups.length === 0}
		<p class="nothing">
			{pair.changes.length === 0
				? "No differences — the file changed but the parsed timetable is identical."
				: "Nothing here matches those filters."}
		</p>
	{/if}

	<div class="groups">
		{#each groups as g}
			<article class="group">
				<h3>
					<span class="code">{g[0].code}</span>
					{#if g[0].name}<span class="cname">{g[0].name}</span>{/if}
				</h3>
				{#each g as r}
					<div class="row">
						<span class="kind k-{r.kind}">{MARK[r.kind]} {r.kind}</span>
						<div class="row-body">
							<p class="at">{r.at}</p>
							{#if r.deltas.length}
								<dl class="deltas">
									{#each r.deltas as [label, before, after]}
										<dt>{label}</dt>
										<dd>
											<span class="before">{before || "—"}</span>
											<span class="arrow">→</span>
											<span class="after">{after || "—"}</span>
										</dd>
									{/each}
								</dl>
							{/if}
						</div>
					</div>
				{/each}
			</article>
		{/each}
	</div>

</main>

<style>
	main {
		flex: 1;
		width: 100%;
		max-width: 1140px;
		margin: 0 auto;
		padding: 3rem 1.5rem 4rem;
	}

	.top {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		color: var(--text-secondary);
		text-decoration: none;
		transition:
			border-color 0.15s,
			color 0.15s;
	}

	.home-link:hover {
		border-color: var(--border-hover);
		color: var(--text);
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.03em;
	}

	.sub {
		margin-top: 0.2rem;
		max-width: 60ch;
		color: var(--text-secondary);
		font-size: 0.85rem;
		line-height: 1.5;
	}

	/* --- timeline -------------------------------------------------------- */

	/* Scrolls sideways rather than wrapping: the revisions are in order, and a
	   wrapped rail loses that reading. */
	.timeline {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 0.5rem;
		margin-bottom: 2rem;
	}

	.step {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex-shrink: 0;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-card);
		color: var(--text-secondary);
		text-decoration: none;
		transition: border-color 0.15s ease;
	}

	.step:hover {
		border-color: var(--border-hover);
	}

	.step.active {
		border-color: var(--text);
		color: var(--text);
	}

	.step-title {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		white-space: nowrap;
	}

	.step-when {
		font-size: 0.66rem;
		white-space: nowrap;
		color: var(--text-muted);
	}

	.step-counts {
		display: flex;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		color: var(--text-muted);
	}

	/* --- summary --------------------------------------------------------- */

	.summary h2 {
		font-family: var(--font-mono);
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.meta {
		margin-top: 0.4rem;
		color: var(--text-secondary);
		font-size: 0.8rem;
		line-height: 1.6;
	}

	.note {
		max-width: 72ch;
		margin-top: 1rem;
		padding: 0.7rem 0.9rem;
		border-left: 2px solid var(--border-hover);
		background: var(--bg-card);
		color: var(--text-secondary);
		font-size: 0.8rem;
		line-height: 1.6;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin-top: 1.25rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.chip {
		padding: 0.28rem 0.65rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg-card);
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s,
			opacity 0.15s;
	}

	.chip:hover {
		border-color: var(--border-hover);
		color: var(--text);
	}

	.chip.off {
		opacity: 0.4;
		text-decoration: line-through;
	}

	.chip.soft {
		cursor: default;
		border-color: transparent;
		background: var(--bg-hover);
		color: var(--text-muted);
		font-size: 0.66rem;
	}

	.chip.soft b {
		color: var(--text-secondary);
		font-weight: 500;
	}

	.fields {
		margin-top: 0.75rem;
	}

	.search {
		flex: 1;
		min-width: 240px;
		width: auto;
		border-radius: 999px;
	}

	.nothing {
		padding: 2.5rem 0;
		max-width: 52ch;
		color: var(--text-secondary);
		font-size: 0.85rem;
		line-height: 1.6;
	}

	/* --- change rows ------------------------------------------------------ */

	.groups {
		margin-top: 2rem;
		display: grid;
		gap: 0.5rem;
	}

	.group {
		padding: 0.9rem 1rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-card);
	}

	.group h3 {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
	}

	.code {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		font-weight: 600;
	}

	.cname {
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 400;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.9rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--border);
	}

	/* A course with several changed classes reads as a list, so the rows need
	   air between them, not just the rule. */
	.row + .row {
		margin-top: 0.7rem;
	}

	.kind {
		flex-shrink: 0;
		width: 8.5ch;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.k-added,
	.k-removed {
		color: var(--text-secondary);
	}

	.row-body {
		flex: 1;
		min-width: 0;
	}

	.at {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--text-secondary);
		word-break: break-word;
	}

	.deltas {
		display: grid;
		grid-template-columns: minmax(70px, 10ch) 1fr;
		gap: 0.2rem 1rem;
		margin-top: 0.45rem;
	}

	.deltas dt {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
		padding-top: 0.1rem;
	}

	.deltas dd {
		font-family: var(--font-mono);
		font-size: 0.74rem;
		line-height: 1.5;
		word-break: break-word;
	}

	.before {
		color: var(--text-muted);
	}

	.arrow {
		color: var(--text-muted);
		padding: 0 0.2rem;
	}

	.after {
		color: var(--text);
	}

	a:focus-visible,
	.chip:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.step,
		.chip {
			transition: none;
		}
	}

	@media (max-width: 600px) {
		main {
			padding: 2rem 1rem 3rem;
		}

		.deltas {
			grid-template-columns: 1fr;
			gap: 0 0.5rem;
		}

		.deltas dt {
			margin-top: 0.35rem;
		}
	}
</style>
