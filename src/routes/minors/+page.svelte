<script lang="ts">
	import { page } from "$app/state";
	import Seo from "$lib/components/Seo.svelte";
	import newCurriculum from "$lib/data/minors.new.json";
	import oldCurriculum from "$lib/data/minors.old.json";

	type Section = {
		title: string;
		note?: string;
		columns: string[];
		rows: string[][];
	};
	type Minor = {
		id: string;
		name: string;
		school: string;
		department: string;
		philosophy?: string;
		why?: string[];
		goals?: string[];
		glance?: string[][];
		sections: Section[];
		notes?: string[];
	};
	type Curriculum = {
		id: string;
		label: string;
		subtitle: string;
		minors: Minor[];
	};

	const curricula = [newCurriculum, oldCurriculum] as Curriculum[];

	// One hue per school, so colour carries a fact about the data.
	const HUE: Record<string, number> = {
		"School of Engineering": 35,
		"School of Humanities and Social Sciences": 350,
		"School of Management and Entrepreneurship": 150,
		"School of Natural Sciences": 205,
	};
	const hue = (school: string) => HUE[school] ?? 0;
	const shortSchool = (school: string) => school.replace(/^School of /, "");

	let query = $state("");
	let descriptionModal = $state<HTMLDialogElement | undefined>();

	// Query params rather than a hash, so the server renders detail pages too
	// — they work without JS and can be crawled. Back button comes from
	// SvelteKit's own routing.
	const current = $derived(
		curricula.find((c) => c.id === page.url.searchParams.get("c")) ??
			curricula[0],
	);
	const selected = $derived(
		current.minors.find((m) => m.id === page.url.searchParams.get("m")),
	);

	const href = (curriculumId: string, minorId = "") =>
		`?c=${curriculumId}${minorId ? `&m=${minorId}` : ""}`;

	// --- reading the ragged section shapes -------------------------------

	const COL = {
		code: /code/i,
		name: /course (name|title)|course name & code|elective course|core course/i,
		credits: /credit|^l:t:p$/i,
		prereq: /pre-?requisite/i,
		blurb: /description|detail/i,
		// A bare "Course" column is the title in some tables and the code in
		// others; which one depends on whether a title column exists already.
		plain: /^course$/i,
	};

	// Row counters and learning-goal cross-references say nothing on a card.
	const NOISE = /^(sr\.?|s\.?\s*no\.?|sr\.?\s*no\.?|plgs?( mapping)?)$/i;

	const at = (row: string[], i: number) => (i === -1 ? "" : (row[i] ?? ""));

	// A section lists courses when it names them; everything else is reference
	// data (credit matrices, eligibility rules, semester plans).
	function readCourses(s: Section) {
		const find = (re: RegExp) => s.columns.findIndex((c) => re.test(c));
		let code = find(COL.code);
		let name = find(COL.name);

		const plain = find(COL.plain);
		if (plain !== -1) {
			if (name === -1) name = plain;
			else if (code === -1) code = plain;
		}
		if (name === -1 && code === -1) return null;

		const prereq = find(COL.prereq);
		const blurb = find(COL.blurb);
		// Credits can span two columns ("L:T:P" plus "Credits"); keep both.
		const credits = s.columns
			.map((c, i) => (COL.credits.test(c) ? i : -1))
			.filter((i) => i !== -1);
		const used = new Set([code, name, prereq, blurb, ...credits]);
		const extra = s.columns
			.map((c, i) => ({ label: c, i }))
			.filter(
				({ i, label }) =>
					!used.has(i) && label.trim() !== "" && !NOISE.test(label.trim()),
			);

		// New-curriculum Chemistry uses one "Course Name & Code" column holding
		// "Chemical Principles (CHY1011)". Requiring digits keeps titles like
		// "Building Information Modelling (BIM)" intact.
		const EMBEDDED = /^(.*?)\s*\(([A-Z]{2,4}\s?\d{3,4})\)$/;

		return s.rows.map((row) => {
			let title = at(row, name) || at(row, code);
			let tag = code === name ? "" : at(row, code);
			const split = title.match(EMBEDDED);
			if (split && !tag) {
				title = split[1];
				tag = split[2];
			}
			return {
				heading:
					row.filter(Boolean).length === 1 ? row.find(Boolean) : null,
				code: tag,
				name: title,
				prereq: at(row, prereq),
				blurb: at(row, blurb),
				credits: credits.map((i) => row[i]).filter(Boolean),
				extra: extra
					.map(({ label, i }) => ({ label, value: row[i] }))
					.filter((e) => e.value && e.value !== "—" && e.value !== "-"),
			};
		});
	}

	// Pathway grids mark availability with single characters; spell them out.
	const LEGEND: Record<string, string> = {
		C: "compulsory",
		M: "mandatory",
		O: "optional",
		P: "prereq only",
		"●": "available",
	};
	const spell = (v: string) => LEGEND[v.trim()] ?? v;

	// --- search -----------------------------------------------------------

	const haystacks = $derived(
		new Map(
			current.minors.map((m) => [
				m.id,
				[m.name, m.school, m.department, ...m.sections.flatMap((s) => s.rows.flat())]
					.join(" ")
					.toLowerCase(),
			]),
		),
	);
	const q = $derived(query.trim().toLowerCase());
	const matches = $derived(
		q ? current.minors.filter((m) => haystacks.get(m.id)?.includes(q)) : current.minors,
	);
	const shelf = $derived(
		matches.reduce<{ school: string; minors: Minor[] }[]>((acc, m) => {
			const last = acc[acc.length - 1];
			if (last && last.school === m.school) last.minors.push(m);
			else acc.push({ school: m.school, minors: [m] });
			return acc;
		}, []),
	);

	// --- tile summary ------------------------------------------------------

	// The credit matrix is the page's headline number, so it gets promoted out
	// of the section list into a requirements panel rather than rendered as
	// anonymous label/value blocks.
	const isMatrix = (s: Section) =>
		s.columns[0].trim() === "" && /total credits/i.test(s.columns.at(-1) ?? "");
	const blank = (v: string) => !v || /^(--|—|–|-|na)$/i.test(v.trim());

	// Long "At a Glance" answers read badly in a stat strip; they go lower down.
	const shortFacts = (m: Minor) =>
		(m.glance ?? []).filter(([, v]) => v.length <= 60);
	const longFacts = (m: Minor) =>
		(m.glance ?? []).filter(([, v]) => v.length > 60);

	// Never trimmed. Several minors state two figures ("22 for an Engineering
	// major; 28 for a Non-Engineering major") or qualify the number, and
	// cutting at the first bracket turned those into wrong answers.
	const totalCredits = (m: Minor) => {
		const stated = m.glance?.find(([k]) =>
			k.toLowerCase().startsWith("total credits"),
		)?.[1];
		if (stated) return stated;

		const matrix = m.sections.find((s) =>
			s.columns.at(-1)?.toLowerCase().startsWith("total credits"),
		);
		const total = matrix?.rows[0]?.at(-1);
		return total && /^\d/.test(total) ? `${total} credits` : "";
	};

	// A sample of the codes you'd be typing into the registration form, plus a
	// count of what's left — so the tile never reads as the complete list.
	function preview(m: Minor) {
		const seen = new Set<string>();
		const codes: string[] = [];
		const titles: string[] = [];

		for (const s of m.sections) {
			const courses = readCourses(s);
			if (!courses) continue;
			for (const c of courses) {
				if (c.heading) continue;
				const key = (c.code || c.name).trim();
				if (!key || seen.has(key)) continue;
				seen.add(key);
				if (c.code.trim()) codes.push(c.code.trim());
				else if (c.name) titles.push(c.name);
			}
		}

		// Three codes fit on one line as chips; titles are long, so two as text.
		const mono = codes.length > 0;
		const chips = mono ? codes.slice(0, 3) : titles.slice(0, 2);
		return { chips, mono, more: seen.size - chips.length };
	}
