<script lang="ts">
	import { onMount } from "svelte";
	import type { Course } from "$lib/types";
	import { DAYS, parseDays, timeToMinutes, minutesToTime } from "$lib/types";
	import {
		allCourses,
		currentBatches,
		selectedCourses,
		searchQuery,
		batchCourses,
		filteredCourses,
		getConflicts,
	} from "$lib/timetableStore";
	import { toPng } from "html-to-image";
	import { createEvents } from "ics";
	import type { EventAttributes } from "ics";

	let loading = $state(true);
	let error = $state("");
	let batchInputs = $state([""]);
	let searchInput = $state("");
	let batchError = $state("");
	let showDownloadModal = $state(false);
	let onlyShowUWE = $state(false);
	let selectedCourseDetails: Course | null = $state(null);
	let showKeyboardHelp = $state(false);
	let showUWEList = $state(false);
	let showCCCList = $state(false);
	let searchInputRef: HTMLInputElement | null = $state(null);

	// Helper to safely trigger download
	function triggerDownload(blobOrUrl: Blob | string, filename: string) {
		const link = document.createElement("a");
		if (typeof blobOrUrl === "string") {
			link.href = blobOrUrl;
		} else {
			link.href = URL.createObjectURL(blobOrUrl);
		}
		link.download = filename;
		document.body.appendChild(link);
		link.click();

		// Wait before cleaning up to ensure browser captures the download
		setTimeout(() => {
			document.body.removeChild(link);
			if (typeof blobOrUrl !== "string") {
				URL.revokeObjectURL(link.href);
			}
		}, 100);
	}

	// Helper to get next occurrence of a day
	function getNextDayDate(dayName: string): Date {
		const daysMap: Record<string, number> = {
			Sunday: 0,
			Monday: 1,
			Tuesday: 2,
			Wednesday: 3,
			Thursday: 4,
			Friday: 5,
			Saturday: 6,
		};
		const today = new Date();
		const targetDay = daysMap[dayName];
		const currentDay = today.getDay();

		let daysUntil = (targetDay - currentDay + 7) % 7;
		if (daysUntil === 0) daysUntil = 7; // Start next week if today

		const nextDate = new Date(today);
		nextDate.setDate(today.getDate() + daysUntil);
		return nextDate;
	}

	// Helper to parse HH:MM for ICS
	function parseTimeParts(timeStr: string): [number, number] {
		const mins = timeToMinutes(timeStr);
		return [Math.floor(mins / 60), mins % 60];
	}

	async function downloadImage() {
		const node = document.getElementById("timetable-calendar");
		if (!node) return;

		try {
			const dataUrl = await toPng(node, { backgroundColor: "#000000" });
			const cleanBatch = ($currentBatches.join("_") || "custom").replace(
				/[^a-z0-9]/gi,
				"_",
			);
			triggerDownload(dataUrl, `timetable-${cleanBatch}.png`);
		} catch (err) {
			console.error("Failed to download image", err);
			alert("Failed to download image");
		}
	}

	async function exportCalendar() {
		const effectiveBatch = getEffectiveCoursesList($batchCourses);
		const effectiveSelected = getEffectiveCoursesList($selectedCourses);
		const allEffective = [...effectiveBatch, ...effectiveSelected];

		const events: EventAttributes[] = [];
		const semesterEndDate = new Date();
		semesterEndDate.setMonth(semesterEndDate.getMonth() + 4); // 4 months from now
		const untilParts = [
			semesterEndDate.getFullYear(),
			semesterEndDate.getMonth() + 1,
			semesterEndDate.getDate(),
		] as [number, number, number];

		allEffective.forEach((course) => {
			if (!course.day || !course.startTime || !course.endTime) return;

			const courseDays = parseDays(course.day);
			const [startH, startM] = parseTimeParts(course.startTime);
			const [endH, endM] = parseTimeParts(course.endTime);

			const durationMins = endH * 60 + endM - (startH * 60 + startM);
			const duration = {
				hours: Math.floor(durationMins / 60),
				minutes: durationMins % 60,
			};

			courseDays.forEach((dayStr) => {
				const startDate = getNextDayDate(dayStr);

				events.push({
					start: [
						startDate.getFullYear(),
						startDate.getMonth() + 1,
						startDate.getDate(),
						startH,
						startM,
					],
					duration,
					title: `${course.courseCode.split("-")[0]} - ${course.courseName}`,
					description: `Faculty: ${course.faculty}\nType: ${course.courseType}\nComponent: ${course.component || course.slot}`,
					location: course.room,
					recurrenceRule: `FREQ=WEEKLY;INTERVAL=1;UNTIL=${untilParts[0]}${untilParts[1].toString().padStart(2, "0")}${untilParts[2].toString().padStart(2, "0")}T235959Z`,
					uid: `${course.courseCode}-${dayStr}-${Date.now()}@scooby.app`,
					calName: "Scooby Timetable",
				});
			});
		});

		createEvents(events, (error, value) => {
			if (error) {
				console.error(error);
				alert("Failed to create calendar file");
				return;
			}
			const blob = new Blob([value], {
				type: "text/calendar;charset=utf-8",
			});
			const cleanBatch = ($currentBatches.join("_") || "custom").replace(
				/[^a-z0-9]/gi,
				"_",
			);
			triggerDownload(blob, `timetable-${cleanBatch}.ics`);

			// Don't show modal ONLY on Safari on iOS as Safari autoopens ICS
			const ua = navigator.userAgent;
			const isIOS = /iPhone|iPad|iPod/.test(ua);
			const isNonSafariIOS = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
			const isIOSSafari = isIOS && !isNonSafariIOS;

			if (!isIOSSafari) {
				showDownloadModal = true;
			}
		});
	}

	let stateLoaded = false;

	function handleKeydown(e: KeyboardEvent) {
		// Don't trigger shortcuts when typing in inputs
		const target = e.target as HTMLElement;
		const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

		// Escape closes modals/dropdowns
		if (e.key === "Escape") {
			if (selectedCourseDetails) {
				selectedCourseDetails = null;
				e.preventDefault();
				return;
			}
			if (showKeyboardHelp) {
				showKeyboardHelp = false;
				e.preventDefault();
				return;
			}
			if (showDownloadModal) {
				showDownloadModal = false;
				e.preventDefault();
				return;
			}
			if (searchInput && !isInput) {
				searchInput = "";
				searchQuery.set("");
				e.preventDefault();
				return;
			}
			if (isInput) {
				(target as HTMLInputElement).blur();
				e.preventDefault();
				return;
			}
		}

		// Skip other shortcuts if typing
		if (isInput) return;

		// "/" or "s" focuses search
		if (e.key === "/" || e.key === "s") {
			e.preventDefault();
			searchInputRef?.focus();
			return;
		}

		// "?" shows keyboard help
		if (e.key === "?") {
			e.preventDefault();
			showKeyboardHelp = !showKeyboardHelp;
			return;
		}

		// "r" resets
		if (e.key === "r" && $currentBatches.length > 0) {
			e.preventDefault();
			reset();
			return;
		}

		// "p" downloads image
		if (e.key === "p" && $currentBatches.length > 0) {
			e.preventDefault();
			downloadImage();
			return;
		}

		// "c" exports calendar
		if (e.key === "c" && $currentBatches.length > 0) {
			e.preventDefault();
			exportCalendar();
			return;
		}
	}

	function openCourseDetails(course: Course) {
		selectedCourseDetails = course;
	}

	onMount(async () => {
		// Add keyboard listener
		window.addEventListener("keydown", handleKeydown);

		// Restore state from localStorage
		try {
			// Migrate old single batch to new array
			const savedBatch = localStorage.getItem("scooby_batch");
			const savedBatches = localStorage.getItem("scooby_batches");

			if (savedBatches) {
				currentBatches.set(JSON.parse(savedBatches));
			} else if (savedBatch) {
				currentBatches.set([savedBatch]);
			}

			const savedSelected = localStorage.getItem("scooby_selected");
			if (savedSelected) {
				selectedCourses.set(JSON.parse(savedSelected));
			}

			const savedSwapped = localStorage.getItem("scooby_swapped");
			if (savedSwapped) {
				swappedCourseCodes = new Map(JSON.parse(savedSwapped));
			}

			const savedExcluded = localStorage.getItem("scooby_excluded");
			if (savedExcluded) {
				excludedCourseCodes = new Set(JSON.parse(savedExcluded));
			}
		} catch (e) {
			console.error("Failed to restore state", e);
		} finally {
			stateLoaded = true;
		}

		try {
			const response = await fetch("/api/timetable?v=2");
			const data = await response.json();

			if (data.error) {
				error = data.error;
			} else {
				allCourses.set(data.courses);
			}
		} catch (e) {
			error = "Failed to load timetable data";
		} finally {
			loading = false;
		}
	});

	// Persist state changes
	$effect(() => {
		if (stateLoaded) {
			localStorage.setItem(
				"scooby_batches",
				JSON.stringify($currentBatches),
			);
		}
	});

	$effect(() => {
		if (stateLoaded) {
			localStorage.setItem(
				"scooby_selected",
				JSON.stringify($selectedCourses),
			);
		}
	});

	$effect(() => {
		if (stateLoaded) {
			localStorage.setItem(
				"scooby_swapped",
				JSON.stringify(Array.from(swappedCourseCodes.entries())),
			);
		}
	});

	$effect(() => {
		if (stateLoaded) {
			localStorage.setItem(
				"scooby_excluded",
				JSON.stringify(Array.from(excludedCourseCodes)),
			);
		}
	});

	// Get all unique batch codes from courses
	function getAllBatches(): string[] {
		const batches = new Set<string>();
		$allCourses.forEach((course) => {
			if (course.major) {
				course.major.split(/[\s,]+/).forEach((b) => {
					if (b.trim()) batches.add(b.trim().toUpperCase());
				});
			}
		});
		return [...batches].sort();
	}

	// Filter batches based on input
	function getSuggestionsFor(input: string) {
		if (!input || input.length < 1) return [];
		const query = input.toUpperCase();
		return getAllBatches()
			.filter((b) => b.includes(query) && b !== query)
			.slice(0, 15);
	}

	function selectBatch(batch: string, index: number) {
		batchInputs[index] = batch;
		batchError = "";

		// Auto-focus next input or blur
		setTimeout(() => {
			const nextInput = document.getElementById(
				`batch-input-${index + 1}`,
			);
			if (nextInput) {
				nextInput.focus();
			} else {
				document.getElementById(`batch-input-${index}`)?.blur();
			}
		}, 10);
	}

	function addBatchInput() {
		if (batchInputs.length < 4) {
			batchInputs = [...batchInputs, ""];
		}
	}

	function removeBatchInput(index: number) {
		batchInputs = batchInputs.filter((_, i) => i !== index);
	}

	function handleBatchSubmit() {
		const validBatches = getAllBatches();
		const inputsToProcess = batchInputs
			.map((b) => b.trim().toUpperCase())
			.filter((b) => b.length > 0);

		if (inputsToProcess.length === 0) return;

		const allValid = inputsToProcess.every((b) => validBatches.includes(b));

		if (allValid) {
			currentBatches.set(inputsToProcess);
			batchError = "";
		} else {
			batchError =
				"One or more batches are invalid. Please select from suggestions.";
		}
	}

	function handleSearch() {
		searchQuery.set(searchInput);
	}

	function addCourse(course: Course) {
		const conflicts = getConflicts(
			course,
			getEffectiveCoursesList($batchCourses),
			$selectedCourses,
		);
		if (conflicts.length > 0) return;

		selectedCourses.update((courses) => {
			if (courses.find((c) => c.sno === course.sno))
				return courses;
			return [...courses, course];
		});
		searchInput = "";
		searchQuery.set("");
	}

	function removeCourse(course: Course) {
		selectedCourses.update((courses) =>
			courses.filter((c) => c.sno !== course.sno),
		);
	}

	function isSelected(course: Course): boolean {
		return $selectedCourses.some((c) => c.sno === course.sno);
	}

	// function isSelected(course: Course): boolean {
	// 	return $selectedCourses.some((c) => c.courseCode === course.courseCode);
	// }

	function isBatchCourse(course: Course): boolean {
		return $batchCourses.some((c) => c.courseCode === course.courseCode);
	}

	function reset() {
		currentBatches.set([]);
		selectedCourses.set([]);
		batchInputs = [""];
		searchInput = "";
		searchQuery.set("");
		swappedCourseCodes = new Map();
		excludedCourseCodes = new Set();
	}

	// Convert slot/section to readable component type
	function getComponentType(slot: string | undefined): string {
		if (!slot) return "";
		const upper = slot.toUpperCase();
		if (upper.startsWith("LEC")) return "Lecture";
		if (upper.startsWith("TUT")) return "Tutorial";
		if (upper.startsWith("PRAC")) return "Practical";
		return "";
	}

	// Store for swapped components: original courseCode -> new courseCode
	let swappedCourseCodes = $state<Map<string, string>>(new Map());

	// Store for excluded/removed batch courses: courseCode
	let excludedCourseCodes = $state<Set<string>>(new Set());

	function getBaseCourseCode(courseCode: string): string {
		return courseCode.split("-")[0];
	}

	function getComponentPrefix(course: Course): string {
		const compVal = course.component?.toUpperCase() || "";
		if (compVal.startsWith("LEC")) return "LEC";
		if (compVal.startsWith("TUT")) return "TUT";
		if (compVal.startsWith("PRAC")) return "PRAC";

		const slotVal = course.slot?.toUpperCase() || "";
		if (slotVal.startsWith("LEC")) return "LEC";
		if (slotVal.startsWith("TUT")) return "TUT";
		if (slotVal.startsWith("PRAC")) return "PRAC";

		return "";
	}

	function getSection(course: Course): string {
		return course.slot || course.component || "";
	}

	function getAlternativeComponents(course: Course): Course[] {
		const baseCode = getBaseCourseCode(course.courseCode);
		const prefix = getComponentPrefix(course);

		if (!prefix) return [];

		// Get all courses matching base & prefix
		// We no longer exclude the current section so it appears in the list
		const candidates = $allCourses.filter((c) => {
			if (getBaseCourseCode(c.courseCode) !== baseCode) return false;
			if (getComponentPrefix(c) !== prefix) return false;
			return true;
		});

		// Return unique sections only (deduplicate by courseCode)
		const unique = new Map<string, Course>();
		candidates.forEach((c) => {
			if (!unique.has(c.courseCode)) {
				unique.set(c.courseCode, c);
			}
		});

		return Array.from(unique.values()).sort((a, b) =>
			getSection(a).localeCompare(getSection(b)),
		);
	}

	function swapComponent(originalCode: string, newCode: string) {
		swappedCourseCodes.set(originalCode, newCode);
		swappedCourseCodes = new Map(swappedCourseCodes);
	}

	function resetSwap(originalCode: string) {
		swappedCourseCodes.delete(originalCode);
		swappedCourseCodes = new Map(swappedCourseCodes);
	}

	function toggleExclusion(courseCode: string) {
		if (excludedCourseCodes.has(courseCode)) {
			excludedCourseCodes.delete(courseCode);
		} else {
			excludedCourseCodes.add(courseCode);
		}
		excludedCourseCodes = new Set(excludedCourseCodes);
	}

	// Get flattened list of effective courses (handling swaps and exclusions)
	function getEffectiveCoursesList(sourceCourses: Course[]): Course[] {
		// First, identify all unique course codes in source
		const uniqueCodes = new Set(sourceCourses.map((c) => c.courseCode));

		let result: Course[] = [];

		uniqueCodes.forEach((code) => {
			// Skip excluded courses
			if (excludedCourseCodes.has(code)) return;

			// Check if this code is swapped
			if (swappedCourseCodes.has(code)) {
				const newCode = swappedCourseCodes.get(code)!;
				// Find all rows for the new code in *all* courses
				const newRows = $allCourses.filter(
					(c) => c.courseCode === newCode,
				);
				result.push(...newRows);
			} else {
				// Keep original rows
				result.push(
					...sourceCourses.filter((c) => c.courseCode === code),
				);
			}
		});

		return result;
	}

	// Get unique courses for display (deduplicated by code)
	function getUniqueDisplayCourses(sourceCourses: Course[]): {
		original: Course;
		effective: Course;
		isSwapped: boolean;
		isExcluded: boolean;
	}[] {
		const uniqueMap = new Map<string, Course>(); // code -> first row

		sourceCourses.forEach((c) => {
			if (!uniqueMap.has(c.courseCode)) {
				uniqueMap.set(c.courseCode, c);
			}
		});

		return Array.from(uniqueMap.values()).map((original) => {
			const isExcluded = excludedCourseCodes.has(original.courseCode);
			const isSwapped = swappedCourseCodes.has(original.courseCode);
			let effective = original;

			if (!isExcluded && isSwapped) {
				const newCode = swappedCourseCodes.get(original.courseCode);
				const newCourse = $allCourses.find(
					(c) => c.courseCode === newCode,
				);
				if (newCourse) effective = newCourse;
			}

			return { original, effective, isSwapped, isExcluded };
		});
	}

	// Track which course is showing swap dropdown
	let showingSwapFor = $state<string | null>(null);

	function toggleSwapDropdown(courseCode: string) {
		if (showingSwapFor === courseCode) {
			showingSwapFor = null;
		} else {
			showingSwapFor = courseCode;
		}
	}

	// Calendar visualization
	interface CalendarBlock {
		course: Course;
		day: string;
		startMin: number;
		endMin: number;
		isAdded: boolean;
	}

	function buildCalendar(): {
		days: string[];
		minTime: number;
		maxTime: number;
		visibleMin: number;
		visibleMax: number;
		blocks: CalendarBlock[];
	} {
		// Get effective courses (with swaps applied) across all rows
		const effectiveBatch = getEffectiveCoursesList($batchCourses);
		const effectiveSelected = getEffectiveCoursesList($selectedCourses);
		const courses = [...effectiveBatch, ...effectiveSelected];

		const usedDays = new Set<string>();
		const blocks: CalendarBlock[] = [];
		let minTime = 24 * 60;
		let maxTime = 0;

		courses.forEach((course) => {
			if (!course.day || !course.startTime || !course.endTime) return;

			const days = parseDays(course.day);
			const startMin = timeToMinutes(course.startTime);
			const endMin = timeToMinutes(course.endTime);

			if (startMin >= endMin) return;

			minTime = Math.min(minTime, startMin);
			maxTime = Math.max(maxTime, endMin);

			days.forEach((day) => {
				usedDays.add(day);
				blocks.push({
					course,
					day,
					startMin,
					endMin,
					isAdded: isSelected(course),
				});
			});
		});

		// Round to nearest hour
		minTime = Math.floor(minTime / 60) * 60;

		// ... (rest of function)
		maxTime = Math.ceil(maxTime / 60) * 60;

		// Ensure we have at least some range
		if (minTime >= maxTime) {
			minTime = 8 * 60;
			maxTime = 18 * 60;
		}

		// Use same values for visible/coordinate system
		const visibleMin = minTime;
		const visibleMax = maxTime;

		// Always show Mon-Fri, only include Saturday if there are classes
		const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
		const days = usedDays.has('Saturday') ? [...weekdays, 'Saturday'] : weekdays;
		return { days, minTime, maxTime, visibleMin, visibleMax, blocks };
	}

	function getTimeLabels(
		minTime: number,
		maxTime: number,
	): { time: number; label: string }[] {
		const labels: { time: number; label: string }[] = [];
		for (let t = minTime; t <= maxTime; t += 60) {
			labels.push({ time: t, label: minutesToTime(t) });
		}
		return labels;
	}

	let calendar = $derived(buildCalendar());
	let timeLabels = $derived(
		getTimeLabels(calendar.visibleMin, calendar.visibleMax),
	);
	let totalMinutes = $derived(calendar.maxTime - calendar.minTime);

	// Derived: hidden courses
	let hiddenCourses = $derived(
		getUniqueDisplayCourses($batchCourses).filter((c) => c.isExcluded),
	);

	const VERTICAL_PADDING = 20;
	// Calculate calendar height: 60px per hour + padding
	let calendarHeight = $derived(
		Math.max(500, (totalMinutes / 60) * 60) + VERTICAL_PADDING * 2,
	);
