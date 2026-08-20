<script lang="ts">
	import { onMount } from "svelte";
	import type { Exam } from "$lib/types";
	import { toPng } from "html-to-image";
	import { createEvents } from "ics";
	import type { EventAttributes } from "ics";

	let loading = $state(true);
	let error = $state("");
	let allExams = $state<Exam[]>([]);
	let selectedExams = $state<Exam[]>([]);
	let searchInput = $state("");
	let searchInputRef: HTMLInputElement | null = $state(null);

	// Get unique course codes for search
	let allCourseCodes = $derived(() => {
		const codes = new Set<string>();
		allExams.forEach((exam) => {
			codes.add(exam.courseCode);
		});
		return [...codes].sort();
	});

	// Filter exams based on search
	let filteredExams = $derived(() => {
		if (!searchInput || searchInput.trim().length < 1) return [];
		const query = searchInput.toLowerCase().trim();
		return allExams
			.filter((exam) => exam.courseCode.toLowerCase().includes(query))
			.slice(0, 30);
	});

	// Group filtered exams by course code for display
	let groupedFilteredExams = $derived(() => {
		const groups = new Map<string, Exam[]>();
		filteredExams().forEach((exam) => {
			if (!groups.has(exam.courseCode)) {
				groups.set(exam.courseCode, []);
			}
			groups.get(exam.courseCode)!.push(exam);
		});
		return [...groups.entries()];
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "/" && document.activeElement !== searchInputRef) {
			e.preventDefault();
			searchInputRef?.focus();
		}
		if (e.key === "Escape") {
			searchInput = "";
			searchInputRef?.blur();
		}
	}

	onMount(async () => {
		window.addEventListener("keydown", handleKeydown);

		// Restore state from localStorage
		try {
			const savedSelected = localStorage.getItem("scooby_midsem_selected");
			if (savedSelected) {
				selectedExams = JSON.parse(savedSelected);
			}
		} catch (e) {
			console.error("Failed to restore state", e);
		}

		try {
			// Add timestamp to prevent caching
			const response = await fetch(`/api/midsem?t=21022026}`);
			const data = await response.json();

			if (data.error) {
				error = data.error;
			} else {
				allExams = data.exams;
			}
		} catch (e) {
			error = "Failed to load exam timetable data";
		} finally {
			loading = false;
		}
	});

	// Persist state
	$effect(() => {
		if (selectedExams.length >= 0) {
			localStorage.setItem(
				"scooby_midsem_selected",
				JSON.stringify(selectedExams)
			);
		}
	});

	function addExam(exam: Exam) {
		if (!isSelected(exam)) {
			selectedExams = [...selectedExams, exam];
		}
		searchInput = "";
	}

	function removeExam(exam: Exam) {
		selectedExams = selectedExams.filter(
			(e) => !(e.courseCode === exam.courseCode && e.day === exam.day && e.time === exam.time)
		);
	}

	function isSelected(exam: Exam): boolean {
		return selectedExams.some(
			(e) => e.courseCode === exam.courseCode && e.day === exam.day && e.time === exam.time
		);
	}

	function hasConflict(exam: Exam): boolean {
		return selectedExams.some(
			(e) => e.day === exam.day && e.slot === exam.slot && e.courseCode !== exam.courseCode
		);
	}

	function getConflicts(exam: Exam): Exam[] {
		return selectedExams.filter(
			(e) => e.day === exam.day && e.slot === exam.slot && e.courseCode !== exam.courseCode
		);
	}

	function reset() {
		selectedExams = [];
		searchInput = "";
		localStorage.removeItem("scooby_midsem_selected");
	}

	async function downloadImage() {
		const node = document.getElementById("exam-calendar");
		if (!node) return;

		try {
			const dataUrl = await toPng(node, { backgroundColor: "#08080a" });
			const link = document.createElement("a");
			link.href = dataUrl;
			link.download = "midsem-exams.png";
			document.body.appendChild(link);
			link.click();
			setTimeout(() => document.body.removeChild(link), 100);
		} catch (err) {
			console.error("Failed to download image", err);
			alert("Failed to download image");
		}
	}

	// Helper to parse date string to Date object
	function parseDateStr(dateStr: string, year: number = 2026): Date {
		const months: Record<string, number> = {
			'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
			'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
		};
		const parts = dateStr.split(' ');
		const month = months[parts[0]] ?? 0;
		const day = parseInt(parts[1]) || 1;
		return new Date(year, month, day);
	}

	// Helper to format Date to "Mar 5" format
	function formatDateStr(date: Date): string {
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return `${months[date.getMonth()]} ${date.getDate()}`;
	}

	// Helper to get day name from Date
	function getDayName(date: Date): string {
		const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		return days[date.getDay()];
	}

	async function exportCalendar() {
		if (selectedExams.length === 0) {
			alert('No exams selected');
			return;
		}

		const events: EventAttributes[] = [];

		selectedExams.forEach((exam) => {
			const examDate = parseDateStr(exam.date);
			const [hours, minutes] = exam.slot === 'morning' ? [9, 30] : [15, 0];

			events.push({
				title: `Exam: ${exam.courseCode}`,
				start: [
					examDate.getFullYear(),
					examDate.getMonth() + 1,
					examDate.getDate(),
					hours,
					minutes
				],
				duration: { hours: 2, minutes: 0 },
				description: `Mid-Semester Examination for ${exam.courseCode}`,
				location: 'Examination Hall',
				status: 'CONFIRMED',
				busyStatus: 'BUSY'
			});
		});

		const { error: icsError, value } = createEvents(events);
		if (icsError || !value) {
			console.error('Failed to create ICS', icsError);
			alert('Failed to create calendar file');
			return;
		}

		const blob = new Blob([value], { type: 'text/calendar' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = 'midsem-exams.ics';
		document.body.appendChild(link);
		link.click();
		setTimeout(() => {
			document.body.removeChild(link);
			URL.revokeObjectURL(link.href);
		}, 100);
	}

	// Calendar structure
	interface CalendarBlock {
		exam: Exam;
		dateKey: string; // date for grouping
		slot: "morning" | "afternoon";
	}

	interface DayColumn {
		date: string;
		day: string;
		isEmpty?: boolean;
	}

	interface TimeSlot {
		hour: number;
		label: string;
		isExamSlot: boolean; // 9:30 AM or 3:00 PM
		slotType: "morning" | "afternoon" | null;
	}

	// Generate time slots from 9 AM to 4 PM
	function getTimeSlots(): TimeSlot[] {
		const slots: TimeSlot[] = [];
		for (let hour = 9; hour <= 16; hour++) {
			const h = hour % 12 || 12;
			const ampm = hour < 12 ? 'AM' : 'PM';
			const isExamSlot = hour === 9 || hour === 15;
			let slotType: "morning" | "afternoon" | null = null;
			if (hour === 9) slotType = 'morning';
			if (hour === 15) slotType = 'afternoon';
			slots.push({
				hour,
				label: hour === 9 ? '9:30 AM' : hour === 15 ? '3:00 PM' : `${h}:00 ${ampm}`,
				isExamSlot,
				slotType
			});
		}
		return slots;
	}

	const timeSlots = getTimeSlots();

	function buildCalendar(): {
		days: DayColumn[];
		blocks: CalendarBlock[];
	} {
		const usedDays = new Map<string, DayColumn>();
		const blocks: CalendarBlock[] = [];

		selectedExams.forEach((exam) => {
			usedDays.set(exam.date, { date: exam.date, day: exam.day });
			blocks.push({
				exam,
				dateKey: exam.date,
				slot: exam.slot,
			});
		});

		if (usedDays.size === 0) {
			return { days: [], blocks: [] };
		}

		// Sort days by date (Mar 5, Mar 6, etc.)
		const sortedDays = [...usedDays.values()].sort((a, b) => {
			return parseDateStr(a.date).getTime() - parseDateStr(b.date).getTime();
		});

		// Fill in gap days between first and last exam date
		const firstDate = parseDateStr(sortedDays[0].date);
		const lastDate = parseDateStr(sortedDays[sortedDays.length - 1].date);
		const allDays: DayColumn[] = [];

		const currentDate = new Date(firstDate);
		while (currentDate <= lastDate) {
			const dateStr = formatDateStr(currentDate);
			const existing = usedDays.get(dateStr);
			if (existing) {
				allDays.push(existing);
			} else {
				allDays.push({
					date: dateStr,
					day: getDayName(currentDate),
					isEmpty: true
				});
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}

		return { days: allDays, blocks };
	}

	let calendar = $derived(buildCalendar());
</script>

<main class="main">
	{#if loading}
		<div class="center">
			<p class="muted">Loading...</p>
		</div>
	{:else if error}
		<div class="center">
			<h2>No Exam Timetable</h2>
			<p class="muted">{error}</p>
			<a href="/" class="btn primary">← Back to Timetable</a>
		</div>
	{:else}
		<div class="app">
			<!-- Header -->
			<header class="header">
				<div class="header-left">
					<h1>Scooby</h1>
					<span class="tag">Mid-Sem Exams</span>
				</div>

				<div class="search-wrap">
					<input
						type="text"
						class="input"
						placeholder="Search course code (Press / to search)"
						bind:value={searchInput}
						bind:this={searchInputRef}
					/>
					{#if groupedFilteredExams().length > 0}
						<div class="dropdown">
							{#each groupedFilteredExams() as [courseCode, exams]}
								{@const firstExam = exams[0]}
								{@const conflicts = getConflicts(firstExam)}
								{@const hasConflictFlag = conflicts.length > 0}
								{@const selected = isSelected(firstExam)}
								<div class="dropdown-item" class:dimmed={hasConflictFlag}>
									<div class="item-info">
										<div class="item-row">
											<span class="mono">{courseCode}</span>
											<span class="muted small">
												{firstExam.day} • {firstExam.time}
											</span>
										</div>
										{#if hasConflictFlag}
											<span class="conflict-note">
												⚠ Conflicts: {conflicts.map((c) => c.courseCode).join(", ")}
											</span>
										{/if}
									</div>
									<div class="item-action">
										{#if selected}
											<button class="btn small" onclick={() => removeExam(firstExam)}>
												Remove
											</button>
										{:else}
											<button
												class="btn small"
												onclick={() => addExam(firstExam)}
												disabled={hasConflictFlag}
											>
												{hasConflictFlag ? "Conflict" : "Add"}
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="header-actions">
					<button class="btn secondary action-btn" onclick={downloadImage}>
						<span class="icon">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
								<circle cx="12" cy="13" r="4" />
							</svg>
						</span>
						Save Image
					</button>
					<button class="btn secondary action-btn" onclick={exportCalendar}>
						<span class="icon">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
								<line x1="16" y1="2" x2="16" y2="6" />
								<line x1="8" y1="2" x2="8" y2="6" />
								<line x1="3" y1="10" x2="21" y2="10" />
							</svg>
						</span>
						Export Calendar
					</button>
					<a href="/" class="btn secondary">← Timetable</a>
					<button class="btn" onclick={reset}>Reset</button>
				</div>
			</header>

			<!-- Exam Calendar View -->
			{#if calendar.days.length > 0}
				<section class="calendar-section">
					<div class="calendar-scroll-wrapper">
						<div class="calendar-container" id="exam-calendar">
							<div class="exam-calendar" style="--days: {calendar.days.length}">
								<!-- Day headers -->
								<div class="time-gutter"></div>
								{#each calendar.days as dayCol}
									<div class="day-header" class:empty-day={dayCol.isEmpty}>
										<span class="day-date">{dayCol.date}</span>
										<span class="day-name">{dayCol.day}</span>
									</div>
								{/each}

								<!-- Time slot rows -->
								{#each timeSlots as slot}
									<div class="slot-label" class:exam-time={slot.isExamSlot}>
										{slot.label}
									</div>
									{#each calendar.days as dayCol}
										<div 
											class="exam-slot" 
											class:empty-slot={dayCol.isEmpty}
											class:gap-slot={!slot.isExamSlot}
										>
											{#if slot.isExamSlot}
												{#each calendar.blocks.filter((b) => b.dateKey === dayCol.date && b.slot === slot.slotType) as block}
													<div
														class="exam-block"
														onclick={() => removeExam(block.exam)}
														role="button"
														tabindex="0"
														onkeydown={(e) => e.key === "Enter" && removeExam(block.exam)}
														title="Click to remove"
													>
														<span class="block-code">{block.exam.courseCode}</span>
													</div>
												{/each}
											{/if}
										</div>
									{/each}
								{/each}
							</div>
						</div>
					</div>
				</section>
			{:else}
				<div class="empty-state">
					<p class="muted">Search and add your courses to see your exam schedule</p>
				</div>
			{/if}

			<!-- Selected Exams List -->
			{#if selectedExams.length > 0}
				<section class="lists">
					<div class="list-box">
						<h3>Your Exams <span class="muted">({selectedExams.length})</span></h3>
						<div class="courses-grid">
							{#each selectedExams as exam}
								<div class="list-item">
									<div class="course-main-info">
										<div class="course-header-row">
											<span class="mono">{exam.courseCode}</span>
											<button
												class="remove-btn"
												title="Remove this exam"
												onclick={() => removeExam(exam)}
											>
												×
											</button>
										</div>
										<span class="muted small">{exam.date} ({exam.day}) • {exam.time}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</section>
			{/if}
		</div>
	{/if}
</main>

<style>
	* {
		box-sizing: border-box;
	}

	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		color: #fff;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		min-height: 100vh;
	}

	.center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 2rem;
		gap: 1rem;
	}

	.muted {
		color: #666;
	}

	.small {
		font-size: 0.75rem;
	}

	.mono {
		font-family: "SF Mono", Monaco, monospace;
		font-size: 0.9rem;
	}

	/* App layout */
	.app {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	/* Header */
	.header {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #222;
		flex-wrap: wrap;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header h1 {
		font-size: 1.25rem;
		margin: 0;
	}

	.tag {
		font-size: 0.7rem;
		padding: 4px 8px;
		background: #222;
		border-radius: 4px;
		color: #888;
	}

	.search-wrap {
		flex: 1;
		min-width: 200px;
		max-width: 400px;
		position: relative;
	}

	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: #111;
		border: 1px solid #333;
		border-radius: 8px;
		max-height: 300px;
		overflow-y: auto;
		z-index: 100;
	}

	.dropdown-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #222;
		gap: 1rem;
	}

	.dropdown-item:last-child {
		border-bottom: none;
	}

	.dropdown-item.dimmed {
		opacity: 0.5;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.item-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.conflict-note {
		font-size: 0.7rem;
		color: #f59e0b;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	/* Calendar */
	.calendar-section {
		padding: 1.5rem;
	}

	.calendar-scroll-wrapper {
		overflow-x: auto;
		background: var(--bg);
		border: 1px solid #222;
		border-radius: 8px;
		padding: 1rem;
	}

	.calendar-container {
		min-width: fit-content;
	}

	.exam-calendar {
		display: grid;
		grid-template-columns: 80px repeat(var(--days), minmax(120px, 1fr));
		gap: 1px;
		background: #222;
		border-radius: 8px;
		overflow: hidden;
	}

	.time-gutter {
		background: var(--bg);
	}

	.day-header {
		background: #111;
		padding: 0.75rem;
		text-align: center;
		font-weight: 600;
		font-size: 0.85rem;
		border-left: 1px solid #222;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.day-date {
		font-size: 0.9rem;
		font-weight: 700;
	}

	.day-name {
		font-size: 0.7rem;
		color: #888;
		font-weight: 400;
	}

	.day-header.empty-day {
		opacity: 0.4;
	}

	.exam-slot.empty-slot {
		background: #050505;
	}

	.exam-slot.gap-slot {
		min-height: 24px;
		background: var(--bg-input);
		border-top: 1px dashed #1a1a1a;
	}

	.slot-label {
		background: var(--bg);
		padding: 1rem 0.5rem;
		text-align: right;
		font-size: 0.75rem;
		color: #666;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.slot-label.exam-time {
		color: #888;
		font-weight: 500;
	}

	.slot-label:not(.exam-time) {
		padding: 0.25rem 0.5rem;
		font-size: 0.65rem;
		color: #444;
	}

	.exam-slot {
		background: var(--bg-card);
		border-left: 1px solid #222;
		padding: 0.25rem;
		min-height: 100px;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.exam-block {
		background: #111;
		border: 1px solid #444;
		border-radius: 4px;
		padding: 0.75rem;
		cursor: pointer;
		transition: all 0.2s ease;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1);
	}

	.exam-block:hover {
		background: #1a1a1a;
		border-color: #666;
	}

	.block-code {
		font-family: "SF Mono", Monaco, monospace;
		font-size: 0.8rem;
		font-weight: 600;
	}

	/* Empty state */
	.empty-state {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4rem;
	}

	/* Lists */
	.lists {
		padding: 1.5rem;
	}

	.list-box h3 {
		font-size: 0.9rem;
		margin: 0 0 1rem 0;
	}

	.courses-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.list-item {
		background: #111;
		border: 1px solid #222;
		border-radius: 8px;
		padding: 0.75rem;
	}

	.course-main-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.course-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.remove-btn {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: #666;
		font-size: 1rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.remove-btn:hover {
		background: #2a0a0a;
		color: #ff6b6b;
	}

	/* Inputs */
	.input {
		width: 100%;
		padding: 0.6rem 0.9rem;
		background: #111;
		border: 1px solid #333;
		border-radius: 6px;
		color: #fff;
		font-size: 0.9rem;
	}

	.input:focus {
		outline: none;
		border-color: #555;
	}

	.input::placeholder {
		color: #555;
	}

	.btn {
		padding: 0.5rem 1rem;
		background: #222;
		border: 1px solid #333;
		border-radius: 6px;
		color: #fff;
		font-size: 0.85rem;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn:hover {
		background: #333;
		border-color: #444;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn.primary {
		background: #2563eb;
		border-color: #3b82f6;
	}

	.btn.primary:hover {
		background: #3b82f6;
	}

	.btn.small {
		padding: 0.35rem 0.75rem;
		font-size: 0.75rem;
	}

	.btn.secondary {
		background: transparent;
		border: 1px solid #333;
		color: #888;
	}

	.btn.secondary:hover {
		background: #111;
		border-color: #444;
		color: #fff;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.icon {
		display: flex;
		align-items: center;
	}

	.icon svg {
		width: 14px;
		height: 14px;
	}

	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			align-items: stretch;
		}

		.search-wrap {
			max-width: none;
		}

		.header-actions {
			justify-content: center;
			flex-wrap: wrap;
		}
	}
</style>