</script>

<Seo
	title="Minors"
	description="Every undergraduate minor on offer — the courses, the credits and the prerequisites, for both the new and old curriculum."
	image="minors"
/>

{#if selected}
	{@const m = selected}
	{@const matrix = m.sections.find(isMatrix)}
	{@const alsoFacts = shortFacts(m).filter(([k]) => !/^total credits/i.test(k))}
	<main class="detail" style="--h: {hue(m.school)}">
		<a class="back" href={href(current.id)}>← All minors</a>

		<header class="masthead">
			<p class="eyebrow accent">{shortSchool(m.school)}</p>
			<h1>{m.name}</h1>
			<p class="dept">{m.department}</p>
			{#if m.philosophy}
				<button
					class="disclose"
					onclick={() => descriptionModal?.showModal()}
				>
					Read description
				</button>
			{/if}
		</header>

		{#if matrix}
			<div class="reqs">
				<p class="reqs-title">Credit requirements</p>
				<!-- Defines the terms the rows below use ("Track A", the SHSS
				     footnote, Chemistry's category split). Without it the
				     numbers have no key. -->
				{#if matrix.note}
					<p class="reqs-note">{matrix.note}</p>
				{/if}
				{#each matrix.rows as row}
					<div class="req">
						{#if row[0]}<p class="req-label">{row[0]}</p>{/if}
						<div class="stats">
							{#each matrix.columns as col, i}
								{#if i > 0 && !blank(row[i])}
									<div class="stat" class:total={i === matrix.columns.length - 1}>
										<span class="stat-value">{row[i]}</span>
										<span class="stat-label">{col}</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/each}

				<!-- A minor can have both a matrix and an At a Glance block
				     (old Design). Drop only the credit total, which the matrix
				     already states, and keep everything else. -->
				{#if alsoFacts.length}
					<div class="req">
						<div class="stats">
							{#each alsoFacts as [key, value]}
								<div class="stat">
									<span class="stat-value small">{value}</span>
									<span class="stat-label">{key}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else if shortFacts(m).length}
			<div class="reqs">
				<div class="stats">
					{#each shortFacts(m) as [key, value]}
						<div class="stat" class:total={/^total credits/i.test(key)}>
							<span class="stat-value" class:small={value.length > 14}>
								{value}
							</span>
							<span class="stat-label">{key}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}


		{#each m.sections.filter((s) => !isMatrix(s)) as section}
			{@const courses = readCourses(section)}
			<section class="block">
				<h2>{section.title}</h2>
				{#if section.note}
					<p class="note">{section.note}</p>
				{/if}

				{#if courses}
					<div class="courses">
						{#each courses as c}
							{#if c.heading}
								<p class="basket">{c.heading}</p>
							{:else}
								<article class="course">
									{#if c.code}
										<span class="tag">{c.code}</span>
									{/if}
									<div class="course-main">
										<h3>{c.name}</h3>
										{#if c.blurb}
											<p class="blurb">{c.blurb}</p>
										{/if}
										<div class="meta">
											{#each c.credits as credit}
												<span class="pill">{credit}</span>
											{/each}
											{#if c.prereq && !/^(none|na|-|—)$/i.test(c.prereq.trim())}
												<span class="prereq">needs {c.prereq}</span>
											{/if}
											{#each c.extra as e}
												<span class="pill quiet">
													{e.label}: {spell(e.value)}
												</span>
											{/each}
										</div>
									</div>
								</article>
							{/if}
						{/each}
					</div>
				{:else}
					<div class="specs">
						{#each section.rows as row}
							<div class="spec">
								<p class="spec-head">{row.find(Boolean)}</p>
								<dl>
									{#each section.columns as col, i}
										{#if i > 0 && row[i] && row[i] !== "—"}
											<dt>{col}</dt>
											<dd>{row[i]}</dd>
										{/if}
									{/each}
								</dl>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/each}

		{#if longFacts(m).length}
			<section class="block">
				<h2>Good to know</h2>
				<div class="specs">
					<div class="spec">
						<dl>
							{#each longFacts(m) as [key, value]}
								<dt>{key}</dt>
								<dd>{value}</dd>
							{/each}
						</dl>
					</div>
				</div>
			</section>
		{/if}

		{#if m.notes}
			<section class="block">
				<h2>Fine print</h2>
				<ul class="notes">
					{#each m.notes as note}<li>{note}</li>{/each}
				</ul>
			</section>
		{/if}

		{#if m.why || m.goals}
			<section class="block why">
				{#if m.why}
					<h2>Why pursue this</h2>
					<ul>
						{#each m.why as item}<li>{item}</li>{/each}
					</ul>
				{/if}
				{#if m.goals}
					<h2>What you'll come out with</h2>
					<ul>
						{#each m.goals as item}<li>{item}</li>{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<p class="source">
			From the University's minor program documents. Confirm with your UG
			Advisor before you plan around a pathway.
		</p>
	</main>

	<dialog bind:this={descriptionModal} class="modal">
		<div class="modal-head">
			<div>
				<h2>{m.name}</h2>
				<p class="dept">{m.department}</p>
			</div>
			<button
				class="close"
				aria-label="Close"
				onclick={() => descriptionModal?.close()}>×</button
			>
		</div>
		<div class="modal-body">
			<p class="lede">{m.philosophy}</p>
		</div>
	</dialog>
{:else}
	<main class="shelf">
		<header class="top">
			<a href="/" class="home-link" title="Back to Scooby home">←</a>
			<div>
				<h1>Minors</h1>
				<p class="dept">{current.subtitle}</p>
			</div>
		</header>

		<div class="controls">
			<div class="switch" role="group" aria-label="Curriculum">
				{#each curricula as c}
					<a
						class="btn btn-sm"
						class:active={current.id === c.id}
						href={href(c.id)}>{c.label}</a
					>
				{/each}
			</div>
			<input
				class="input search"
				type="search"
				bind:value={query}
				placeholder="Try a minor, a department, or a code like CHD2001"
			/>
		</div>

		{#if matches.length === 0}
			<p class="nothing">
				Nothing here matches “{query}”. Try a course code, or clear the
				search to see all {current.minors.length}.
			</p>
		{/if}

		{#each shelf as group}
			<section class="group" style="--h: {hue(group.school)}">
				<h2 class="eyebrow accent">{shortSchool(group.school)}</h2>
				<div class="tiles">
					{#each group.minors as m (m.id)}
						{@const p = preview(m)}
						<a class="entry" href={href(current.id, m.id)}>
							<span class="entry-name">{m.name}</span>
							<span class="entry-dept">{m.department}</span>
							{#if p.mono}
								<span class="entry-codes">
									{#each p.chips as code}<span class="code">{code}</span>{/each}
									{#if p.more > 0}<span class="rest">+{p.more}</span>{/if}
								</span>
							{:else if p.chips.length}
								<span class="entry-titles">
									{p.chips.join(" · ")}{p.more > 0 ? ` · +${p.more}` : ""}
								</span>
							{/if}
							{#if totalCredits(m)}
								<span class="entry-credits">{totalCredits(m)}</span>
							{/if}
						</a>
					{/each}
				</div>
			</section>
		{/each}
	</main>
{/if}

<style>
	/* Accent is a hue per school; --h is set inline where it applies. */
	.accent {
		color: hsl(var(--h) 65% 66%);
	}

	.shelf,
	.detail {
		flex: 1;
		width: 100%;
		max-width: 1140px;
		margin: 0 auto;
		padding: 3rem 1.5rem 4rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.03em;
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}

	.dept {
		margin-top: 0.2rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	/* --- shelf ---------------------------------------------------------- */

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

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 3rem;
	}

	.switch {
		display: inline-flex;
		gap: 0.35rem;
		padding: 0.25rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg-card);
	}

	.switch .btn {
		border-color: transparent;
		border-radius: 999px;
		background: transparent;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.switch .btn.active {
		background: var(--text);
		color: var(--bg);
	}

	.search {
		flex: 1;
		min-width: 240px;
		width: auto;
		border-radius: 999px;
	}

	.nothing {
		color: var(--text-secondary);
		padding: 2rem 0;
		max-width: 46ch;
		line-height: 1.6;
	}

	.group {
		margin-bottom: 3.25rem;
	}

	.group h2 {
		margin-bottom: 1rem;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(262px, 1fr));
		gap: 0.7rem;
	}

	.entry {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 1.15rem 1.2rem 1rem;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--bg-card);
		color: var(--text);
		text-decoration: none;
		transition: border-color 0.18s ease;
	}

	.entry:hover {
		border-color: hsl(var(--h) 50% 55% / 0.55);
	}

	.entry-name {
		font-size: 1.02rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		line-height: 1.3;
	}

	.entry-dept {
		font-size: 0.74rem;
		line-height: 1.45;
		color: var(--text-muted);
	}

	/* Pinned to the bottom so the figures line up across a row of cards. */
	.entry-credits {
		margin-top: auto;
		padding-top: 0.85rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		line-height: 1.45;
		color: var(--text-muted);
	}

	/* Kept to a single clipped line: wrapping chips gave every card a
	   different height, which was what made the grid look ragged. */
	.entry-codes {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.5rem;
		overflow: hidden;
	}

	.code {
		flex-shrink: 0;
		padding: 0.16rem 0.42rem;
		border-radius: 5px;
		background: hsl(var(--h) 45% 50% / 0.16);
		color: hsl(var(--h) 66% 74%);
		font-family: var(--font-mono);
		font-size: 0.67rem;
		line-height: 1.5;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}

	.rest {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 0.67rem;
		color: var(--text-muted);
	}

	/* Civil and Management list no codes, so their courses show as titles —
	   too long for chips. */
	.entry-titles {
		margin-top: 0.5rem;
		font-size: 0.72rem;
		line-height: 1.45;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* --- detail --------------------------------------------------------- */

	.back {
		display: inline-block;
		margin-bottom: 2.5rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.back:hover {
		color: var(--text);
	}

	.masthead {
		max-width: 20ch;
	}

	.masthead h1 {
		margin-top: 0.7rem;
		font-size: clamp(1.9rem, 5.5vw, 2.9rem);
		line-height: 1.06;
		letter-spacing: -0.035em;
	}

	.masthead .dept {
		margin-top: 0.8rem;
		max-width: 44ch;
	}

	/* What you actually have to complete, lifted out of the credit matrix. */
	.reqs {
		display: grid;
		gap: 1.5rem;
		margin: 2.25rem 0 2.75rem;
		padding: 1.5rem 1.6rem;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--bg-card);
	}

	.reqs-title {
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.reqs-note {
		max-width: 70ch;
		margin-top: -0.9rem;
		color: var(--text-secondary);
		font-size: 0.83rem;
		line-height: 1.6;
	}

	.req-label {
		margin-bottom: 0.85rem;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem 2.75rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		max-width: 30ch;
	}

	.stat-value {
		font-family: var(--font-mono);
		font-size: 1.5rem;
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.02em;
	}

	/* Qualified figures ("18 minimum (Mech/Chem and CSE/ECE pathways)") are
	   sentences, not numerals — set them to read as text. */
	.stat-value.small {
		font-family: var(--font);
		font-size: 0.87rem;
		font-weight: 400;
		line-height: 1.45;
		letter-spacing: 0;
	}

	.stat.total .stat-value {
		color: hsl(var(--h) 65% 68%);
	}

	.stat-label {
		font-size: 0.72rem;
		line-height: 1.4;
		color: var(--text-muted);
	}

	.disclose {
		margin-top: 1.1rem;
		padding: 0.32rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-secondary);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.disclose:hover {
		color: var(--text);
		border-color: var(--border-hover);
	}

	.disclose:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	.lede {
		color: var(--text-secondary);
		font-size: 0.95rem;
		line-height: 1.7;
	}

	/* The global `* { margin: 0 }` reset overrides the UA stylesheet's
	   `margin: auto` on <dialog>, so centring is set explicitly. */
	.modal {
		position: fixed;
		inset: 0;
		margin: auto;
		width: min(600px, calc(100vw - 2rem));
		max-height: min(80vh, 640px);
		padding: 0;
		border: 1px solid var(--border-hover);
		border-radius: 16px;
		background: var(--bg-card);
		color: var(--text);
		overflow: hidden;
	}

	/* Scoped to [open] so it can't defeat dialog's own hiding. */
	.modal[open] {
		display: flex;
		flex-direction: column;
	}

	.modal::backdrop {
		background: rgba(0, 0, 0, 0.75);
	}

	/* showModal() focuses the dialog; the ring on a container says nothing. */
	.modal:focus {
		outline: none;
	}

	.modal-head {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		flex-shrink: 0;
		padding: 1.3rem 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.modal-head h2 {
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.close {
		margin-left: auto;
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		font-size: 1.2rem;
		line-height: 1;
		color: var(--text-secondary);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.close:hover {
		color: var(--text);
		border-color: var(--border-hover);
	}

	.close:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	/* Takes the leftover height, so a wrapped title can't push content out. */
	.modal-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1.3rem 1.5rem 1.6rem;
	}

	.block {
		margin-top: 3.25rem;
	}

	.block h2 {
		margin-bottom: 0.9rem;
		font-size: 1.02rem;
		font-weight: 600;
		letter-spacing: -0.015em;
	}

	.note {
		max-width: 62ch;
		margin-bottom: 1.1rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
		line-height: 1.6;
	}

	.courses {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
		gap: 0.5rem;
		align-items: start;
	}

	.basket {
		grid-column: 1 / -1;
		margin: 1.4rem 0 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: hsl(var(--h) 55% 68%);
	}

	.basket:first-child {
		margin-top: 0;
	}

	.course {
		display: flex;
		gap: 0.7rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 11px;
		background: var(--bg-card);
		transition: border-color 0.15s ease;
	}

	.course:hover {
		border-color: var(--border-hover);
	}

	/* The signature: the code you type into the registration form. */
	.tag {
		flex-shrink: 0;
		align-self: flex-start;
		padding: 0.15rem 0.4rem;
		border-radius: 6px;
		background: hsl(var(--h) 45% 50% / 0.15);
		color: hsl(var(--h) 68% 74%);
		font-family: var(--font-mono);
		font-size: 0.71rem;
		line-height: 1.5;
		white-space: nowrap;
	}

	.course-main {
		min-width: 0;
	}

	.course h3 {
		font-size: 0.87rem;
		font-weight: 500;
		line-height: 1.35;
	}

	.blurb {
		margin-top: 0.3rem;
		color: var(--text-secondary);
		font-size: 0.78rem;
		line-height: 1.5;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.45rem;
		margin-top: 0.35rem;
	}

	.pill {
		padding: 0.05rem 0.35rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 0.67rem;
		color: var(--text-secondary);
	}

	.pill.quiet {
		border-color: transparent;
		padding-left: 0;
		color: var(--text-muted);
	}

	.prereq {
		font-family: var(--font-mono);
		font-size: 0.67rem;
		color: var(--text-muted);
	}

	.specs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 0.6rem;
		align-items: start;
	}

	.spec {
		padding: 1.1rem 1.2rem;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--bg-card);
	}

	.spec-head {
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.spec dl {
		display: grid;
		grid-template-columns: minmax(90px, 12ch) 1fr;
		gap: 0.35rem 1.1rem;
		max-width: 74ch;
	}

	.spec dt {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
		padding-top: 0.15rem;
	}

	.spec dd {
		color: var(--text-secondary);
		font-size: 0.85rem;
		line-height: 1.55;
	}

	.notes,
	.why ul {
		max-width: 68ch;
		padding-left: 1.1rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
		line-height: 1.6;
	}

	.notes li + li,
	.why li + li {
		margin-top: 0.45rem;
	}

	.why h2 {
		margin-top: 2rem;
	}

	.why h2:first-child {
		margin-top: 0;
	}

	.source {
		margin-top: 4rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
		max-width: 52ch;
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.6;
	}

	a:focus-visible,
	.entry:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 3px;
	}

	@media (prefers-reduced-motion: reduce) {
		.entry,
		.course {
			transition: none;
		}
	}

	@media (max-width: 600px) {
		.shelf,
		.detail {
			padding: 2rem 1rem 3rem;
		}

		.stats {
			gap: 1.25rem 1.75rem;
		}

		/* Stays a row — the code tag is short, and stacking it doubled the
		   height of every card for no gain. */
		.course {
			gap: 0.55rem;
			padding: 0.65rem 0.75rem;
		}

		.courses,
		.specs {
			grid-template-columns: 1fr;
		}

		.spec dl {
			grid-template-columns: 1fr;
			gap: 0.15rem;
		}

		.spec dt {
			margin-top: 0.5rem;
		}
	}
</style>
