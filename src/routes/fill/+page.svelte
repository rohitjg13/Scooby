<script lang="ts">
	import Seo from "$lib/components/Seo.svelte";

	const FORM = "https://forms.gle/t6xgujuZysUrYYWRA";

	// ponytail: meta refresh, not a server 302 — WhatsApp/X scrapers don't run
	// JS or follow refreshes, so they stay and read our OG card, while browsers
	// leave during HTML parse (before CSS, fonts or hydration land).
</script>

<svelte:head>
	<meta http-equiv="refresh" content="0; url={FORM}" />
</svelte:head>

<Seo
	title="Please fill this form"
	description="Please fill this form"
	image="fill"
/>

<a href={FORM}>Continue to the form</a>
