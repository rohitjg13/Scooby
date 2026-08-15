<script lang="ts">
	import AttendanceCalculator from "$lib/components/AttendanceCalculator.svelte";
	import Seo from "$lib/components/Seo.svelte";
</script>

<Seo
	title="Attendance Calculator"
	description="Calculate your current attendance, required hours to hit 75% or 65% athlete target, and safe bunk margin."
	image="attendance-calculator"
/>

<AttendanceCalculator />
