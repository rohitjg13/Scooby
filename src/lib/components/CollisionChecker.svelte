<script lang="ts">
	import { onMount } from "svelte";
	import type { Course } from "$lib/types";
	import { DAYS, parseDays, timeToMinutes, minutesToTime } from "$lib/types";
	import {
		allCourses,
		currentBatches,
		selectedCourses,
		batchCourses,
		getConflicts,
		myElectives,
	} from "$lib/timetableStore";
	import { isMajorElective } from "$lib/types";
	import type { Group } from "$lib/coursePlanner";
	import {
		GROUP_LABEL,
		getBaseCourseCode,
		getComponentPrefix,
		getDepartment,
		groupSections,
		sectionConflicts,
		findCombo,
		assignLanes,
	} from "$lib/coursePlanner";
	import { toPng } from "html-to-image";
	import { createEvents } from "ics";
	import type { EventAttributes } from "ics";

	let loading = $state(true);
	let error = $state("");
	let batchInputs = $state([""]);
	// Lets people plan from scratch with no batch loaded at all
	let skipBatch = $state(false);
	let batchError = $state("");
	let showDownloadModal = $state(false);
	let selectedCourseDetails: Course | null = $state(null);
	let showKeyboardHelp = $state(false);
	let onlyFits = $state(false);
	// Off by default: only courses open to you. Turning it on lets you browse
	// and add anything in the sheet, flagged as not a UWE.
	let showNonUWE = $state(false);
	let showUWEList = $state(false);
	let showCCCList = $state(false);
	let showElectiveList = $state(false);
	let showColorSettings = $state(false);
	let maxCredits = $state(25);

	let totalCredits = $derived.by(() => {
		const effectiveBatch = getUniqueDisplayCourses($batchCourses)
			.filter((o) => !o.isExcluded)
			.map((o) => o.effective);
		const effectiveSelected = getUniqueDisplayCourses($selectedCourses).map(
			(o) => o.effective,
		);
		const all = [...effectiveBatch, ...effectiveSelected];

		const seen = new Set<string>();
		let sum = 0;

		for (const c of all) {
			const baseCode = c.courseCode.split("-")[0];
			// Only count CCC courses
			if (
				!seen.has(baseCode) &&
				baseCode.toUpperCase().startsWith("CCC")
			) {
				sum += c.credits || 0;
				seen.add(baseCode);
			}
		}
		return sum;
	});

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
		const isInput =
			target.tagName === "INPUT" || target.tagName === "TEXTAREA";

		// Escape closes modals/dropdowns
		if (e.key === "Escape") {
			if (plannerBase) {
				plannerBase = null;
				e.preventDefault();
				return;
			}
			if (showBrowse) {
				if (browseDept) browseDept = null;
				else showBrowse = false;
				e.preventDefault();
				return;
			}
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
			if (isInput) {
				(target as HTMLInputElement).blur();
				e.preventDefault();
				return;
			}
		}

		// Skip other shortcuts if typing
		if (isInput) return;

		// "/" or "s" opens the add modal on its search box
		if (e.key === "/" || e.key === "s") {
			e.preventDefault();
			showBrowse = true;
			browseDept = null;
			requestAnimationFrame(() => browseSearchRef?.focus());
			return;
		}

		// "?" shows keyboard help
		if (e.key === "?") {
			e.preventDefault();
			showKeyboardHelp = !showKeyboardHelp;
			return;
		}

		// "r" resets
		if (e.key === "r" && inApp) {
			e.preventDefault();
			reset();
			return;
		}

		// "p" downloads image
		if (e.key === "p" && inApp) {
			e.preventDefault();
			downloadImage();
			return;
		}

		// "c" exports calendar
		if (e.key === "c" && inApp) {
			e.preventDefault();
			exportCalendar();
			return;
		}
	}

	function openCourseDetails(course: Course) {
		selectedCourseDetails = course;
	}

	// Saved state is per-semester: bumping this sends everyone back to the
	// batch screen instead of restoring codes that no longer exist.
	const STORE_VERSION = "monsoon26r10";
	const key = (name: string) => `scooby_${STORE_VERSION}_${name}`;

	// Past the batch screen, either with a batch or on an empty slate
	let inApp = $derived($currentBatches.length > 0 || skipBatch);

	onMount(async () => {
		// Add keyboard listener
		window.addEventListener("keydown", handleKeydown);

		// Restore state from localStorage
		try {
			// Last semester's saved batches and courses no longer exist in
			// this sheet, so drop them rather than restoring a timetable of
			// codes that are gone.
			for (const stale of [
				"scooby_batch",
				"scooby_batches",
				"scooby_selected",
				"scooby_swapped",
				"scooby_excluded",
				// monsoon26: the pre-JSON timetable. Rooms, times and
				// faculty moved, so saved picks are wrong, not just stale.
				...[
					"monsoon26",
					"monsoon26r2",
					"monsoon26r3",
					"monsoon26r4",
					"monsoon26r5",
					"monsoon26r6",
					"monsoon26r7",
					"monsoon26r8",
					"monsoon26r9",
				].flatMap((v) =>
					["batches", "nobatch", "selected", "swapped", "excluded", "colors"].map(
						(n) => `scooby_${v}_${n}`,
					),
				),
			])
				localStorage.removeItem(stale);

			const savedBatches = localStorage.getItem(key("batches"));
			if (savedBatches) {
				currentBatches.set(JSON.parse(savedBatches));
			}

			skipBatch = localStorage.getItem(key("nobatch")) === "1";
			// No batch means nothing is "open to you", so start unfiltered
			if (skipBatch) showNonUWE = true;

			const savedSelected = localStorage.getItem(key("selected"));
			if (savedSelected) {
				selectedCourses.set(JSON.parse(savedSelected));
			}

			const savedSwapped = localStorage.getItem(key("swapped"));
			if (savedSwapped) {
				swappedCourseCodes = new Map(JSON.parse(savedSwapped));
			}

			const savedExcluded = localStorage.getItem(key("excluded"));
			if (savedExcluded) {
				excludedCourseCodes = new Set(JSON.parse(savedExcluded));
			}

			const savedColors = localStorage.getItem(key("colors"));
			if (savedColors) {
				courseColors = JSON.parse(savedColors);
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
				key("batches"),
				JSON.stringify($currentBatches),
			);
			localStorage.setItem(key("nobatch"), skipBatch ? "1" : "0");
		}
	});

	$effect(() => {
		if (stateLoaded) {
			localStorage.setItem(
				key("selected"),
				JSON.stringify($selectedCourses),
			);
		}
	});

	$effect(() => {
		if (stateLoaded) {
			localStorage.setItem(
				key("swapped"),
				JSON.stringify(Array.from(swappedCourseCodes.entries())),
			);
		}
	});

	$effect(() => {
		if (stateLoaded) {
			localStorage.setItem(
				key("excluded"),
				JSON.stringify(Array.from(excludedCourseCodes)),
			);
		}
	});

	$effect(() => {
		if (stateLoaded) {
			localStorage.setItem(key("colors"), JSON.stringify(courseColors));
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

	// A finished code can still be the start of others — ECE21 keeps matching
	// ECE210 — so the list stays open until it is dismissed. Only a code that
	// is already a batch can be dismissed; a half-typed one still needs help.
	let dismissedSuggestions = $state<number[]>([]);

	function dismissSuggestions(index: number) {
		const typed = (batchInputs[index] ?? "").trim().toUpperCase();
		if (!getAllBatches().includes(typed)) return false;
		if (!dismissedSuggestions.includes(index))
			dismissedSuggestions = [...dismissedSuggestions, index];
		return true;
	}

	// Typing again means they are still looking for something
	function reopenSuggestions(index: number) {
		dismissedSuggestions = dismissedSuggestions.filter((i) => i !== index);
	}

	// A tap anywhere off the inputs puts the list away
	function handleBatchClick(e: MouseEvent) {
		if (inApp) return;
		const target = e.target as HTMLElement | null;
		if (target?.id?.startsWith("batch-input-")) return;
		batchInputs.forEach((_, i) => dismissSuggestions(i));
	}

	function selectBatch(batch: string, index: number) {
		batchInputs[index] = batch;
		batchError = "";
		dismissSuggestions(index);

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
		// indices shifted, so the dismissals no longer point anywhere useful
		dismissedSuggestions = [];
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
			// With a batch loaded, the UWE/CCC filter is the sane default again
			skipBatch = false;
			showNonUWE = false;
			batchError = "";
		} else {
			batchError =
				"One or more batches are invalid. Please select from suggestions.";
		}
	}

	// Removes every row of the section (a section can meet on several rows)
	function removeCourse(course: Course) {
		selectedCourses.update((courses) =>
			courses.filter((c) => c.courseCode !== course.courseCode),
		);
		// Otherwise a re-added course would silently come back swapped
		resetSwap(course.courseCode);
	}

	// Swapped-to sections are still "added" — compare against the effective list
	function isSelected(course: Course): boolean {
		return getEffectiveCoursesList($selectedCourses).some(
			(c) => c.courseCode === course.courseCode,
		);
	}

	// function isSelected(course: Course): boolean {
	// 	return $selectedCourses.some((c) => c.courseCode === course.courseCode);
	// }

	function isBatchCourse(course: Course): boolean {
		return $batchCourses.some((c) => c.courseCode === course.courseCode);
	}

	function reset() {
		currentBatches.set([]);
		skipBatch = false;
		showNonUWE = false;
		selectedCourses.set([]);
		batchInputs = [""];
		browseSearch = "";
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

	// A section meets on one day per row in this sheet — 382 of 727 sections
	// span several. Collapse them back into "Mon, Wed 01:00 PM-02:55 PM",
	// keeping differing times apart.
	function meetingTimes(courseCode: string): string[] {
		const byTime = new Map<string, string[]>();

		for (const row of $allCourses) {
			if (row.courseCode !== courseCode || !row.day) continue;
			const time = `${row.startTime}-${row.endTime}`;
			if (!byTime.has(time)) byTime.set(time, []);
			const days = byTime.get(time)!;
			for (const day of parseDays(row.day))
				if (!days.includes(day)) days.push(day);
		}

		return [...byTime].map(([time, days]) => {
			const label = days
				.sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b))
				.map((d) => d.slice(0, 3))
				.join(", ");
			return `${label} ${time}`;
		});
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

	/* ---- Whole-course planner ----
	   A course = one section from each component group (one LEC, one TUT,
	   one PRAC). "Fits" means some combination of those has no clash. */

	function getCourseGroups(baseCode: string): Group[] {
		const rows = $allCourses.filter(
			(c) => getBaseCourseCode(c.courseCode) === baseCode,
		);
		// A course can mix sections: OHM2001 has one lecture open as UWE and
		// three that aren't. Offer only the ones you could actually take,
		// plus whatever you already have.
		if (showNonUWE) return groupSections(rows);
		return groupSections(
			rows.filter((c) => canAdd(c) || inTimetable(c.courseCode)),
		);
	}

	// Everything on the timetable except the course being planned
	function timetableExcluding(baseCode: string): Course[] {
		return [
			...getEffectiveCoursesList($batchCourses),
			...getEffectiveCoursesList($selectedCourses),
		].filter((c) => getBaseCourseCode(c.courseCode) !== baseCode);
	}

	function inTimetable(sectionCode: string): boolean {
		return [
			...getEffectiveCoursesList($batchCourses),
			...getEffectiveCoursesList($selectedCourses),
		].some((c) => c.courseCode === sectionCode);
	}

	// Sections of this course the user already has — those are fixed
	function lockedSections(groups: Group[]): Record<string, string> {
		const locked: Record<string, string> = {};
		for (const g of groups) {
			const added = g.sections.find((s) => inTimetable(s.code));
			if (added) locked[g.prefix] = added.code;
		}
		return locked;
	}

	let plannerBase = $state<string | null>(null);
	let plannerPicks = $state<Record<string, string>>({});
	let plannerGroups = $derived(
		plannerBase ? getCourseGroups(plannerBase) : [],
	);

	function openPlanner(course: Course) {
		if (!showNonUWE && !hasOpenSection(getBaseCourseCode(course.courseCode)))
			return;
		const base = getBaseCourseCode(course.courseCode);
		const groups = getCourseGroups(base);
		const existing = timetableExcluding(base);
		const locked = lockedSections(groups);
		const clickedPrefix = getComponentPrefix(course) || "OTHER";

		// Prefer a combination that keeps the section the user clicked
		const combo =
			findCombo(groups, existing, {
				...locked,
				[clickedPrefix]: course.courseCode,
			}) ?? findCombo(groups, existing, locked);

		const picks = { ...locked, ...(combo ?? {}) };
		if (!combo) {
			for (const g of groups) {
				if (picks[g.prefix]) continue;
				picks[g.prefix] =
					g.prefix === clickedPrefix
						? course.courseCode
						: g.sections[0].code;
			}
		}

		plannerPicks = picks;
		plannerBase = base;
	}

	// Rows of the picked sections of every *other* group
	function pickedRowsExcept(prefix: string): Course[] {
		return plannerGroups
			.filter((g) => g.prefix !== prefix)
			.flatMap(
				(g) =>
					g.sections.find((s) => s.code === plannerPicks[g.prefix])
						?.rows ?? [],
			);
	}

	function addPlannedCourse() {
		const rows = plannerGroups.flatMap((g) => {
			const s = g.sections.find((x) => x.code === plannerPicks[g.prefix]);
			return s && !inTimetable(s.code) ? s.rows : [];
		});

		selectedCourses.update((cur) => [
			...cur,
			...rows.filter((r) => !cur.some((c) => c.sno === r.sno)),
		]);
		plannerBase = null;
		browseSearch = "";
	}

	/* ---- Browse by department ---- */

	let showBrowse = $state(false);
	let browseDept = $state<string | null>(null);
	let browseFilter = $state("");

	// dept -> base course codes, both sorted
	let departments = $derived.by(() => {
		const map = new Map<string, string[]>();
		const seen = new Set<string>();
		for (const c of $allCourses) {
			const base = getBaseCourseCode(c.courseCode);
			if (seen.has(base)) continue;
			seen.add(base);
			const dept = getDepartment(c.courseCode) || "OTHER";
			if (!map.has(dept)) map.set(dept, []);
			map.get(dept)!.push(base);
		}
		return new Map(
			[...map]
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([dept, codes]) => [dept, codes.sort()] as const),
		);
	});

	// Which cohorts a course already runs for. Taking it as a UWE means
	// sitting in with these batches, so it's worth seeing before you add it.
	function batchesFor(base: string): string[] {
		const out = new Set<string>();
		for (const row of $allCourses) {
			if (getBaseCourseCode(row.courseCode) !== base || !row.major)
				continue;
			for (const code of row.major.split(/[\s,]+/))
				if (code.trim()) out.add(code.trim());
		}
		const isProgramme = (c: string) => /\dYR$/.test(c);
		return [...out].sort((a, b) => {
			if (isProgramme(a) !== isProgramme(b)) return isProgramme(a) ? -1 : 1;
			return a.localeCompare(b);
		});
	}

	// What's actually blocking a course that won't fit. A group whose every
	// section is taken out counts as a blocker; the courses doing that are
	// what you'd have to drop. Cross-group clashes (each part free on its
	// own, no combination free together) leave this empty by design.
	function clashesWith(base: string): string[] {
		const groups = getCourseGroups(base);
		const existing = timetableExcluding(base);
		const locked = lockedSections(groups);
		const out = new Set<string>();

		for (const group of groups) {
			const options = locked[group.prefix]
				? group.sections.filter((s) => s.code === locked[group.prefix])
				: group.sections;
			const perSection = options.map((s) =>
				sectionConflicts(s.rows, existing),
			);
			if (!perSection.length || !perSection.every((c) => c.length))
				continue;
			for (const list of perSection)
				for (const c of list)
					out.add(getBaseCourseCode(c.courseCode));
		}
		return [...out].sort();
	}

	// Is the whole course already in, or still placeable without a clash?
	function courseStatus(base: string) {
		const groups = getCourseGroups(base);
		const added = groups.some((g) =>
			g.sections.some((s) => inTimetable(s.code)),
		);
		return {
			groups,
			added,
			fits: !!findCombo(
				groups,
				timetableExcluding(base),
				lockedSections(groups),
			),
		};
	}

	// A course is worth showing if any of its sections is open to you. Only
	// one course in the sheet mixes Open as UWE across its rows, but hiding a
	// course that has an open section would be the worse mistake.
	function courseOpen(base: string): boolean {
		return showNonUWE || hasOpenSection(base);
	}

	// Any section of this course you could take — a course is "not a UWE"
	// only when none of its sections is open to you.
	function hasOpenSection(base: string): boolean {
		return $allCourses.some(
			(c) => getBaseCourseCode(c.courseCode) === base && canAdd(c),
		);
	}

	// Per-department count shown on the picker. Matches what the list shows:
	// courses closed to you are left out, as is anything that doesn't fit
	// while "Fits my week" is on. $derived is lazy, so this only runs while
	// the browse modal is open.
	let deptCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const [dept, codes] of departments) {
			counts.set(
				dept,
				codes.filter((base) => {
					if (!courseOpen(base)) return false;
					if (!onlyFits) return true;
					const { added, fits } = courseStatus(base);
					return fits || added;
				}).length,
			);
		}
		return counts;
	});

	// Search across every department, from the department-picker screen.
	// Replaces the old header search box.
	let browseSearch = $state("");

	let searchResults = $derived.by(() => {
		const query = browseSearch.toLowerCase().trim();
		if (query.length < 2) return [];

		const out: {
			base: string;
			sample: Course;
			groups: Group[];
			added: boolean;
			fits: boolean;
		}[] = [];

		for (const codes of departments.values()) {
			for (const base of codes) {
				const sample = $allCourses.find(
					(c) => getBaseCourseCode(c.courseCode) === base,
				);
				if (!sample) continue;
				if (
					!base.toLowerCase().includes(query) &&
					!sample.courseName.toLowerCase().includes(query) &&
					!sample.faculty.toLowerCase().includes(query)
				)
					continue;
				if (!courseOpen(base)) continue;

				const status = courseStatus(base);
				if (onlyFits && !status.fits && !status.added) continue;
				out.push({ base, sample, ...status });
				if (out.length >= 40) return out;
			}
		}
		return out;
	});

	// Courses of the open department, with whether the whole course still fits
	let browseCourses = $derived.by(() => {
		if (!browseDept) return [];
		const query = browseFilter.toLowerCase().trim();

		return (departments.get(browseDept) ?? []).flatMap((base) => {
			const sample = $allCourses.find(
				(c) => getBaseCourseCode(c.courseCode) === base,
			);
			if (!sample) return [];
			if (!courseOpen(base)) return [];
			if (
				query &&
				!base.toLowerCase().includes(query) &&
				!sample.courseName.toLowerCase().includes(query) &&
				!sample.faculty.toLowerCase().includes(query)
			)
				return [];

			const { groups, added, fits } = courseStatus(base);
			if (onlyFits && !fits && !added) return [];
			return [{ base, sample, groups, added, fits }];
		});
	});

	let browseFilterRef: HTMLInputElement | null = $state(null);
	let browseSearchRef: HTMLInputElement | null = $state(null);

	function openBrowseDept(dept: string) {
		browseDept = dept;
		browseFilter = "";
		requestAnimationFrame(() => browseFilterRef?.focus());
	}

	/* ---- Colour coding ----
	   Hues from a palette validated for colour-blind separation against this
	   background. CCC and UWE hold two reserved slots; departments share the
	   other six, assigned by the department's position in the full sorted
	   list — stable, so a course never changes colour as you add or remove
	   things. With ~40 departments the six repeat; two departments on one
	   screen can land on the same hue, which is why the course code is always
	   shown next to the colour. */
	let deptOrder = $derived(
		new Map([...departments.keys()].map((d, i) => [d, i])),
	);

	// Every department gets its own hue, so nothing repeats. Consecutive
	// departments are spun by the golden angle rather than stepped, which
	// keeps neighbours in the alphabetical grid far apart on the wheel.
	// Low chroma, high lightness — a tint, not a highlighter. Fixed L/C in
	// OKLCH so no hue reads brighter or heavier than another.
	function deptColor(dept: string): string {
		const hue = ((deptOrder.get(dept) ?? 0) * 137.508) % 360;
		return `oklch(0.82 0.085 ${hue.toFixed(1)})`;
	}

	// Per-course colour overrides, keyed by base code and kept in this
	// browser only — your palette, nobody else's.
	let courseColors = $state<Record<string, string>>({});

	function setCourseColor(base: string, color: string) {
		courseColors = { ...courseColors, [base]: color };
	}

	function clearCourseColor(base: string) {
		const { [base]: _, ...rest } = courseColors;
		courseColors = rest;
	}

	// Every course on your timetable, one row per course, for the colour panel
	let myTimetableCourses = $derived.by(() => {
		const out = new Map<string, Course>();
		for (const course of [
			...getEffectiveCoursesList($batchCourses),
			...getEffectiveCoursesList($selectedCourses),
		]) {
			const base = getBaseCourseCode(course.courseCode);
			if (!out.has(base)) out.set(base, course);
		}
		return [...out].sort((a, b) => a[0].localeCompare(b[0]));
	});

	// Colour follows the course's department, so the same course is the same
	// colour everywhere — timetable, search, browse, department card.
	function courseAccent(course: Course): string {
		const base = getBaseCourseCode(course.courseCode);
		return courseColors[base] ?? deptColor(getDepartment(course.courseCode));
	}

	// Only the departments actually on screen, so the legend stays short
	let calendarLegend = $derived.by(() => {
		const out = new Map<string, string>();
		for (const block of buildCalendar().blocks) {
			// A recoloured course no longer represents its department, so it
			// gets its own entry rather than mislabelling the department's.
			const base = getBaseCourseCode(block.course.courseCode);
			const label = courseColors[base]
				? base
				: getDepartment(block.course.courseCode);
			if (label) out.set(label, courseAccent(block.course));
		}
		return [...out].sort((a, b) => a[0].localeCompare(b[0]));
	});

	// Can this course go on your timetable at all? Your own batch's courses
	// always can; anything the sheet opens as UWE can; a major elective can
	// only be taken by the programme it is offered to. Everything else is
	// closed to you no matter how it looks in search.
	function canAdd(course: Course): boolean {
		if (isBatchCourse(course)) return true;
		if (course.openAsUWE) return true;
		// Common core is open to everyone by definition — the sheet marks no
		// CCC row as Open as UWE, so without this every student loses all 32.
		if (getBaseCourseCode(course.courseCode).toUpperCase().startsWith("CCC"))
			return true;
		return (
			isMajorElective(course) && myElectiveCodes.has(course.courseCode)
		);
	}

	let myElectiveCodes = $derived(
		new Set($myElectives.map((c) => c.courseCode)),
	);

	// What a Major Elective counts as *for this user*: their own programme's
	// elective, a UWE if it's open as one, otherwise not available to them.
	function electiveTag(course: Course): string | null {
		if (!isMajorElective(course)) return null;
		if (myElectiveCodes.has(course.courseCode)) return "Major Elective";
		return course.openAsUWE ? "UWE" : "Not open to you";
	}

	// Search box for the UWE and CCC lists (only one is ever open)
	let listSearch = $state("");

	function matchesQuery(base: string, sample: Course, query: string): boolean {
		if (!query) return true;
		return (
			base.toLowerCase().includes(query) ||
			sample.courseName.toLowerCase().includes(query) ||
			sample.faculty.toLowerCase().includes(query)
		);
	}

	// One card per course, not per row — the sheet has a row per day, so a
	// course with Mon+Wed lectures would otherwise show up twice.
	function courseCards(rows: Course[]) {
		const bases = [
			...new Set(rows.map((c) => getBaseCourseCode(c.courseCode))),
		].sort();
		return bases.map((base) => ({
			base,
			sample: $allCourses.find(
				(c) => getBaseCourseCode(c.courseCode) === base,
			)!,
			...courseStatus(base),
		}));
	}

	// One card per elective course, not per section
	let myElectiveCourses = $derived.by(() => {
		const bases = [
			...new Set($myElectives.map((c) => getBaseCourseCode(c.courseCode))),
		].sort();
		return bases.map((base) => ({
			base,
			sample: $allCourses.find(
				(c) => getBaseCourseCode(c.courseCode) === base,
			)!,
			...courseStatus(base),
		}));
	});

	let electiveSearch = $state("");

	let visibleElectives = $derived.by(() => {
		const query = electiveSearch.toLowerCase().trim();
		return myElectiveCourses.filter((c) => {
			if (onlyFits && !c.fits && !c.added) return false;
			if (!query) return true;
			return (
				c.base.toLowerCase().includes(query) ||
				c.sample.courseName.toLowerCase().includes(query) ||
				c.sample.faculty.toLowerCase().includes(query)
			);
		});
	});

	// One entry per added section (a section can span several rows), with any
	// swap applied — same shape the batch list uses
	let uniqueSelected = $derived(getUniqueDisplayCourses($selectedCourses));

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
		col: number; // which lane it sits in when classes overlap
		cols: number; // how many lanes that cluster needs
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
					col: 0,
					cols: 1,
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
		const weekdays = [
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
		];
		const days = usedDays.has("Saturday")
			? [...weekdays, "Saturday"]
			: weekdays;

		for (const day of days)
			assignLanes(blocks.filter((b) => b.day === day));

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