</script>

<main class="main">
	{#if loading}
		<div class="center">
			<p class="muted">Loading...</p>
		</div>
	{:else if error}
		<div class="center">
			<h2>No Timetable</h2>
			<p class="muted">{error}</p>
			<p class="muted small">
				Put your file in: <code>src/lib/data/</code>
			</p>
		</div>
	{:else if $currentBatches.length === 0}
		<div class="center">
			<div class="batch-form">
				<h1>Scooby</h1>
				<p class="muted">Enter your batch code(s)</p>
				<div class="batch-tip">
					<span class="tip-icon">💡</span>
					<span
						>Add <strong>all</strong> your batches. e.g. ECE 2nd
						years have both <strong>ELC2X</strong> and
						<strong>ELC2YR</strong>. CSE 2nd years have both
						<strong>CSDXX</strong> and <strong>CSD2YR</strong>.</span
					>
				</div>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleBatchSubmit();
					}}
				>
					{#each batchInputs as input, i}
						{@const suggestions = getSuggestionsFor(input)}
						{@const isValid = getAllBatches().includes(
							input.trim().toUpperCase(),
						)}
						<div class="batch-input-row">
							<div class="batch-input-wrap">
								<input
									type="text"
									id="batch-input-{i}"
									class="input"
									class:error={!!batchError}
									class:valid={isValid}
									placeholder="e.g. ELC26, DES2YR, CSD21"
									bind:value={batchInputs[i]}
									oninput={() => (batchError = "")}
									autocomplete="off"
								/>
								{#if suggestions.length > 0}
									<div class="batch-suggestions">
										{#each suggestions as batch}
											<button
												type="button"
												class="batch-option"
												onclick={() =>
													selectBatch(batch, i)}
											>
												{batch}
											</button>
										{/each}
									</div>
								{/if}
							</div>
							{#if batchInputs.length > 1}
								<button
									type="button"
									class="remove-batch-btn"
									onclick={() => removeBatchInput(i)}
									title="Remove batch">×</button
								>
							{/if}
						</div>
					{/each}

					{#if batchInputs.length < 4}
						<button
							type="button"
							class="add-batch-btn"
							onclick={addBatchInput}>+ Add another batch</button
						>
					{/if}
					{#if batchError}
						<div class="error-msg">{batchError}</div>
					{/if}
					<button type="submit" class="btn primary">Load</button>
				</form>
			</div>
		</div>
	{:else}
		<div class="app">
			<!-- Header -->
			<header class="header">
				<div class="header-left">
					<h1>Scooby</h1>
					<div class="tags-row">
						{#each $currentBatches as batch}
							<span class="tag">{batch}</span>
						{/each}
					</div>
				</div>

				<div class="search-wrap">
					<input
						type="text"
						class="input"
						placeholder="Add course/UWE/CCC  (Press / to search)"
						bind:value={searchInput}
						bind:this={searchInputRef}
						oninput={handleSearch}
					/>
					{#if $filteredCourses.length > 0}
						<div class="dropdown">
							<div class="dropdown-filter">
								<label class="uwe-toggle">
									<input
										type="checkbox"
										bind:checked={onlyShowUWE}
									/>
									<span class="toggle-label">Open as UWE</span>
								</label>
							</div>
							{#each onlyShowUWE ? $filteredCourses.filter(c => c.openAsUWE) : $filteredCourses as course}
								{@const conflicts = getConflicts(
									course,
									getEffectiveCoursesList($batchCourses),
									$selectedCourses,
								)}
								{@const hasConflict = conflicts.length > 0}
								{@const selected = isSelected(course)}
								{@const batch = isBatchCourse(course)}
								<div
									class="dropdown-item"
									class:dimmed={hasConflict}
								>
									<div class="item-info">
										<div class="item-row">
											<span class="mono"
												>{course.courseCode.split(
													"-",
												)[0]}{#if getComponentType(course.component)}
													<span class="comp-label"
														>({getComponentType(
															course.component,
														)})</span
													>{/if}</span
											>
											{#if course.day}
												<span class="muted small"
													>{course.day}
													{course.startTime}-{course.endTime}</span
												>
											{/if}
										</div>
										<span class="item-name"
											>{course.courseName}</span
										>
										{#if course.courseType || course.component}
											<span class="item-type"
												>{course.courseType}{course.courseType &&
												course.component
													? " • "
													: ""}{course.component}</span
											>
										{/if}
										{#if hasConflict}
											<span class="conflict-note"
												>⚠ Conflicts: {conflicts
													.map(
														(c) =>
															`${c.courseCode.split("-")[0]}${getComponentType(c.component) ? ` (${getComponentType(c.component)})` : ""}`,
													)
													.join(", ")}</span
											>
										{/if}
									</div>
									<div class="item-action">
										{#if batch}
											<span class="tag small">Yours</span>
										{:else if selected}
											<button
												class="btn small"
												onclick={() =>
													removeCourse(course)}
												>Remove</button
											>
										{:else}
											<button
												class="btn small"
												onclick={() =>
													addCourse(course)}
												disabled={hasConflict}
											>
												{hasConflict
													? "Conflict"
													: "Add"}
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="header-actions">
					<button
						class="btn secondary action-btn"
						onclick={downloadImage}
					>
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
								><path
									d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
								/><circle cx="12" cy="13" r="4" /></svg
							>
						</span>
						Save Image
					</button>
					<button
						class="btn secondary action-btn"
						onclick={exportCalendar}
					>
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
								><rect
									x="3"
									y="4"
									width="18"
									height="18"
									rx="2"
									ry="2"
								/><line x1="16" y1="2" x2="16" y2="6" /><line
									x1="8"
									y1="2"
									x2="8"
									y2="6"
								/><line x1="3" y1="10" x2="21" y2="10" /></svg
							>
						</span>
						Export Calendar
					</button>
					<button class="btn secondary" onclick={() => showUWEList = true} title="View all UWE courses">UWE List</button>
					<button class="btn secondary" onclick={() => showCCCList = true} title="View all CCC courses">CCC List</button>
					<button class="btn" onclick={reset}>Reset</button>
					<button class="btn keyboard-help-btn" onclick={() => showKeyboardHelp = true} title="Keyboard shortcuts (?)">
						<span class="kbd-icon">⌨</span>
					</button>
				</div>
			</header>

			<!-- Calendar View -->
			{#if calendar.days.length > 0}
				<section class="calendar-section">
					<div class="calendar-scroll-wrapper">
						<div class="calendar-container" id="timetable-calendar">
							<div
								class="calendar"
								style="--days: {calendar.days.length}"
							>
								<!-- Day headers -->
								<div class="time-gutter"></div>
								{#each calendar.days as day}
									<div class="day-header">{day}</div>
								{/each}

								<!-- Time grid -->
								<div
									class="time-column"
									style="height: {calendarHeight}px"
								>
									<div
										style="position: absolute; top: {VERTICAL_PADDING}px; width: 100%; height: {(totalMinutes /
											60) *
											60}px"
									>
										{#each timeLabels as { time, label }}
											<div
												class="time-label"
												style="top: {((time -
													calendar.minTime) /
													totalMinutes) *
													100}%"
											>
												{label}
											</div>
										{/each}
									</div>
								</div>

								<!-- Day columns with courses -->
								{#each calendar.days as day, dayIndex}
									<div
										class="day-column"
										style="height: {calendarHeight}px"
									>
										<!-- Content Wrapper to match Time Column -->
										<div
											style="position: absolute; top: {VERTICAL_PADDING}px; width: 100%; height: {(totalMinutes /
												60) *
												60}px"
										>
											<!-- Hour lines -->
											{#each timeLabels as { time }}
												<div
													class="hour-line"
													style="top: {((time -
														calendar.minTime) /
														totalMinutes) *
														100}%"
												></div>
											{/each}

											<!-- Course blocks -->
											{#each calendar.blocks.filter((b) => b.day === day) as block}
												{@const top =
													((block.startMin -
														calendar.minTime) /
														totalMinutes) *
													100}
												{@const height = Math.max(
													((block.endMin -
														block.startMin) /
														totalMinutes) *
														100,
													8,
												)}
												<div
													class="course-block"
													class:added={block.isAdded}
													style="top: {top}%; height: {height}%; min-height: 45px"
													onclick={() => openCourseDetails(block.course)}
													role="button"
													tabindex="0"
													onkeydown={(e) => e.key === 'Enter' && openCourseDetails(block.course)}
												>
													<span class="block-code">
														{block.course.courseCode.split(
															"-",
														)[0]}
														{#if getComponentType(block.course.component)}
															<span
																class="comp-label"
																>({getComponentType(
																	block.course
																		.component,
																)})</span
															>
														{/if}
													</span>
													<span class="block-name"
														>{block.course
															.courseName}</span
													>
													{#if block.course.courseType || block.course.component}
														<span class="block-type">
															{block.course.courseType}
															{block.course.courseType && block.course.component ? " • " : ""}
															{block.course.component}
															{(block.course.courseType || block.course.component) && block.course.room ? " • " : ""}
															{block.course.room}
														</span>
													{/if}
													<!-- <span class="block-room"
														>{block.course
															.room}</span
													> -->
												</div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</section>
			{/if}

			<!-- Course Lists -->
			<section class="lists">
				<div class="list-box">
					<h3>
						Your Courses <span class="muted"
							>({getEffectiveCoursesList($batchCourses).length})</span
						>
					</h3>
					<div class="courses-grid">
						{#each getUniqueDisplayCourses($batchCourses) as { original: originalCourse, effective: course, isSwapped, isExcluded }}
							{#if !isExcluded}
								{@const alternatives =
									getAlternativeComponents(originalCourse)}
								<div
									class="list-item clickable"
									class:swapped={isSwapped}
									onclick={() => openCourseDetails(course)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && openCourseDetails(course)}
									title="Click for details"
								>
									<div class="course-main-info">
										<div class="course-header-row">
											<span class="mono">
												{course.courseCode.split(
													"-",
												)[0]}
												{#if getComponentType(course.component)}
													<span class="comp-label"
														>({getComponentType(
															course.component,
														)})</span
													>
												{/if}
												<span class="info-hint">ⓘ</span>
											</span>
											<div class="header-right-group">
												{#if alternatives.length > 0}
													<button
														class="swap-btn"
														onclick={(e) => {
															e.stopPropagation();
															toggleSwapDropdown(
																originalCourse.courseCode,
															);
														}}
														title="Change section ({alternatives.length} alternatives)"
													>
														⇄ {getSection(course)}
													</button>
												{:else}
													<span class="slot-label"
														>{getSection(
															course,
														)}</span
													>
												{/if}
												<button
													class="remove-btn"
													title="Remove this course"
													onclick={(e) => {
														e.stopPropagation();
														toggleExclusion(
															originalCourse.courseCode,
														);
													}}
												>
													×
												</button>
											</div>
										</div>
										<span class="item-name"
											>{course.courseName}</span
										>
										{#if course.courseType || course.component}
											<span class="item-type">
												{course.courseType}{course.courseType &&
												course.component
													? " • "
													: ""}{course.component}
											</span>
										{/if}
										<span class="muted small">
											{course.day}
											{course.startTime}-{course.endTime} •
											{course.room}
										</span>
										{#if isSwapped}
											<button
												class="reset-swap-btn"
												onclick={(e) => {
													e.stopPropagation();
													resetSwap(
														originalCourse.courseCode,
													);
												}}
											>
												↩ Reset to {getSection(
													originalCourse,
												)}
											</button>
										{/if}
									</div>

									{#if showingSwapFor === originalCourse.courseCode && alternatives.length > 0}
										<div class="swap-dropdown">
											<div class="swap-header">
												Change {getComponentType(
													course.component,
												) || "Section"}:
											</div>
											{#each alternatives as alt}
												{@const conflicts =
													getConflicts(
														alt,
														getEffectiveCoursesList(
															$batchCourses.filter(
																(c) =>
																	c.courseCode !==
																	originalCourse.courseCode,
															),
														),
														$selectedCourses,
													)}
												<button
													class="swap-option"
													class:has-conflict={conflicts.length >
														0}
													class:is-current={alt.courseCode ===
														course.courseCode}
													onclick={(e) => {
														e.stopPropagation();
														if (
															alt.courseCode ===
															course.courseCode
														)
															return;
														swapComponent(
															originalCourse.courseCode,
															alt.courseCode,
														);
														showingSwapFor = null;
													}}
													disabled={conflicts.length >
														0}
												>
													<span class="swap-slot">
														{getSection(alt)}
														{#if alt.courseCode === course.courseCode}
															<span
																class="current-badge"
																>(Current)</span
															>
														{/if}
													</span>
													<span class="swap-time"
														>{alt.day}
														{alt.startTime}-{alt.endTime}</span
													>
													<span class="swap-room"
														>{alt.room}</span
													>
													{#if conflicts.length > 0}
														<span
															class="swap-conflict"
														>
															⚠ Conflicts with: {conflicts
																.map(
																	(c) =>
																		`${c.courseCode.split("-")[0]}${getComponentType(c.component) ? ` (${getComponentType(c.component)})` : ""}`,
																)
																.join(", ")}
														</span>
													{/if}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
					{#if $batchCourses.length === 0}
						<p class="muted">
							No courses for {$currentBatches.join(", ")}
						</p>
					{/if}

					<!-- Hidden Courses Section -->
					{#if hiddenCourses.length > 0}
						<div class="hidden-courses">
							<h4>Hidden Courses ({hiddenCourses.length})</h4>
							<div class="hidden-list">
								{#each hiddenCourses as { original: course }}
									<div class="hidden-item">
										<span
											>{course.courseCode.split("-")[0]} -
											{course.courseName}</span
										>
										<button
											class="restore-btn"
											onclick={() =>
												toggleExclusion(
													course.courseCode,
												)}>Restore</button
										>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				{#if $selectedCourses.length > 0}
					<div class="list-box">
						<h3>
							Added <span class="muted"
								>({$selectedCourses.length})</span
							>
						</h3>
						{#each $selectedCourses as course}
							<div class="list-item added">
								<div>
									<span class="mono"
										>{course.courseCode.split(
											"-",
										)[0]}{#if getComponentType(course.component)}
											<span class="comp-label"
												>({getComponentType(
													course.component,
												)})</span
											>{/if}</span
									>
									<span class="item-name"
										>{course.courseName}</span
									>
									{#if course.courseType || course.component}
										<span class="item-type"
											>{course.courseType}{course.courseType &&
											course.component
												? " • "
												: ""}{course.component}</span
										>
									{/if}
									<span class="muted small"
										>{course.day}
										{course.startTime}-{course.endTime}</span
									>
								</div>
								<button
									class="btn small"
									onclick={() => removeCourse(course)}
									>×</button
								>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	{/if}

	<!-- Download Instructions Modal -->
	{#if showDownloadModal}
		<div class="modal-overlay">
			<div class="modal">
				<h2>Calendar Downloaded!</h2>
				<p>Your <code>.ics</code> file has been downloaded.</p>
				<p class="instruction">
					Please <strong>open the downloaded file</strong> to import these
					events into your calendar application (Apple Calendar, Google
					Calendar, Outlook, etc.).
				</p>
				<button
					class="btn primary"
					onclick={() => (showDownloadModal = false)}>Got it</button
				>
			</div>
		</div>
	{/if}

	<!-- Course Details Modal -->
	{#if selectedCourseDetails}
		<div class="modal-overlay course-details-overlay" onclick={() => selectedCourseDetails = null} role="button" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (selectedCourseDetails = null)}>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="modal course-modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (selectedCourseDetails = null)}>
				<button class="modal-close" onclick={() => selectedCourseDetails = null}>×</button>
				<h2>{selectedCourseDetails.courseCode.split("-")[0]}</h2>
				<p class="course-modal-name">{selectedCourseDetails.courseName}</p>
				
				<div class="course-modal-grid">
					{#if selectedCourseDetails.faculty}
						<div class="course-modal-item">
							<span class="modal-label">Faculty</span>
							<span class="modal-value">{selectedCourseDetails.faculty}</span>
						</div>
					{/if}
					{#if selectedCourseDetails.room}
						<div class="course-modal-item">
							<span class="modal-label">Room</span>
							<span class="modal-value">{selectedCourseDetails.room}</span>
						</div>
					{/if}
					{#if selectedCourseDetails.day}
						<div class="course-modal-item">
							<span class="modal-label">Schedule</span>
							<span class="modal-value">{selectedCourseDetails.day} {selectedCourseDetails.startTime}-{selectedCourseDetails.endTime}</span>
						</div>
					{/if}
					{#if selectedCourseDetails.credits}
						<div class="course-modal-item">
							<span class="modal-label">Credits</span>
							<span class="modal-value">{selectedCourseDetails.credits}</span>
						</div>
					{/if}
					{#if selectedCourseDetails.courseType}
						<div class="course-modal-item">
							<span class="modal-label">Type</span>
							<span class="modal-value">{selectedCourseDetails.courseType}</span>
						</div>
					{/if}
					{#if selectedCourseDetails.component || selectedCourseDetails.slot}
						<div class="course-modal-item">
							<span class="modal-label">Section</span>
							<span class="modal-value">{selectedCourseDetails.slot || selectedCourseDetails.component}</span>
						</div>
					{/if}
					{#if selectedCourseDetails.openAsUWE !== undefined}
						<div class="course-modal-item">
							<span class="modal-label">Open as UWE</span>
							<span class="modal-value">{selectedCourseDetails.openAsUWE ? "Yes" : "No"}</span>
						</div>
					{/if}
					{#if selectedCourseDetails.remarks}
						<div class="course-modal-item full-width">
							<span class="modal-label">Remarks</span>
							<span class="modal-value">{selectedCourseDetails.remarks}</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Keyboard Shortcuts Help Modal -->
	{#if showKeyboardHelp}
		<div class="modal-overlay" onclick={() => showKeyboardHelp = false} role="button" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (showKeyboardHelp = false)}>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="modal keyboard-modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (showKeyboardHelp = false)}>
				<button class="modal-close" onclick={() => showKeyboardHelp = false}>×</button>
				<h2>Keyboard Shortcuts</h2>
				
				<div class="shortcuts-list">
					<div class="shortcut-item">
						<kbd>/</kbd> or <kbd>S</kbd>
						<span>Focus search</span>
					</div>
					<div class="shortcut-item">
						<kbd>Esc</kbd>
						<span>Close modal / Clear search</span>
					</div>
					<div class="shortcut-item">
						<kbd>P</kbd>
						<span>Save as image</span>
					</div>
					<div class="shortcut-item">
						<kbd>C</kbd>
						<span>Export calendar</span>
					</div>
					<div class="shortcut-item">
						<kbd>R</kbd>
						<span>Reset timetable</span>
					</div>
					<div class="shortcut-item">
						<kbd>?</kbd>
						<span>Show this help</span>
					</div>
				</div>
				
				<button class="btn primary" onclick={() => showKeyboardHelp = false}>Got it</button>
			</div>
		</div>
	{/if}

	<!-- UWE Courses List Modal -->
	{#if showUWEList}
		{@const uweCourses = $allCourses.filter(c => c.openAsUWE)}
		<div class="modal-overlay" onclick={() => showUWEList = false} role="button" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (showUWEList = false)}>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="modal course-list-modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (showUWEList = false)}>
				<button class="modal-close" onclick={() => showUWEList = false}>×</button>
				<h2>Open as UWE Courses ({uweCourses.length})</h2>
				
				<div class="course-list-container">
					{#each uweCourses as course}
						{@const conflicts = getConflicts(course, getEffectiveCoursesList($batchCourses), $selectedCourses)}
						{@const hasConflict = conflicts.length > 0}
						{@const selected = isSelected(course)}
						{@const batch = isBatchCourse(course)}
						{@const compType = getComponentType(course.component)}
						<div class="course-list-item" class:dimmed={hasConflict}>
							<div class="course-list-info" onclick={() => openCourseDetails(course)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && openCourseDetails(course)} title="Click for details">
								<div class="course-list-header">
									<span class="mono">{course.courseCode.split("-")[0]}</span>
									{#if compType}
										<span class="comp-badge">{compType}</span>
									{/if}
									<span class="info-hint">ⓘ</span>
								</div>
								<span class="course-list-name">{course.courseName}</span>
								{#if course.day}
									<span class="muted small">{course.day} {course.startTime}-{course.endTime}</span>
								{/if}
								{#if hasConflict}
									<span class="conflict-info">⚠️ Conflicts with: {conflicts.map(c => c.courseCode.split("-")[0]).join(", ")}</span>
								{/if}
							</div>
							<div class="course-list-actions">
								{#if batch}
									<span class="badge">Batch</span>
								{:else if selected}
									<button class="btn small danger" onclick={() => removeCourse(course)}>Remove</button>
								{:else if hasConflict}
									<span class="badge warning">Conflict</span>
								{:else}
									<button class="btn small" onclick={() => addCourse(course)}>Add</button>
								{/if}
							</div>
						</div>
					{:else}
						<p class="muted">No UWE courses found.</p>
					{/each}
				</div>
				
				<button class="btn primary" onclick={() => showUWEList = false}>Close</button>
			</div>
		</div>
	{/if}

	<!-- CCC Courses List Modal -->
	{#if showCCCList}
		{@const cccCourses = $allCourses.filter(c => c.courseCode.toUpperCase().startsWith('CCC'))}
		<div class="modal-overlay" onclick={() => showCCCList = false} role="button" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (showCCCList = false)}>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="modal course-list-modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (showCCCList = false)}>
				<button class="modal-close" onclick={() => showCCCList = false}>×</button>
				<h2>CCC Courses ({cccCourses.length})</h2>
				
				<div class="course-list-container">
					{#each cccCourses as course}
						{@const conflicts = getConflicts(course, getEffectiveCoursesList($batchCourses), $selectedCourses)}
						{@const hasConflict = conflicts.length > 0}
						{@const selected = isSelected(course)}
						{@const batch = isBatchCourse(course)}
						{@const compType = getComponentType(course.component)}
						<div class="course-list-item" class:dimmed={hasConflict}>
							<div class="course-list-info" onclick={() => openCourseDetails(course)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && openCourseDetails(course)} title="Click for details">
								<div class="course-list-header">
									<span class="mono">{course.courseCode.split("-")[0]}</span>
									{#if compType}
										<span class="comp-badge">{compType}</span>
									{/if}
									<span class="info-hint">ⓘ</span>
								</div>
								<span class="course-list-name">{course.courseName}</span>
								{#if course.day}
									<span class="muted small">{course.day} {course.startTime}-{course.endTime}</span>
								{/if}
								{#if hasConflict}
									<span class="conflict-info">⚠️ Conflicts with: {conflicts.map(c => c.courseCode.split("-")[0]).join(", ")}</span>
								{/if}
							</div>
							<div class="course-list-actions">
								{#if batch}
									<span class="badge">Batch</span>
								{:else if selected}
									<button class="btn small danger" onclick={() => removeCourse(course)}>Remove</button>
								{:else if hasConflict}
									<span class="badge warning">Conflict</span>
								{:else}
									<button class="btn small" onclick={() => addCourse(course)}>Add</button>
								{/if}
							</div>
						</div>
					{:else}
						<p class="muted">No CCC courses found.</p>
					{/each}
				</div>
				
				<button class="btn primary" onclick={() => showCCCList = false}>Close</button>
			</div>
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
		background: #000;
		color: #fff;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	}

	.center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 2rem;
	}

	.batch-form {
		width: 100%;
		max-width: 280px;
	}

	.batch-form h1 {
		margin-bottom: 0.5rem;
	}
	.batch-form p {
		margin-bottom: 1.5rem;
	}
	.batch-form form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.batch-form .input {
		text-align: center;
		text-transform: uppercase;
	}

	.batch-input-wrap {
		position: relative;
	}

	.batch-suggestions {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: #0a0a0a;
		border: 1px solid #222;
		border-radius: 6px;
		margin-top: 4px;
		max-height: 200px;
		overflow-y: auto;
		z-index: 100;
	}

	.batch-option {
		display: block;
		width: 100%;
		padding: 0.6rem 0.75rem;
		background: none;
		border: none;
		border-bottom: 1px solid #1a1a1a;
		color: #fff;
		font-size: 0.85rem;
		font-family: "SF Mono", monospace;
		cursor: pointer;
		text-align: center;
	}

	.batch-option:last-child {
		border-bottom: none;
	}

	.batch-option:hover {
		background: #111;
	}

	code {
		background: #111;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-family: monospace;
	}

	.muted {
		color: #666;
	}
	.small {
		font-size: 0.75rem;
	}
	.mono {
		font-family: "SF Mono", monospace;
		font-size: 0.85rem;
	}
	.comp-label {
		color: #777;
		font-weight: 400;
		font-size: 0.75rem;
	}

	/* App layout */
	.app {
		width: 100%;
		max-width: 1400px;
		margin: 0 auto;
		padding: 1rem;
	}

	/* Header */
	.header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #1a1a1a;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header h1 {
		font-size: 1.25rem;
		font-weight: 500;
	}

	.tag {
		padding: 0.2rem 0.5rem;
		background: #111;
		border-radius: 4px;
		font-size: 0.7rem;
		color: #888;
	}
	.tag.small {
		font-size: 0.65rem;
		padding: 0.15rem 0.4rem;
	}

	.search-wrap {
		flex: 1;
		min-width: 200px;
		max-width: 450px;
		position: relative;
	}

	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: #0a0a0a;
		border: 1px solid #222;
		border-radius: 8px;
		margin-top: 4px;
		max-height: 350px;
		overflow-y: auto;
		z-index: 100;
	}

	.dropdown-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid #1a1a1a;
	}
	.dropdown-item:last-child {
		border-bottom: none;
	}
	.dropdown-item:hover {
		background: #111;
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.dropdown-filter {
		position: sticky;
		top: 0;
		background: #0a0a0a;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #222;
		z-index: 1;
	}

	.uwe-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.5rem;
		background: #151515;
		border: 1px solid #222;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.75rem;
		color: #888;
		width: fit-content;
	}

	.uwe-toggle:hover {
		background: #1a1a1a;
		border-color: #333;
	}

	.uwe-toggle:has(input:checked) {
		background: #1a1a1a;
		border-color: #444;
		color: #fff;
	}

	.uwe-toggle input {
		width: 14px;
		height: 14px;
		margin: 0;
		accent-color: #fff;
		cursor: pointer;
	}

	.toggle-label {
		font-weight: 500;
		white-space: nowrap;
	}

	.dropdown-item.dimmed {
		opacity: 0.5;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.item-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	.item-name {
		font-size: 0.8rem;
		color: #888;
	}
	.item-type {
		font-size: 0.7rem;
		color: #555;
		font-style: italic;
	}
	.conflict-note {
		font-size: 0.7rem;
		color: #555;
		font-style: italic;
	}

	.item-action {
		flex-shrink: 0;
	}

	/* Calendar */
	.calendar-section {
		margin-bottom: 2rem;
	}

	.calendar-scroll-wrapper {
		overflow-x: auto;
		overflow-y: hidden; /* Prevent Y scrollbar on wrapper */
		background: #050505;
		border: 1px solid #1a1a1a;
		border-radius: 8px;
		padding: 0 20px;
	}

	.calendar-container {
		overflow: visible;
		height: auto;
		min-width: max-content;
		background: #050505;
	}

	.calendar {
		display: grid;
		grid-template-columns: 70px repeat(var(--days), minmax(120px, 1fr));
		min-width: max-content;
		position: relative;
		height: max-content;
	}

	.time-gutter {
		background: #050505;
		border-right: 1px solid #1a1a1a;
		border-bottom: 1px solid #1a1a1a;
	}

	.day-header {
		padding: 0.75rem;
		text-align: center;
		font-size: 0.85rem;
		font-weight: 500;
		background: #050505;
		border-bottom: 1px solid #1a1a1a;
		border-right: 1px solid #111;
	}
	.day-header:last-child {
		border-right: none;
	}

	.time-column {
		position: relative;
		background: #050505;
		border-right: 1px solid #1a1a1a;
	}

	.time-label {
		position: absolute;
		right: 8px;
		transform: translateY(-50%);
		font-size: 0.65rem;
		color: #555;
		font-family: "SF Mono", monospace;
		white-space: nowrap;
	}

	.day-column {
		position: relative;
		border-right: 1px solid #111;
	}
	.day-column:last-child {
		border-right: none;
	}

	.hour-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: #1a1a1a;
	}

	.course-block {
		position: absolute;
		left: 2px;
		right: 2px;
		background: #111;
		border: 1px solid #222;
		border-radius: 4px;
		padding: 4px 6px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 1px;
		cursor: pointer;
		transition:
			z-index 0s,
			transform 0.15s,
			box-shadow 0.15s;
	}

	.course-block:hover {
		z-index: 50;
		transform: scale(1.05);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		overflow: visible;
		min-height: fit-content !important;
		background: #1a1a1a;
	}

	.course-block:hover .block-name,
	.course-block:hover .block-code,
	.course-block:hover .block-type,
	.course-block:hover .block-room {
		white-space: normal;
		overflow: visible;
		word-break: break-word;
	}

	.course-block.added {
		border-left: 2px solid #444;
	}

	.block-code {
		font-family: "SF Mono", monospace;
		font-size: 0.7rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.block-name {
		font-size: 0.65rem;
		color: #888;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.block-type {
		font-size: 0.6rem;
		color: #666;
		font-style: italic;
	}

	.block-room {
		font-size: 0.6rem;
		color: #555;
	}

	/* Lists */
	.lists {
		display: grid;
		gap: 1.5rem;
	}

	.list-box h3 {
		font-size: 0.9rem;
		font-weight: 500;
		margin-bottom: 0.75rem;
	}

	.courses-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.list-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0.6rem 0.75rem;
		background: #0a0a0a;
		border: 1px solid #151515;
		border-radius: 6px;
		margin-bottom: 0.5rem;
	}

	.list-item.clickable {
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.list-item.clickable:hover {
		background: #111;
		border-color: #252525;
	}

	.list-item.added {
		flex-direction: row;
		justify-content: space-between;
		align-items: flex-start;
		border-left: 2px solid #333;
	}

	.list-item.swapped {
		border-left: 2px solid #555;
		background: #0d0d0d;
	}

	.course-main-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}

	.course-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.swap-btn {
		padding: 0.3rem 0.6rem;
		background: #fff;
		border: 1px solid #fff;
		border-radius: 4px;
		color: #000;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		font-family: "SF Mono", monospace;
	}

	.swap-btn:hover {
		background: #e0e0e0;
		border-color: #e0e0e0;
	}

	.slot-label {
		font-size: 0.7rem;
		color: #555;
		font-family: "SF Mono", monospace;
	}

	.reset-swap-btn {
		margin-top: 0.3rem;
		padding: 0.2rem 0.4rem;
		background: none;
		border: 1px solid #333;
		border-radius: 4px;
		color: #666;
		font-size: 0.65rem;
		cursor: pointer;
	}

	.reset-swap-btn:hover {
		background: #1a1a1a;
		color: #888;
	}

	.swap-dropdown {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid #222;
	}

	.swap-header {
		font-size: 0.7rem;
		color: #666;
		margin-bottom: 0.4rem;
	}

	.swap-option {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		width: 100%;
		padding: 0.5rem;
		background: #111;
		border: 1px solid #222;
		border-radius: 4px;
		margin-bottom: 0.3rem;
		color: #fff;
		font-size: 0.75rem;
		cursor: pointer;
		text-align: left;
	}

	.swap-option:hover:not(:disabled) {
		background: #1a1a1a;
		border-color: #333;
	}

	.swap-option:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.swap-option.has-conflict {
		opacity: 0.5;
	}

	.swap-option.is-current {
		border-color: #555;
		background: #1a1a1a;
		cursor: default;
	}

	.current-badge {
		font-size: 0.65rem;
		color: #888;
		margin-left: 0.4rem;
		font-weight: normal;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	}

	.swap-slot {
		font-family: "SF Mono", monospace;
		font-weight: 500;
	}

	.swap-time {
		color: #888;
	}

	.swap-room {
		color: #666;
	}

	.swap-conflict {
		color: #777;
		font-style: italic;
	}

	/* Inputs */
	.input {
		width: 100%;
		padding: 0.55rem 0.7rem;
		background: #0a0a0a;
		border: 1px solid #222;
		border-radius: 6px;
		color: #fff;
		font-size: 0.85rem;
	}

	@media (max-width: 768px) {
		.input {
			font-size: 16px;
		}
	}
	.input:focus {
		outline: none;
		border-color: #333;
	}
	.input::placeholder {
		color: #444;
	}

	.input.error {
		border-color: #ff4444;
	}

	.input.valid {
		border-color: #44aa44;
		border-style: dashed;
		background: rgba(68, 170, 68, 0.05);
	}

	.error-msg {
		color: #ff4444;
		font-size: 0.8rem;
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
		text-align: left;
	}

	.btn {
		padding: 0.5rem 0.7rem;
		background: #111;
		border: 1px solid #222;
		border-radius: 5px;
		color: #fff;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.btn:hover {
		background: #1a1a1a;
		border-color: #333;
	}
	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.btn.primary {
		background: #fff;
		color: #000;
		border-color: #fff;
	}
	.btn.primary:hover {
		background: #ddd;
	}
	.btn.small {
		padding: 0.3rem 0.5rem;
		font-size: 0.7rem;
	}

	.btn.secondary {
		background: #1a1a1a;
		border: 1px solid #333;
		color: #eee;
		transition: all 0.2s;
	}
	.btn.secondary:hover {
		background: #252525;
		border-color: #555;
		transform: translateY(-1px);
	}

	.header-right-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.9rem;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.icon {
		display: flex;
		align-items: center;
		color: #999;
	}

	.icon svg {
		display: block;
	}

	.remove-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.03);
		color: #555;
		border: 1px solid transparent;
		border-radius: 50%;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 0;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		margin-left: 0;
		flex-shrink: 0;
	}

	.remove-btn:hover {
		background: #1a0a0a;
		color: #ff4444;
		border-color: #331111;
		transform: scale(1.1);
	}

	.hidden-courses {
		margin-top: 2.5rem;
		padding-top: 1.5rem;
		border-top: 1px dashed #222;
		opacity: 0.6;
		transition: opacity 0.2s;
	}

	.hidden-courses:hover {
		opacity: 1;
	}

	.hidden-courses h4 {
		margin: 0 0 1rem 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #444;
		font-weight: 600;
	}

	.hidden-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.75rem;
	}

	.hidden-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0.9rem;
		background: #050505;
		border: 1px solid #151515;
		border-radius: 6px;
		font-size: 0.8rem;
		color: #666;
		transition: border-color 0.2s;
	}

	.hidden-item:hover {
		border-color: #333;
	}

	.restore-btn {
		background: #111;
		border: 1px solid #222;
		color: #888;
		padding: 0.3rem 0.7rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.restore-btn:hover {
		background: #eee;
		color: #000;
		border-color: #fff;
	}

	.batch-input-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.batch-input-wrap {
		position: relative;
		flex: 1;
	}

	.add-batch-btn {
		background: none;
		border: 1px dashed #333;
		color: #888;
		padding: 0.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s;
	}
	.add-batch-btn:hover {
		background: #111;
		color: #fff;
		border-color: #555;
	}

	.remove-batch-btn {
		background: #111;
		border: 1px solid #222;
		color: #666;
		width: 38px; /* Match input height roughly */
		height: 38px;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		flex-shrink: 0;
	}
	.remove-batch-btn:hover {
		background: #222;
		color: #ff4444;
	}

	.tags-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		backdrop-filter: blur(4px);
		animation: fadeIn 0.2s ease-out;
	}

	.modal {
		background: #111;
		border: 1px solid #333;
		padding: 2rem;
		border-radius: 12px;
		max-width: 400px;
		width: 90%;
		text-align: center;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
		animation: scaleIn 0.2s ease-out;
	}

	.modal h2 {
		margin-top: 0;
		color: #fff;
		margin-bottom: 1rem;
	}

	.modal p {
		color: #ccc;
		margin-bottom: 1rem;
		line-height: 1.5;
	}

	.modal .instruction {
		background: #1a1a1a;
		padding: 1rem;
		border-radius: 8px;
		font-size: 0.9rem;
		border: 1px dashed #444;
		margin-bottom: 1.5rem;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes scaleIn {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	@media (max-width: 700px) {
		.header {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}
		.search-wrap {
			max-width: none;
		}
		.header-actions {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
			margin-left: 0;
		}
		.header-actions .action-btn {
			white-space: nowrap;
			font-size: 0.8rem;
			padding: 0.5rem 0.75rem;
		}
		.header-actions .action-btn .icon {
			display: none;
		}
		.header-actions .btn:not(.action-btn) {
			padding: 0.5rem 0.75rem;
			font-size: 0.8rem;
		}
		.calendar {
			min-width: 500px;
		}
		.keyboard-help-btn {
			display: none;
		}
	}
	/* Batch Tip */
	.batch-tip {
		background: rgba(255, 255, 255, 0.05);
		border-left: 2px solid #aaa;
		padding: 0.75rem 1rem;
		border-radius: 0 6px 6px 0;
		margin: 1rem 0;
		font-size: 0.85rem;
		line-height: 1.5;
		color: #ccc;
		text-align: left;
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.tip-icon {
		font-size: 1.1rem;
		line-height: 1.2;
		flex-shrink: 0;
	}

	.batch-tip strong {
		color: #fff;
		font-weight: 500;
	}

	/* Keyboard help button */
	.keyboard-help-btn {
		padding: 0.4rem 0.6rem;
		font-size: 1rem;
		line-height: 1;
	}

	.kbd-icon {
		opacity: 0.7;
	}

	/* Modal close button */
	.modal-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		background: none;
		border: none;
		color: #666;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		line-height: 1;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.modal-close:hover {
		color: #fff;
		background: #222;
	}

	/* Course Details Modal */
	.course-details-overlay {
		z-index: 1100;
	}

	.course-modal {
		max-width: 450px;
		text-align: left;
		position: relative;
	}

	.course-modal h2 {
		font-family: "SF Mono", monospace;
		font-size: 1.5rem;
		margin-bottom: 0.25rem;
	}

	.course-modal-name {
		color: #888;
		font-size: 1rem;
		margin-bottom: 1.5rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid #222;
	}

	.course-modal-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.course-modal-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.course-modal-item.full-width {
		grid-column: 1 / -1;
	}

	.modal-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #555;
		font-weight: 500;
	}

	.modal-value {
		font-size: 0.9rem;
		color: #eee;
	}

	/* Keyboard Shortcuts Modal */
	.keyboard-modal {
		max-width: 380px;
		text-align: left;
		position: relative;
	}

	.keyboard-modal h2 {
		margin-bottom: 1.5rem;
	}

	.shortcuts-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.shortcut-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
	}

	.shortcut-item span {
		color: #888;
	}

	kbd {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 4px;
		font-family: "SF Mono", monospace;
		font-size: 0.75rem;
		color: #fff;
		min-width: 1.5rem;
		text-align: center;
	}

	/* Course List Modals (UWE, CCC) */
	.course-list-modal {
		max-width: 500px;
		width: 90vw;
		text-align: left;
		position: relative;
	}

	.course-list-modal h2 {
		margin-bottom: 1rem;
	}

	.course-list-container {
		max-height: 60vh;
		overflow-y: auto;
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.course-list-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 0.75rem;
		background: #1a1a1a;
		border-radius: 6px;
		gap: 1rem;
	}

	.course-list-item.dimmed {
		opacity: 0.8;
	}

	.course-list-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
		cursor: pointer;
		padding: 0.25rem;
		margin: -0.25rem;
		border-radius: 4px;
		transition: background 0.15s;
	}

	.course-list-info:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.course-list-info:hover .info-hint,
	.list-item.clickable:hover .info-hint {
		opacity: 1;
	}

	.info-hint {
		font-size: 0.75rem;
		color: #888;
		opacity: 0.5;
		transition: opacity 0.15s;
		margin-left: 0.35rem;
	}

	.course-list-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.comp-badge {
		font-size: 0.7rem;
		padding: 0.15rem 0.4rem;
		background: #333;
		color: #aaa;
		border-radius: 3px;
		text-transform: uppercase;
	}

	.course-list-name {
		font-size: 0.85rem;
		color: #ccc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.conflict-info {
		font-size: 0.75rem;
		color: #f59e0b;
		margin-top: 0.25rem;
	}

	.course-list-actions {
		flex-shrink: 0;
		align-self: center;
	}

	.course-list-actions .badge {
		display: inline-block;
		padding: 0.3rem 0.6rem;
		font-size: 0.75rem;
		border-radius: 4px;
		background: #333;
		color: #aaa;
	}

	.course-list-actions .badge.warning {
		background: rgba(245, 158, 11, 0.2);
		color: #f59e0b;
	}
</style>
