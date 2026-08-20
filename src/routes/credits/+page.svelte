<script lang="ts">
	import Seo from "$lib/components/Seo.svelte";
</script>

<Seo
	title="Credits"
	description="Scooby was started by Rohit J G and runs out of the Academic Committee technical team at SNU Chennai."
/>

<main class="credits">
	<a href="/" class="back">← Home</a>

	<header>
		<h1>Credits</h1>
		<p class="lede">
			Scooby started as one student's side project. It's still built by the same
			person, now under the Academic Committee.
		</p>
	</header>

	<!-- Inverted card: the one block on the page that flips the site's colours,
	     so it reads first without needing a huge name. -->
	<article class="lead">
		<p class="tag">Started it</p>
		<h2>Rohit J G</h2>
		<p class="role">Project lead</p>
		<p class="blurb">
			Built Scooby on his own and ran it for a long time before it came under the
			Academic Committee. Most of what's on this site he wrote, and he keeps it up
			to date whenever the university changes something.
		</p>
		<a class="link" href="https://github.com/rohitjg13" target="_blank" rel="noopener noreferrer">
			github.com/rohitjg13 ↗
		</a>
	</article>

	<div class="pair">
		<article class="card">
			<p class="tag">The team</p>
			<h2 class="org-name">
				Student Council<span class="thin"> · </span>Academic Committee<span class="thin">
					·
				</span>Technical&nbsp;Team
			</h2>
			<p class="blurb">
				The student team Scooby runs under. They work on the site as well, and in
				future more of what gets built here will come from them.
			</p>
		</article>

		<article class="card">
			<p class="tag">Shaped it</p>
			<h2>Rakshith Aravindan</h2>
			<p class="role">Academic secretary</p>
			<p class="blurb">
				He's been sending suggestions and corrections since the site joined the
				committee. A good number of the features and improvements here started
				with something he pointed out.
			</p>
		</article>
	</div>

	<p class="note">
		Something wrong, or something missing? Take it to the Academic Committee, or
		open an issue on
		<a href="https://github.com/rohitjg13" target="_blank" rel="noopener noreferrer">GitHub</a>.
	</p>
</main>

<style>
	.credits {
		flex: 1;
		width: 100%;
		max-width: 940px;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 3rem;
	}

	.back {
		display: inline-block;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.85rem;
	}

	.back:hover {
		color: var(--text);
	}

	header {
		padding: 2.75rem 0 2rem;
	}

	h1 {
		font-size: 1.6rem;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.lede {
		margin-top: 0.5rem;
		max-width: 50ch;
		color: var(--text-secondary);
	}

	.tag {
		font-family: var(--font-mono);
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.16em;
	}

	h2 {
		margin-top: 0.9rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.05;
	}

	.role {
		margin-top: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.blurb {
		margin-top: 1rem;
		font-size: 0.95rem;
	}

	/* Lead */
	.lead {
		padding: 2.25rem 2.25rem 2rem;
		border-radius: var(--radius);
		background: var(--text);
		color: var(--bg);
		box-shadow: var(--shadow);
	}

	.lead .tag,
	.lead .role {
		color: rgba(8, 8, 10, 0.55);
	}

	.lead h2 {
		font-size: clamp(2.1rem, 6vw, 3.1rem);
	}

	.lead .blurb {
		max-width: 54ch;
		color: rgba(8, 8, 10, 0.72);
	}

	.link {
		display: inline-block;
		margin-top: 1.35rem;
		font-family: var(--font-mono);
		font-size: 0.74rem;
		color: var(--bg);
		text-decoration: none;
		border-bottom: 1px solid rgba(8, 8, 10, 0.3);
		padding-bottom: 0.15rem;
	}

	.link:hover {
		border-color: var(--bg);
	}

	/* The other two */
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
	}

	.card {
		padding: 1.75rem 1.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		transition: border-color 0.2s, background 0.2s;
	}

	.card:hover {
		border-color: var(--border-hover);
		background: var(--bg-hover);
	}

	.card .tag {
		color: var(--text-muted);
	}

	.card h2 {
		font-size: clamp(1.35rem, 3.2vw, 1.75rem);
	}

	.thin {
		color: var(--text-muted);
		font-weight: 400;
	}

	/* Three names deep, so it sits a size below a person's name. */
	.card h2.org-name {
		font-size: clamp(1.15rem, 2.6vw, 1.45rem);
		line-height: 1.25;
	}

	.card .role {
		color: var(--text-secondary);
	}

	.card .blurb {
		color: var(--text-secondary);
	}

	.note {
		margin-top: 3rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.note a {
		color: var(--text-secondary);
	}

	@media (max-width: 760px) {
		.credits {
			padding-bottom: 2rem;
		}

		header {
			padding: 2rem 0 1.5rem;
		}

		/* On a phone the lead card was taking most of the screen on its own, so
		   it comes down closer to the other two. */
		.lead {
			padding: 1.4rem 1.25rem 1.3rem;
		}

		.lead h2 {
			font-size: 1.8rem;
		}

		.lead .blurb,
		.card .blurb {
			font-size: 0.88rem;
		}

		h2 {
			margin-top: 0.7rem;
		}

		.blurb {
			margin-top: 0.75rem;
		}

		.link {
			margin-top: 1rem;
		}

		.card {
			padding: 1.35rem 1.25rem;
		}

		.pair {
			grid-template-columns: 1fr;
			gap: 0.75rem;
			margin-top: 0.75rem;
		}

		.note {
			margin-top: 2rem;
		}
	}
</style>
