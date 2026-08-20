<script lang="ts">
	import Seo from "$lib/components/Seo.svelte";

	type IconName =
		| "calendar"
		| "exam"
		| "clubs"
		| "switch"
		| "map"
		| "minor"
		| "history"
		| "attendance"
		| "gpa";

	type Feature = {
		title: string;
		description: string;
		href: string;
		icon: IconName;
		tag: string;
		external?: boolean;
	};

	const features: Feature[] = [
		{
			title: "Timetable Planner",
			description:
				"Pick your batch, throw in your UWE, CCC and elective choices, and see what clashes. Exports to an image or your calendar.",
			href: "/collision-checker",
			icon: "calendar",
			tag: "Timetable",
		},
		{
			title: "Timetable Changes",
			description:
				"Every timetable revision the university has pushed out, and what actually moved.",
			href: "/changes",
			icon: "history",
			tag: "Timetable",
		},
		// {
		// 	title: "Club Info",
		// 	description:
		// 		"Browse every cultural and technical club on campus — what they do, their logos, and where to follow them.",
		// 	href: "/clubs",
		// 	icon: "clubs",
		// 	tag: "Campus",  
		// },
		// Campus Map lives on its own site, so it gets the banner above the grid
		// rather than a card in it.
		{
			title: "Minors",
			description:
				"All the undergrad minors, with their core courses, elective baskets and credit requirements. Old curriculum too.",
			href: "/minors",
			icon: "minor",
			tag: "Academics",
		},
		// No exam schedule is live — /exam shows the empty state.
		// {
		// 	title: "Exam Timetable",
		// 	description:
		// 		"Search your courses and build your personal mid-sem or end-sem exam schedule. Export it as an image or to your calendar.",
		// 	href: "/exam",
		// 	icon: "exam",
		// 	tag: "Exams",
		// },
		{
			title: "GPA Calculator",
			description:
				"SGPA and CGPA on whichever grading scale your admission year falls under. Add courses semester by semester.",
			href: "/gpa",
			icon: "gpa",
			tag: "Academics",
		},
		{
			title: "Attendance Calculator",
			description:
				"How far behind you are, and how many classes you can still afford to skip.",
			href: "/attendance-calculator",
			icon: "attendance",
			tag: "Academics",
		},
		// Closed until room allocation happens again — /room-switch shows the empty state.
		// {
		// 	title: "Room Switch",
		// 	description:
		// 		"Want to swap hostel rooms? Post your room, browse others in your hostel, and connect over WhatsApp to sort out a mutual switch.",
		// 	href: "/room-switch",
		// 	icon: "switch",
		// 	tag: "Hostel",
		// },
	];
</script>

{#snippet icon(name: IconName)}
	<svg
		class="icon"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if name === "calendar"}
			<rect x="3" y="4.5" width="18" height="16" rx="2" />
			<path d="M3 9.5h18" />
			<path d="M8 2.5v4M16 2.5v4" />
			<path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
		{:else if name === "gpa"}
			<rect x="5" y="3" width="14" height="18" rx="2" />
			<path d="M8 7h8" />
			<path d="M8 11h2M12 11h2M16 11h0" />
			<path d="M8 15h2M12 15h2M16 15h0" />
			<path d="M8 18h2M12 18h2M16 18h0" />
		{:else if name === "attendance"}
			<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
			<path d="M22 4 12 14.01l-3-3" />
		{:else if name === "exam"}
			<path d="M6 4a1 1 0 0 1 1-1h6l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4z" />
			<path d="M13 3v5h5" />
			<path d="M9 13l1.75 1.75L14 11.5" />
		{:else if name === "clubs"}
			<circle cx="9" cy="8" r="3" />
			<path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
			<path d="M16 5.5a3 3 0 0 1 0 5.5" />
			<path d="M17 14.2a5.5 5.5 0 0 1 3.5 4.8" />
		{:else if name === "map"}
			<path d="M12 21s-6.5-5.2-6.5-10a6.5 6.5 0 0 1 13 0c0 4.8-6.5 10-6.5 10z" />
			<circle cx="12" cy="11" r="2.5" />
		{:else if name === "switch"}
			<path d="M4 8h13M13 4l4 4-4 4" />
			<path d="M20 16H7M11 20l-4-4 4-4" />
		{:else if name === "minor"}
			<path d="M12 4L3 8l9 4 9-4-9-4z" />
			<path d="M6.5 10.2V15c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4.8" />
			<path d="M21 8v5" />
		{:else if name === "history"}
			<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
			<path d="M3 3.5V9h5.5" />
			<path d="M12 7.5V12l3 2" />
		{/if}
	</svg>
{/snippet}

<Seo
	title="Scooby"
	description="Scooby is a one-stop university app for planning your timetable, checking your exam schedule, working out your GPA and more."
	image="default"
/>

