<script lang="ts">
	// ponytail: Room Switch is paused until room numbers are released.
	// To resume: uncomment the import and the <RoomSwitch /> render below, delete the placeholder.
	// import RoomSwitch from "$lib/components/RoomSwitch.svelte";
	import Seo from "$lib/components/Seo.svelte";
</script>

<Seo
	title="Room Switch"
	description="Swap hostel rooms at Shiv Nadar University. Post your room, browse everyone in your hostel looking to switch, and sort it out over WhatsApp."
	image="room-switch"
/>

<div class="pending">
	<h1>Room Switch</h1>
	<p>Will open once room numbers are released.</p>
</div>

<!-- <RoomSwitch /> -->

<style>
	.pending {
		max-width: 32rem;
		margin: 6rem auto;
		padding: 0 1.5rem;
		text-align: center;
	}
	.pending h1 {
		margin: 0 0 0.75rem;
		font-size: 1.75rem;
	}
	.pending p {
		margin: 0;
		opacity: 0.7;
	}
</style>
