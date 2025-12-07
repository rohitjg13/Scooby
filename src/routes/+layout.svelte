<script lang="ts">
	import "../app.css";
	let { children } = $props();
</script>

<svelte:head>
	<title>Scooby</title>
	<meta
		name="description"
		content="Minimal timetable visualization and course collision detection tool"
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link
		rel="preconnect"
		href="https://fonts.gstatic.com"
		crossorigin="anonymous"
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="app-container">
	{@render children()}
	<footer class="footer">
		<p>
			Built and Maintained by <a
				href="https://github.com/rohitjg13"
				target="_blank"
				rel="noopener noreferrer">Rohit J G</a
			>
		</p>
	</footer>
</div>

<style>
	.app-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.footer {
		margin-top: auto;
		padding: 2rem;
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.875rem;
		border-top: 1px solid var(--border);
	}

	.footer a {
		color: var(--text);
		text-decoration: none;
		font-weight: 500;
		transition: opacity 0.2s;
	}

	.footer a:hover {
		opacity: 0.8;
		text-decoration: underline;
	}
</style>
