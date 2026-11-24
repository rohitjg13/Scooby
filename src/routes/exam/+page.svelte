<script lang="ts">
	import ExamTimetable from "$lib/components/ExamTimetable.svelte";
	import Seo from "$lib/components/Seo.svelte";

	// Flip to true when a mid-sem / end-sem exam schedule is live.
	const examActive = true;
</script>

<Seo
	title="Exam Timetable"
	description="Search your courses and build your personal mid-sem or end-sem exam schedule. Export it as an image or to your calendar."
	image="exam"
/>

{#if examActive}
	<ExamTimetable />
{:else}
	<main class="empty">
		<div class="empty-inner">
			<span class="empty-badge" aria-hidden="true">
				<svg
					class="empty-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M6 4a1 1 0 0 1 1-1h6l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4z"
					/>
					<path d="M13 3v5h5" />
					<path d="M9 13l1.75 1.75L14 11.5" />
				</svg>
			</span>
			<h1>Exam Timetable</h1>
			<p class="empty-msg">
				There is no Mid/End Sem exam currently going on.
			</p>
			<a href="/" class="btn secondary">← Home</a>
		</div>
	</main>
{/if}

<style>
	.empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4rem 1.5rem;
	}

	.empty-inner {
		text-align: center;
		max-width: 420px;
	}

	.empty-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--bg-input);
		color: var(--text);
	}

	.empty-icon {
		width: 26px;
		height: 26px;
	}

	.empty-inner h1 {
		margin-top: 1rem;
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.empty-msg {
		margin: 0.75rem 0 1.75rem;
		color: var(--text-secondary);
		font-size: 1rem;
	}

	.btn.secondary {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.6rem 1rem;
		font-size: 0.85rem;
		font-weight: 500;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text);
		text-decoration: none;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.btn.secondary:hover {
		background: var(--bg-hover);
		border-color: var(--border-hover);
	}
</style>
