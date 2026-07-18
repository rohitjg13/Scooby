<script lang="ts">
	import RoomSwitch from "$lib/components/RoomSwitch.svelte";
	import Seo from "$lib/components/Seo.svelte";

	// Flip to true when room numbers are released.
	const roomSwitchActive = false;
</script>

<Seo
	title="Room Switch"
	description="Swap hostel rooms at Shiv Nadar University. Post your room, browse everyone in your hostel looking to switch, and sort it out over WhatsApp."
	image="room-switch"
/>

{#if roomSwitchActive}
	<RoomSwitch />
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
					<path d="M4 8h13l-3-3" />
					<path d="M20 16H7l3 3" />
				</svg>
			</span>
			<h1>Room Switch</h1>
			<p class="empty-msg">
				Will open once room numbers are released.
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
