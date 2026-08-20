<script lang="ts">
	import { page } from "$app/state";
	import { OG_VERSION } from "$lib/ogVersion";

	interface Props {
		title: string; // page title (without the "· Scooby" suffix)
		description: string;
		// Path under /og, e.g. "clubs". Falls back to the default site card.
		image?: string;
	}

	let { title, description, image = "default" }: Props = $props();

	const siteName = "Scooby";
	const fullTitle = $derived(
		title === siteName ? "Scooby · Your one-stop university app" : `${title} · ${siteName}`,
	);
	// Absolute URLs (required by most social scrapers), resolved from the
	// request/host origin so they work on any domain the app is deployed to.
	const url = $derived(page.url.href);
	const imageUrl = $derived(
		new URL(`/og/${image}.png?v=${OG_VERSION}`, page.url.origin).href,
	);
</script>

<svelte:head>
	<title>{fullTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />

	<!-- Open Graph -->
	<meta property="og:site_name" content={siteName} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={fullTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={fullTitle} />

	<!-- Twitter / X -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={fullTitle} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
</svelte:head>