<main class="home">
	<header class="hero">
		<p class="eyebrow">University Toolkit</p>
		<h1>Scooby</h1>
		<p class="tagline">
			Everything you need to plan your semester, in one place.
		</p>
	</header>

	<a class="promo" href="https://maps.rohitjg.com" target="_blank" rel="noopener noreferrer">
		<span class="promo-badge">{@render icon("map")}</span>
		<span class="promo-body">
			<span class="promo-title">Snoopy</span>
			<span class="promo-desc">the campus map, with every block, mess and court pinned</span>
		</span>
		<span class="promo-cta">
			<span class="promo-cta-label">Open</span>
			<svg
				class="cta-arrow"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M7 17 17 7M9 7h8v8" />
			</svg>
		</span>
	</a>

	<section class="grid" aria-label="Features">
		{#each features as feature, i}
			<a class="card" href={feature.href} target={feature.external ? "_blank" : undefined} rel={feature.external ? "noopener noreferrer" : undefined}>
				<div class="card-top">
					<span class="card-badge">{@render icon(feature.icon)}</span>
					<span class="card-index">{String(i + 1).padStart(2, "0")}</span>
				</div>
				<div class="card-body">
					<span class="card-tag">{feature.tag}</span>
					<h2 class="card-title">{feature.title}</h2>
					<p class="card-desc">{feature.description}</p>
				</div>
				<span class="card-cta">
					Open
					<svg
						class="cta-arrow"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M5 12h14M13 6l6 6-6 6" />
					</svg>
				</span>
			</a>
		{/each}
	</section>
</main>

<style>
	.home {
		position: relative;
		flex: 1;
		width: 100%;
		max-width: 920px;
		margin: 0 auto;
		padding: 5rem 1.5rem 3rem;
	}

	/* Campus map banner — a different product, so it doesn't sit in the grid */
	.promo {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
		padding: 0.6rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		color: var(--text);
		text-decoration: none;
		transition:
			border-color 0.15s,
			transform 0.15s;
	}

	.promo:hover {
		border-color: var(--text-secondary);
		transform: translateY(-2px);
	}

	.promo-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 28px;
		height: 28px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-input);
	}

	.promo-badge :global(.icon) {
		width: 15px;
		height: 15px;
	}

	.promo-body {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}

	.promo-title {
		font-size: 0.85rem;
		font-weight: 500;
	}

	.promo-desc {
		font-size: 0.78rem;
		color: var(--text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.promo-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: auto;
		flex: none;
		padding: 0.25rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 0.72rem;
		color: var(--text-secondary);
	}

	.promo:hover .promo-cta {
		background: var(--text);
		border-color: var(--text);
		color: var(--bg);
	}

	/* On mobile the one-line title + desc ellipses away to nothing, so stack
	   them and shrink the CTA to just the arrow. */
	@media (max-width: 560px) {
		.promo {
			gap: 0.65rem;
			padding: 0.65rem 0.75rem;
		}

		.promo-body {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.1rem;
		}

		.promo-desc {
			white-space: normal;
			font-size: 0.72rem;
			line-height: 1.35;
		}

		.promo-cta {
			padding: 0.3rem;
			border: none;
			color: var(--text-muted);
		}

		.promo-cta-label {
			display: none;
		}
	}

	/* ponytail: hero glow lives on body in app.css, every page gets it */

	.hero {
		position: relative;
		z-index: 1;
		text-align: center;
		margin-bottom: 3.5rem;
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--text-secondary);
		margin-bottom: 1rem;
	}

	.hero h1 {
		font-size: clamp(2.75rem, 8vw, 4rem);
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 1;
	}

	.tagline {
		margin: 1rem auto 0;
		max-width: 34ch;
		color: var(--text-secondary);
		font-size: 1.05rem;
		line-height: 1.5;
	}

	.grid {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1.25rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		min-height: 230px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 14px;
		color: var(--text);
		text-decoration: none;
		transition:
			border-color 0.2s ease,
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	a.card:hover {
		border-color: var(--border-hover);
		transform: translateY(-3px);
		box-shadow: var(--shadow);
	}

	.card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.card-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-input);
		transition:
			border-color 0.2s ease,
			background 0.2s ease;
	}

	a.card:hover .card-badge {
		border-color: var(--border-hover);
		background: var(--bg-hover);
	}

	.icon {
		width: 22px;
		height: 22px;
	}

	.card-index {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.card-body {
		flex: 1;
	}

	.card-tag {
		display: inline-block;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 0.6rem;
	}

	.card-title {
		font-size: 1.15rem;
		font-weight: 600;
		letter-spacing: -0.015em;
	}

	.card-desc {
		margin-top: 0.5rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.card-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		transition: color 0.2s ease;
	}

	.cta-arrow {
		width: 16px;
		height: 16px;
		transition: transform 0.2s ease;
	}

	a.card:hover .card-cta {
		color: var(--text);
	}

	a.card:hover .cta-arrow {
		transform: translateX(4px);
	}

	@media (max-width: 600px) {
		.home {
			padding: 3rem 1rem 2rem;
		}

		.card {
			min-height: 0;
		}
	}
</style>
