<script lang="ts">
	import Seo from "$lib/components/Seo.svelte";

	const FORM = "https://forms.gle/t6xgujuZysUrYYWRA";

	// ponytail: client-side redirect, not a server 302 — WhatsApp/X scrapers
	// don't run JS, so they stay here and read our OG card instead of Google's.
	$effect(() => {
		location.replace(FORM);
	});
</script>

<Seo
	title="Please fill this form"
	description="Please fill this form"
	image="fill"
/>

<main>
	<p>Redirecting to the form…</p>
	<p><a href={FORM}>Tap here if nothing happens</a></p>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		min-height: 60vh;
		text-align: center;
		color: var(--text-secondary);
	}

	a {
		color: var(--text);
	}
</style>