<svelte:window onclick={handleBatchClick} />

{#snippet courseCard(item: {
	base: string;
	sample: Course;
	groups: Group[];
	added: boolean;
	fits: boolean;
})}
	{@const { base, sample, groups, added, fits } = item}
	{@const batches = batchesFor(base)}
	<div
		class="course-list-item"
		style="--accent: {courseAccent(sample)}"
		class:dimmed={!fits}
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="course-list-info"
			onclick={() => openCourseDetails(sample)}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === "Enter" && openCourseDetails(sample)}
			title="Click for details"
		>
			<div class="course-list-header">
				<span class="mono">{base}</span>
				{#if electiveTag(sample)}
					<span
						class="elective-badge"
						class:mine={myElectiveCodes.has(sample.courseCode)}
						>{electiveTag(sample)}</span
					>
				{:else if sample.openAsUWE}
					<span class="comp-badge">UWE</span>
				{/if}
				{#if !hasOpenSection(base)}
					<span class="not-uwe-badge">⚠ Not a UWE</span>
				{/if}
				{#if sample.credits}
					<span class="cr-badge">{sample.credits} Cr</span>
				{/if}
				<span class="info-hint">ⓘ</span>
			</div>
			<span class="course-list-name">{sample.courseName}</span>
			<span class="muted small">
				{groups
					.map((g) => `${GROUP_LABEL[g.prefix]} ×${g.sections.length}`)
					.join(" • ")}
			</span>
			{#if batches.length}
				<span class="muted small batch-line">
					Runs for {batches.slice(0, 6).join(", ")}{batches.length > 6
						? ` +${batches.length - 6} more`
						: ""}
				</span>
			{/if}
			<span class="fit-note" class:bad={!fits && !added}>
				{#if added}
					✓ In your timetable
				{:else if fits}
					✓ Fits your timetable
				{:else}
					{@const blockers = clashesWith(base)}
					{#if blockers.length}
						✕ Clashes with {blockers.join(", ")}
					{:else}
						✕ Clashes — no free combination
					{/if}
				{/if}
			</span>
		</div>
		<div class="course-list-actions">
			{#if added || showNonUWE || hasOpenSection(base)}
				<button class="btn small" onclick={() => openPlanner(sample)}
					>{added ? "Sections" : "Add"}</button
				>
			{:else}
				<button
					class="btn small"
					disabled
					title="Not open as UWE, and not a major elective of your department"
					>Closed</button
				>
			{/if}
		</div>
	</div>
{/snippet}

<!-- Filter pills for the browse modal, shown under whichever search box is up -->
{#snippet filterChips()}
	<div class="filter-chips">
		<label class="chip">
			<input type="checkbox" bind:checked={showNonUWE} />
			<span>Show non-UWE courses</span>
		</label>
		<label class="chip">
			<input type="checkbox" bind:checked={onlyFits} />
			<span>Fits my week</span>
		</label>
	</div>
{/snippet}

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
	{:else if !inApp}
		<div class="center">
			<div class="batch-form">
				<h1>Scooby</h1>
				<p class="muted">Enter your batch code(s)</p>
				<div class="batch-tip">
					<span class="tip-icon">💡</span>
					<span
						>Add <strong>all</strong> your batches — your programme
						and your block. e.g. ECE 2nd years have both
						<strong>ECE2YR</strong> and an
						<strong>ECE2X</strong> block (ECE21, ECE22 …).</span
					>
				</div>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleBatchSubmit();
					}}
				>
					{#each batchInputs as input, i}
						{@const suggestions = dismissedSuggestions.includes(i)
							? []
							: getSuggestionsFor(input)}
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
									placeholder="e.g. ECE2YR, ECE21"
									bind:value={batchInputs[i]}
									oninput={() => {
										batchError = "";
										reopenSuggestions(i);
									}}
									onkeydown={(e) => {
										// Enter puts the list away first, so a
										// valid code isn't buried under it
										if (
											e.key === "Enter" &&
											suggestions.length > 0 &&
											dismissSuggestions(i)
										)
											e.preventDefault();
									}}
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
				<button
					type="button"
					class="skip-batch"
					title="Starts you on an empty timetable — no batch courses"
					onclick={() => ((skipBatch = true), (showNonUWE = true))}
					>Continue without a batch →</button
				>
				<div class="batch-form-footer">
					<a href="/" class="btn secondary">← Home</a>
				</div>
			</div>
		</div>
	{:else}
		<div class="app">
			<!-- Header -->
			<header class="header">
				<div class="header-left">
					<a href="/" class="home-link" title="Back to Scooby home"
						><h1>Scooby</h1></a
					>
					<div class="tags-row">
						{#each $currentBatches as batch}
							<span class="tag">{batch}</span>
						{:else}
							<button
								class="tag tag-button"
								onclick={reset}
								title="Pick a batch">No batch — set one</button
							>
						{/each}
					</div>
				</div>

				<div class="add-actions">
					<button
						class="btn primary add-btn"
						onclick={() => (showBrowse = true)}
						title="Search and add UWE or CCC courses"
					>
						+ Add UWE/CCC
					</button>
					{#if myElectiveCourses.length > 0}
						<button
							class="btn primary add-btn"
							onclick={() => (showElectiveList = true)}
							title="Major electives offered to your programme"
							>+ Major Electives ({myElectiveCourses.length})</button
						>
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
					<button
						class="btn secondary"
						onclick={() => ((listSearch = ""), (showUWEList = true))}
						title="View all UWE courses">UWE List</button
					>
					<button
						class="btn secondary"
						onclick={() => ((listSearch = ""), (showCCCList = true))}
						title="View all CCC courses">CCC List</button
					>
					<button class="btn" onclick={reset}>Reset</button>
					<button
						class="btn keyboard-help-btn"
						onclick={() => (showKeyboardHelp = true)}
						title="Keyboard shortcuts (?)"
					>
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
												style="top: {top}%; height: {height}%; min-height: 45px; left: calc({(100 /
													block.cols) *
													block.col}% + 2px); width: calc({100 / block.cols}% - 4px); --accent: {courseAccent(
													block.course,
												)}"
													onclick={() =>
														openCourseDetails(
															block.course,
														)}
													role="button"
													tabindex="0"
													onkeydown={(e) =>
														e.key === "Enter" &&
														openCourseDetails(
															block.course,
														)}
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
														<span
															class="block-type"
														>
															{block.course
																.courseType}
															{block.course
																.courseType &&
															block.course
																.component
																? " • "
																: ""}
															{block.course
																.component}
															{(block.course
																.courseType ||
																block.course
																	.component) &&
															block.course.room
																? " • "
																: ""}
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

					<div class="legend">
						<button
							class="legend-edit"
							onclick={() => (showColorSettings = true)}
							title="Change course colours">Colours ✎</button
						>
						{#each calendarLegend as [label, color]}
							<span class="legend-item">
								<span
									class="legend-swatch"
									style="background: {color}"
								></span>{label}
							</span>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Course Lists -->
			<section class="lists">
				<div class="list-box">
					<h3>
						Your Courses <span class="muted"
							>({getEffectiveCoursesList($batchCourses)
								.length})</span
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
									onkeydown={(e) =>
										e.key === "Enter" &&
										openCourseDetails(course)}
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
										{#each meetingTimes(course.courseCode) as meeting}
											<span class="muted small">
												{meeting} • {course.room}
											</span>
										{/each}
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
							{$currentBatches.length
								? `No courses for ${$currentBatches.join(", ")}`
								: "No batch loaded — add courses from Browse."}
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

				{#if uniqueSelected.length > 0}
					<div class="list-box">
						<h3>
							Added <span class="muted"
								>({uniqueSelected.length})</span
							>
						</h3>
					<div class="courses-grid">
						{#each uniqueSelected as { original: originalCourse, effective: course, isSwapped }}
							{@const alternatives =
								getAlternativeComponents(originalCourse)}
							<div
								class="list-item added clickable"
								class:swapped={isSwapped}
								onclick={() => openCourseDetails(course)}
								role="button"
								tabindex="0"
								onkeydown={(e) =>
									e.key === "Enter" && openCourseDetails(course)}
								title="Click for details"
							>
								<div class="course-main-info">
									<div class="course-header-row">
										<span class="mono"
											>{course.courseCode.split(
												"-",
											)[0]}{#if getComponentType(course.component)}
												<span class="comp-label"
													>({getComponentType(
														course.component,
													)})</span
												>{/if}
											<span class="info-hint">ⓘ</span></span
										>
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
													>{getSection(course)}</span
												>
											{/if}
											<button
												class="remove-btn"
												title="Remove this course"
												onclick={(e) => {
													e.stopPropagation();
													removeCourse(originalCourse);
												}}>×</button
											>
										</div>
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
									{#each meetingTimes(course.courseCode) as meeting}
										<span class="muted small">{meeting}</span>
									{/each}
								</div>

								{#if showingSwapFor === originalCourse.courseCode && alternatives.length > 0}
									<div class="swap-dropdown">
										<div class="swap-header">
											Change {getComponentType(
												course.component,
											) || "Section"}:
										</div>
										{#each alternatives as alt}
											{@const conflicts = getConflicts(
												alt,
												getEffectiveCoursesList(
													$batchCourses,
												),
												getEffectiveCoursesList(
													$selectedCourses.filter(
														(c) =>
															c.courseCode !==
															originalCourse.courseCode,
													),
												),
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
												disabled={conflicts.length > 0}
											>
												<span class="swap-slot">
													{getSection(alt)}
													{#if alt.courseCode === course.courseCode}
														<span class="current-badge"
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
													<span class="swap-conflict">
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
						{/each}
						</div>
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
		{@const detailBase = getBaseCourseCode(selectedCourseDetails.courseCode)}
		{@const detailBatches = batchesFor(detailBase)}
		<div
			class="modal-overlay course-details-overlay"
			onclick={() => (selectedCourseDetails = null)}
			role="button"
			tabindex="-1"
			onkeydown={(e) =>
				e.key === "Escape" && (selectedCourseDetails = null)}
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal course-modal"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
				onkeydown={(e) =>
					e.key === "Escape" && (selectedCourseDetails = null)}
			>
				<button
					class="modal-close"
					onclick={() => (selectedCourseDetails = null)}>×</button
				>
				<h2>{selectedCourseDetails.courseCode.split("-")[0]}</h2>
				<p class="course-modal-name">
					{selectedCourseDetails.courseName}
				</p>

				<div class="course-modal-grid">
					<div class="course-modal-item wide">
						<span class="modal-label">Sections</span>
						<div class="section-rows">
							{#each getCourseGroups(detailBase) as group}
								{#each group.sections as section}
									{@const row = section.rows[0]}
									<div
										class="section-row"
										class:mine={inTimetable(section.code)}
									>
										<span class="section-row-head">
											<span class="mono"
												>{section.code.split("-")[1] ??
													section.code}</span
											>
											<span class="muted small"
												>{GROUP_LABEL[group.prefix]}</span
											>
											{#if inTimetable(section.code)}
												<span class="badge ok">Yours</span>
											{/if}
											{#if !section.rows.some(canAdd)}
												<span class="not-uwe-badge"
													>⚠ Not a UWE</span
												>
											{/if}
										</span>
										<span class="modal-value"
											>{meetingTimes(section.code).join(
												" / ",
											) || "No timing listed"}</span
										>
										<span class="muted small">
											{[row.faculty, row.room]
												.filter(Boolean)
												.join(" • ")}
										</span>
									</div>
								{/each}
							{:else}
								<span class="muted small"
									>No sections open to you.</span
								>
							{/each}
						</div>
					</div>
					{#if selectedCourseDetails.credits && selectedCourseDetails.courseCode
							.toUpperCase()
							.startsWith("CCC")}
						<div class="course-modal-item">
							<span class="modal-label">Credits</span>
							<span class="modal-value"
								>{selectedCourseDetails.credits}</span
							>
						</div>
					{/if}
					{#if selectedCourseDetails.courseType}
						<div class="course-modal-item">
							<span class="modal-label">Type</span>
							<span class="modal-value"
								>{selectedCourseDetails.courseType}</span
							>
						</div>
					{/if}
					{#if selectedCourseDetails.term}
						<div class="course-modal-item">
							<span class="modal-label">Term</span>
							<span class="modal-value"
								>{selectedCourseDetails.term}</span
							>
						</div>
					{/if}
					<div class="course-modal-item">
						<span class="modal-label">Open as UWE</span>
						<span class="modal-value"
							>{hasOpenSection(detailBase)
								? "Yes"
								: "No"}</span
						>
					</div>
					{#if detailBatches.length}
						<div class="course-modal-item wide">
							<span class="modal-label">Runs for</span>
							<span class="modal-value mono-sm"
								>{detailBatches.join(", ")}</span
							>
						</div>
					{/if}
					<div class="course-modal-item wide">
						<span class="modal-label">Colour</span>
						<div class="colour-row">
							<label
								class="colour-swatch"
								style="background: {courseAccent(
									selectedCourseDetails,
								)}"
								title="Pick a colour for this course"
							>
								<input
									type="color"
									aria-label="Pick a colour for this course"
									value={courseColors[detailBase] ?? "#8a8a8a"}
									oninput={(e) =>
										setCourseColor(
											detailBase,
											e.currentTarget.value,
										)}
								/>
							</label>
							{#if courseColors[detailBase]}
								<button
									class="btn small"
									onclick={() => clearCourseColor(detailBase)}
									>Reset</button
								>
							{:else}
								<span class="muted small"
									>Default for {getDepartment(
										selectedCourseDetails.courseCode,
									)}</span
								>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Keyboard Shortcuts Help Modal -->
	{#if showKeyboardHelp}
		<div
			class="modal-overlay"
			onclick={() => (showKeyboardHelp = false)}
			role="button"
			tabindex="-1"
			onkeydown={(e) => e.key === "Escape" && (showKeyboardHelp = false)}
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal keyboard-modal"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
				onkeydown={(e) =>
					e.key === "Escape" && (showKeyboardHelp = false)}
			>
				<button
					class="modal-close"
					onclick={() => (showKeyboardHelp = false)}>×</button
				>
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

				<button
					class="btn primary"
					onclick={() => (showKeyboardHelp = false)}>Got it</button
				>
			</div>
		</div>
	{/if}

	<!-- UWE Courses List Modal -->
	{#if showUWEList}
		{@const uweCourses = courseCards(
			$allCourses.filter((c) => c.openAsUWE),
		).filter((c) =>
			matchesQuery(c.base, c.sample, listSearch.toLowerCase().trim()),
		)}
		<div
			class="modal-overlay"
			onclick={() => (showUWEList = false)}
			role="button"
			tabindex="-1"
			onkeydown={(e) => e.key === "Escape" && (showUWEList = false)}
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal course-list-modal"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
				onkeydown={(e) => e.key === "Escape" && (showUWEList = false)}
			>
				<button
					class="modal-close"
					onclick={() => (showUWEList = false)}>×</button
				>
				<h2>Open as UWE Courses ({uweCourses.length})</h2>

				<input
					type="text"
					class="input dept-filter"
					placeholder="Search UWE courses by code, name or faculty…"
					bind:value={listSearch}
					autocomplete="off"
				/>

				<div class="course-list-container">
					{#each uweCourses as item}
						{@render courseCard(item)}
					{:else}
						<p class="muted">No UWE courses found.</p>
					{/each}
				</div>

				<button
					class="btn primary"
					onclick={() => (showUWEList = false)}>Close</button
				>
			</div>
		</div>
	{/if}

	<!-- CCC Courses List Modal -->
	{#if showCCCList}
		{@const cccCourses = courseCards(
			$allCourses.filter((c) =>
				c.courseCode.toUpperCase().startsWith("CCC"),
			),
		).filter((c) =>
			matchesQuery(c.base, c.sample, listSearch.toLowerCase().trim()),
		)}
		<div
			class="modal-overlay"
			onclick={() => (showCCCList = false)}
			role="button"
			tabindex="-1"
			onkeydown={(e) => e.key === "Escape" && (showCCCList = false)}
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal course-list-modal"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
				onkeydown={(e) => e.key === "Escape" && (showCCCList = false)}
			>
				<button
					class="modal-close"
					onclick={() => (showCCCList = false)}>×</button
				>
				<h2>CCC Courses ({cccCourses.length})</h2>

				<input
					type="text"
					class="input dept-filter"
					placeholder="Search CCC courses by code, name or faculty…"
					bind:value={listSearch}
					autocomplete="off"
				/>

				<div class="course-list-container">
					{#each cccCourses as item}
						{@render courseCard(item)}
					{:else}
						<p class="muted">No CCC courses found.</p>
					{/each}
				</div>

				<button
					class="btn primary"
					onclick={() => (showCCCList = false)}>Close</button
				>
			</div>
		</div>
	{/if}

	<!-- Course colours, kept in this browser only -->
	{#if showColorSettings}
		<div
			class="modal-overlay"
			onclick={() => (showColorSettings = false)}
			role="button"
			tabindex="-1"
			onkeydown={(e) => e.key === "Escape" && (showColorSettings = false)}
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal course-list-modal"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
			>
				<button
					class="modal-close"
					onclick={() => (showColorSettings = false)}>×</button
				>

				<h2>Course Colours</h2>
				<p class="muted small elective-note">
					Saved in this browser only. Courses default to their
					department's colour.
				</p>

				<div class="course-list-container">
					{#each myTimetableCourses as [base, course]}
						<div class="colour-item">
							<label
								class="colour-swatch"
								style="background: {courseAccent(course)}"
								title="Pick a colour for {base}"
							>
								<input
									type="color"
									aria-label="Colour for {base}"
									value={courseColors[base] ?? "#8a8a8a"}
									oninput={(e) =>
										setCourseColor(
											base,
											e.currentTarget.value,
										)}
								/>
							</label>
							<div class="colour-item-info">
								<span class="mono">{base}</span>
								<span class="muted small"
									>{course.courseName}</span
								>
							</div>
							{#if courseColors[base]}
								<button
									class="btn small"
									onclick={() => clearCourseColor(base)}
									>Reset</button
								>
							{/if}
						</div>
					{:else}
						<p class="muted">
							Add some courses first — there's nothing to colour
							yet.
						</p>
					{/each}
				</div>

				{#if Object.keys(courseColors).length}
					<button
						class="btn secondary"
						onclick={() => (courseColors = {})}
						>Reset all to department colours</button
					>
				{/if}
				<button
					class="btn primary"
					onclick={() => (showColorSettings = false)}>Done</button
				>
			</div>
		</div>
	{/if}

	<!-- Major electives offered to the user's own programme -->
	{#if showElectiveList}
		<div
			class="modal-overlay"
			onclick={() => (showElectiveList = false)}
			role="button"
			tabindex="-1"
			onkeydown={(e) => e.key === "Escape" && (showElectiveList = false)}
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal course-list-modal"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
			>
				<button
					class="modal-close"
					onclick={() => (showElectiveList = false)}>×</button
				>

				<label class="uwe-toggle browse-fits">
					<input type="checkbox" bind:checked={onlyFits} />
					<span class="toggle-label">Fits my week</span>
				</label>

				<h2>My Major Electives</h2>
				<p class="muted small elective-note">
					Offered to {$currentBatches.join(", ")} — pick the ones you
					are taking, they are not added for you.
				</p>

				<input
					type="text"
					class="input dept-filter"
					placeholder="Search your electives by code, name or faculty…"
					bind:value={electiveSearch}
					autocomplete="off"
				/>

				<div class="course-list-container">
					{#each visibleElectives as item}
						{@render courseCard(item)}
					{:else}
						<p class="muted">No electives match.</p>
					{/each}
				</div>

				<button
					class="btn primary"
					onclick={() => (showElectiveList = false)}>Close</button
				>
			</div>
		</div>
	{/if}

	<!-- Browse by department -->
	{#if showBrowse}
		<div
			class="modal-overlay"
			onclick={() => (showBrowse = false)}
			role="button"
			tabindex="-1"
			onkeydown={(e) => e.key === "Escape" && (showBrowse = false)}
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal course-list-modal"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
			>
				<button class="modal-close" onclick={() => (showBrowse = false)}
					>×</button
				>

				{#if !browseDept}
					<h2>Add UWE / CCC</h2>

					<input
						type="text"
						class="input dept-filter"
						placeholder="Search all courses by code, name or faculty…"
						bind:value={browseSearch}
						bind:this={browseSearchRef}
						autocomplete="off"
					/>

					{@render filterChips()}

					{#if browseSearch.trim().length >= 2}
						<div class="course-list-container">
							{#each searchResults as item}
								{@render courseCard(item)}
							{:else}
								<p class="muted">No courses match.</p>
							{/each}
						</div>
					{:else}
						<div class="dept-grid">
							{#each [...deptCounts].filter(([, n]) => n > 0) as [dept, count]}
								<button
									class="dept-card"
									style="--accent: {deptColor(dept)}"
									onclick={() => openBrowseDept(dept)}
								>
									<span class="dept-code">
										<span class="dept-dot"></span>
										<span class="mono">{dept}</span>
									</span>
									<span class="muted small">{count} courses</span>
								</button>
							{:else}
								<p class="muted">
									Nothing fits your week right now.
								</p>
							{/each}
						</div>
					{/if}
				{:else}
					<h2>
						<button class="dept-back" onclick={() => (browseDept = null)}
							>←</button
						>
						{browseDept}
						<span class="muted small">({browseCourses.length})</span>
					</h2>

					<input
						type="text"
						class="input dept-filter"
						placeholder="Search {browseDept} by code, name or faculty…"
						bind:value={browseFilter}
						bind:this={browseFilterRef}
						autocomplete="off"
					/>

					{@render filterChips()}

					<div class="course-list-container">
						{#each browseCourses as item}
							{@render courseCard(item)}
						{:else}
							<p class="muted">No courses match.</p>
						{/each}
					</div>
				{/if}

				<button class="btn primary" onclick={() => (showBrowse = false)}
					>Close</button
				>
			</div>
		</div>
	{/if}

	<!-- Whole-course planner -->
	{#if plannerBase}
		{@const existing = timetableExcluding(plannerBase)}
		{@const sample = $allCourses.find(
			(c) => getBaseCourseCode(c.courseCode) === plannerBase,
		)}
		{@const unresolved = plannerGroups.filter((g) => {
			const s = g.sections.find((x) => x.code === plannerPicks[g.prefix]);
			return (
				!s ||
				sectionConflicts(s.rows, [
					...existing,
					...pickedRowsExcept(g.prefix),
				]).length > 0
			);
		})}
		<div
			class="modal-overlay planner-overlay"
			onclick={() => (plannerBase = null)}
			role="button"
			tabindex="-1"
			onkeydown={(e) => e.key === "Escape" && (plannerBase = null)}
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal planner-modal"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				tabindex="-1"
			>
				<button class="modal-close" onclick={() => (plannerBase = null)}
					>×</button
				>
				<h2>{plannerBase}</h2>
				<p class="planner-name">{sample?.courseName ?? ""}</p>

				{#if !hasOpenSection(plannerBase)}
					<p class="planner-not-uwe">
						⚠ Not a UWE — this course isn't open to you as a UWE and
						isn't one of your major electives. You can plan it, but
						you may not be allowed to register for it.
					</p>
				{/if}

				<div
					class="planner-status"
					class:bad={unresolved.length > 0}
				>
					{#if unresolved.length === 0}
						✓ This whole course fits your timetable
					{:else}
						✕ Clash in {unresolved
							.map((g) => GROUP_LABEL[g.prefix])
							.join(", ")} — try another section
					{/if}
				</div>

				<div class="planner-groups">
					{#each plannerGroups as group}
						<div class="planner-group">
							<h3 class="planner-group-title">
								{GROUP_LABEL[group.prefix]}
								<span class="muted small"
									>pick one of {group.sections.length}</span
								>
							</h3>
							{#each group.sections as section}
								{@const conflicts = sectionConflicts(
									section.rows,
									[
										...existing,
										...pickedRowsExcept(group.prefix),
									],
								)}
								{@const already = inTimetable(section.code)}
								{@const openToYou = section.rows.some(canAdd)}
								<button
									class="planner-option"
									class:picked={plannerPicks[group.prefix] ===
										section.code}
									class:already
									class:has-conflict={conflicts.length > 0}
									disabled={already}
									onclick={() =>
										(plannerPicks = {
											...plannerPicks,
											[group.prefix]: section.code,
										})}
								>
									<span class="planner-option-head">
										<span class="mono"
											>{section.code.split("-")[1] ??
												section.code}</span
										>
										{#if !openToYou}
											<span class="not-uwe-badge"
												>⚠ Not a UWE</span
											>
										{/if}
										{#if already}
											<span class="badge ok"
												>Already in your timetable</span
											>
										{:else if conflicts.length > 0}
											<span class="badge warning"
												>Clash</span
											>
										{:else}
											<span class="badge ok">Free</span>
										{/if}
									</span>
									{#each section.rows as row}
										<span class="muted small"
											>{row.day}
											{row.startTime}-{row.endTime} • {row.room}</span
										>
									{/each}
									{#if conflicts.length > 0 && !already}
										<span class="planner-conflict"
											>⚠ Clashes with {conflicts
												.map(
													(c) =>
														c.courseCode.split(
															"-",
														)[0],
												)
												.join(", ")}</span
										>
									{/if}
								</button>
							{/each}
						</div>
					{/each}
				</div>

				<div class="planner-actions">
					<button class="btn" onclick={() => (plannerBase = null)}
						>Cancel</button
					>
					<button
						class="btn primary"
						onclick={addPlannedCourse}
						disabled={unresolved.length > 0}
					>
						Add course
					</button>
				</div>
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

	/* Deliberately a quiet link, not a button — the batch flow is the norm */
	.skip-batch {
		display: block;
		margin: 0.8rem auto 0;
		padding: 0;
		background: none;
		border: none;
		color: #777;
		font-family: inherit;
		font-size: 0.72rem;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.skip-batch:hover {
		color: #fff;
	}

	.batch-form-footer {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid #222;
		text-align: center;
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

	.home-link {
		text-decoration: none;
		color: inherit;
		transition: opacity 0.15s;
	}

	.home-link:hover {
		opacity: 0.7;
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
	.tag-button {
		border: 1px dashed #333;
		cursor: pointer;
		font-family: inherit;
	}
	.tag-button:hover {
		color: #fff;
		border-color: #555;
	}

	.tag.small {
		font-size: 0.65rem;
		padding: 0.15rem 0.4rem;
	}

	.credits-pill {
		display: flex;
		align-items: center;
		gap: 2px;
		background: #111;
		border: 1px solid #222;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.8rem;
		margin-left: 0.5rem;
	}

	.credits-val {
		font-weight: 600;
		color: #fff;
	}
	.credits-val.over {
		color: #ffaa00;
	}

	.credits-sep {
		color: #555;
		margin: 0 1px;
	}

	.credits-max {
		background: transparent;
		border: none;
		color: #888;
		width: 2ch;
		font-size: 0.8rem;
		padding: 0;
		text-align: center;
		font-family: inherit;
		cursor: text;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.credits-max:focus {
		outline: none;
		color: #fff;
		border-bottom: 1px solid #444;
	}
	.credits-max::-webkit-outer-spin-button,
	.credits-max::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.credits-label {
		color: #444;
		font-size: 0.7rem;
		margin-left: 2px;
	}

	.cr-badge {
		font-size: 0.65rem;
		background: #1a1a1a;
		color: #888;
		padding: 1px 4px;
		border-radius: 3px;
		border: 1px solid #222;
		font-family: "SF Mono", monospace;
	}



	/* The two add buttons sit left, next to the batch tags; everything else
	   (export, lists, reset) stays pushed to the right. */
	.add-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.add-btn {
		white-space: nowrap;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
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


	.item-name {
		font-size: 0.8rem;
		color: #888;
	}
	.item-type {
		font-size: 0.7rem;
		color: #555;
		font-style: italic;
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

	/* left/width come from the lane assignment inline */
	.course-block {
		position: absolute;
		background: color-mix(in srgb, var(--accent, #111) 8%, #111);
		border: 1px solid #222;
		border-left: 2px solid var(--accent, #2a2a2a);
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

	/* !important beats the inline lane geometry — a 33%-wide block cannot
	   show its own name, so hovering expands it over its neighbours. */
	.course-block:hover {
		left: 2px !important;
		width: calc(100% - 4px) !important;
		z-index: 50;
		transform: scale(1.05);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		overflow: visible;
		min-height: fit-content !important;
		background: color-mix(in srgb, var(--accent, #1a1a1a) 14%, #1a1a1a);
	}

	.course-block:hover .block-name,
	.course-block:hover .block-code,
	.course-block:hover .block-type,
	.course-block:hover .block-room {
		white-space: normal;
		overflow: visible;
		word-break: break-word;
	}

	/* "Added by you" rides on the other three edges — the left edge carries
	   the department/UWE/CCC colour and must not be overwritten. */
	.course-block.added {
		border-top-color: #444;
		border-right-color: #444;
		border-bottom-color: #444;
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
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.list-item.clickable:hover {
		background: #111;
		border-color: #252525;
	}

	.list-item.added {
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
		.course-modal {
			padding: 1.25rem;
		}
		/* Two columns of labels get unreadable on a phone */
		.course-modal-grid {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}
		.header {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}
		.add-actions {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
		}
		.add-btn {
			font-size: 0.8rem;
			padding: 0.5rem 0.6rem;
		}
		.header-actions {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
			margin-left: 0;
		}

		/* Course pickers take the whole screen — a 90vw card with its own
		   inner scroll is unusable on a phone. */
		/* .modal.course-list-modal, not .course-list-modal — the plain class
		   is redeclared later in the sheet and would win on width. */
		.modal.course-list-modal {
			width: 100vw;
			max-width: none;
			height: 100dvh;
			max-height: none;
			margin: 0;
			border: none;
			border-radius: 0;
			padding: 1.25rem 1rem 1rem;
			display: flex;
			flex-direction: column;
			animation: none;
		}
		.modal.course-list-modal .course-list-container,
		.modal.course-list-modal .dept-grid {
			flex: 1;
			max-height: none;
		}
		.modal-overlay:has(.course-list-modal) {
			padding: 0;
			align-items: stretch;
			justify-content: stretch;
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
		/* A course with many sections would otherwise run off a phone screen */
		max-height: 85vh;
		overflow-y: auto;
		overscroll-behavior: contain;
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

	.colour-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.legend-edit {
		background: none;
		border: 1px solid #333;
		border-radius: 999px;
		color: #999;
		font-size: 0.65rem;
		padding: 0.15rem 0.5rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.legend-edit:hover {
		border-color: #555;
		color: #fff;
	}

	.colour-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		background: #1a1a1a;
		border-radius: 6px;
	}

	.colour-item-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
		min-width: 0;
	}

	.colour-item-info .muted {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* The swatch IS the picker: it shows the course's real current colour
	   (which may be an oklch default that input[type=color] cannot hold),
	   with a transparent native picker laid over it. */
	.colour-swatch {
		position: relative;
		width: 26px;
		height: 26px;
		border-radius: 6px;
		border: 1px solid #333;
		flex: none;
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.colour-swatch:hover {
		border-color: #777;
	}

	.colour-swatch input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		margin: 0;
		border: none;
		opacity: 0;
		cursor: pointer;
	}

	/* A course can list 21 batches — give that the full row */
	.course-modal-item.wide {
		grid-column: 1 / -1;
	}

	.mono-sm {
		font-family: "SF Mono", monospace;
		font-size: 0.75rem;
		line-height: 1.5;
		word-break: break-word;
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
		padding-right: 9rem; /* clear of the × and the Fits toggle */
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
		background: color-mix(in srgb, var(--accent, #1a1a1a) 7%, #1a1a1a);
		border-left: 2px solid var(--accent, #2a2a2a);
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

	.course-list-actions {
		flex-shrink: 0;
		align-self: center;
	}

	/* Browse by department */
	/* Reads as an affordance, not a footnote — this is the main way in
	   for anyone who doesn't already know a course code. */


	.dept-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 0.5rem;
		max-height: 60vh;
		overflow-y: auto;
		margin-bottom: 1rem;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		padding: 0.7rem 0.2rem 0;
		font-size: 0.7rem;
		color: #888;
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.legend-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.dept-card {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		align-items: flex-start;
		padding: 0.6rem 0.7rem;
		background: color-mix(in srgb, var(--accent, #1a1a1a) 8%, #1a1a1a);
		border: 1px solid #333;
		border-left: 2px solid var(--accent, #333);
		border-radius: 6px;
		color: #ddd;
		cursor: pointer;
		transition: all 0.15s;
	}

	.dept-card:hover {
		border-color: #666;
		background: #222;
	}

	.dept-code {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 1rem;
	}

	.dept-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent, #555);
		flex: none;
	}

	.dept-back {
		background: none;
		border: none;
		color: #888;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0 0.4rem 0 0;
	}

	.dept-back:hover {
		color: #fff;
	}

	.dept-filter {
		width: 100%;
		margin-bottom: 0.75rem;
	}

	.elective-badge {
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 0.1rem 0.35rem;
		border: 1px solid #333;
		border-radius: 3px;
		color: #888;
		white-space: nowrap;
	}

	/* Your own programme's elective, as opposed to one you'd take as a UWE */
	.elective-badge.mine {
		border-color: #22c55e55;
		color: #22c55e;
	}

	.batch-line {
		font-family: var(--font-mono, "SF Mono", monospace);
		font-size: 0.66rem;
		opacity: 0.85;
	}

	.elective-note {
		margin: -0.5rem 0 0.75rem;
	}

	/* Sits just left of the modal's × */
	.browse-fits {
		position: absolute;
		top: 0.75rem;
		right: 3rem;
	}

	.filter-chips {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin: -0.35rem 0 0.75rem;
	}

	/* Pill toggles: the native box is hidden, the pill itself shows state */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.28rem 0.7rem;
		border: 1px solid #3d3d3d;
		border-radius: 999px;
		background: #1e1e1e;
		color: #ddd;
		font-size: 0.72rem;
		/* Same weight checked or not, so the pill never resizes on click */
		font-weight: 600;
		cursor: pointer;
		user-select: none;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s,
			transform 0.08s;
	}

	.chip:hover {
		border-color: #5a5a5a;
		background: #262626;
		color: #fff;
	}

	.chip:active {
		transform: scale(0.96);
	}

	.chip input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	/* Fixed-width marker so + and ✓ occupy the same space */
	.chip span::before {
		content: "+";
		display: inline-block;
		width: 0.85em;
		opacity: 0.7;
	}

	.chip:has(input:checked) {
		background: #fff;
		border-color: #fff;
		color: #000;
	}

	.chip:has(input:checked) span::before {
		content: "✓";
		opacity: 1;
	}

	.chip:has(input:focus-visible) {
		outline: 2px solid #4a9eff;
		outline-offset: 2px;
	}

	.section-rows {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-height: 45vh;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.section-row {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid #222;
		border-left: 3px solid #333;
		border-radius: 4px;
	}

	/* The section you actually have */
	.section-row.mine {
		border-left-color: #22c55e;
		background: rgba(34, 197, 94, 0.07);
	}

	.section-row-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.not-uwe-badge {
		font-size: 0.6rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 0.1rem 0.35rem;
		border: 1px solid #ef4444;
		border-radius: 3px;
		background: #ef444422;
		color: #ef4444;
		font-weight: 700;
		white-space: nowrap;
	}

	.planner-not-uwe {
		margin: 0 0 0.75rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid #ef4444;
		border-radius: 4px;
		background: #ef444418;
		color: #ef4444;
		font-size: 0.75rem;
		font-weight: 600;
	}

	/* Whole-course planner */
	.fit-note {
		font-size: 0.7rem;
		color: #22c55e;
	}

	.fit-note.bad {
		color: #f59e0b;
	}

	.planner-overlay {
		z-index: 1200;
	}

	.planner-modal {
		max-width: 560px;
		width: 92vw;
		text-align: left;
		position: relative;
	}

	.planner-modal h2 {
		font-family: "SF Mono", monospace;
		margin-bottom: 0.25rem;
	}

	.planner-name {
		color: #aaa;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.planner-status {
		padding: 0.6rem 0.8rem;
		border-radius: 6px;
		font-size: 0.85rem;
		background: rgba(34, 197, 94, 0.12);
		color: #22c55e;
		margin-bottom: 1rem;
	}

	.planner-status.bad {
		background: rgba(245, 158, 11, 0.12);
		color: #f59e0b;
	}

	.planner-groups {
		max-height: 55vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.planner-group-title {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #888;
		margin-bottom: 0.5rem;
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
	}

	.planner-option {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: 100%;
		text-align: left;
		padding: 0.6rem 0.75rem;
		margin-bottom: 0.4rem;
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 6px;
		color: #ddd;
		cursor: pointer;
		transition: all 0.15s;
	}

	.planner-option:hover:not(:disabled) {
		border-color: #666;
	}

	.planner-option.picked {
		border-color: #fff;
		background: #222;
	}

	.planner-option.has-conflict {
		opacity: 0.6;
	}

	.planner-option.already {
		cursor: default;
		border-color: rgba(34, 197, 94, 0.5);
		background: rgba(34, 197, 94, 0.1);
		opacity: 1;
	}

	.planner-option-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: space-between;
	}

	.section-row .badge,
	.planner-option .badge {
		padding: 0.15rem 0.45rem;
		font-size: 0.68rem;
		border-radius: 4px;
		background: #333;
		color: #aaa;
	}

	.section-row .badge.ok,
	.planner-option .badge.ok {
		background: rgba(34, 197, 94, 0.18);
		color: #22c55e;
	}

	.planner-option .badge.warning {
		background: rgba(245, 158, 11, 0.2);
		color: #f59e0b;
	}

	.planner-conflict {
		font-size: 0.72rem;
		color: #f59e0b;
	}

	.planner-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}
</style>
