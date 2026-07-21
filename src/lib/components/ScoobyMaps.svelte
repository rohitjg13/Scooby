<script lang="ts">
	import { onMount } from "svelte";
	import "leaflet/dist/leaflet.css";
	import "leaflet.markercluster/dist/MarkerCluster.css";

	type Place = { name: string; type: string; icon: string; lat: number; lng: number; desc: string };

	// Category → signage colour
	const COLORS: Record<string, string> = {
		Landmarks: "#cf3f1e", Residential: "#294156", Academics: "#7c2d3a",
		Food: "#bd7d16", Essentials: "#3f6f8f", Sports: "#6d4b7a",
	};
	const CAMPUS: [number, number] = [28.525, 77.5745];

	const PLACES: Place[] = [
		// ---- Landmarks ----
		{ name: "Convocation Arena", type: "Landmarks", icon: "🏟️", lat: 28.5212659, lng: 77.5709869, desc: "Where degrees get handed out and the big matches happen." },
		{ name: "SARC", type: "Landmarks", icon: "🎬", lat: 28.5237344, lng: 77.5742457, desc: "The nerve centre where clubs and events get planned." },
		{ name: "Amphitheatre", type: "Landmarks", icon: "🎭", lat: 28.523989, lng: 77.5743, desc: "Open-air steps where performances and fests come alive." },
		{ name: "SNU Lake", type: "Landmarks", icon: "🌅", lat: 28.525331, lng: 77.576931, desc: "Quiet water behind the academic blocks — best at sunrise." },
		{ name: "HCL Health Centre", type: "Landmarks", icon: "🏥", lat: 28.5265408, lng: 77.5722039, desc: "Campus clinic for when you're feeling under the weather." },
		{ name: "Horse Stables", type: "Landmarks", icon: "🐴", lat: 28.518782, lng: 77.57357, desc: "Yes, the university keeps horses. Go say hi." },
		{ name: "AnB Atrium", type: "Landmarks", icon: "🍔", lat: 28.526136, lng: 77.576917, desc: "The food corner tucked between A and B blocks." },
		{ name: "Biodiversity Park", type: "Landmarks", icon: "🌳", lat: 28.5223428, lng: 77.5744256, desc: "A leafy pocket of birds and quiet to disappear into." },

		// ---- Residential ----
		{ name: "Hostel 1A (Sundarbans)", type: "Residential", icon: "🏠", lat: 28.524588, lng: 77.573023, desc: "Home base for the Sundarbans crowd." },
		{ name: "Hostel 1B (Chilika)", type: "Residential", icon: "🏠", lat: 28.524301, lng: 77.573075, desc: "The Chilika block — your room's somewhere down these halls." },
		{ name: "Hostel 1C (Eagle Nest)", type: "Residential", icon: "🏠", lat: 28.5244585, lng: 77.5732597, desc: "Eagle's Nest, perched with the rest of Hostel 1." },
		{ name: "Hostel 2A (Hemis)", type: "Residential", icon: "🏠", lat: 28.5229857, lng: 77.573385, desc: "Hemis — part of the Hostel 2 cluster." },
		{ name: "Hostel 2B (Kaziranga)", type: "Residential", icon: "🏠", lat: 28.5228032, lng: 77.5735391, desc: "Kaziranga block, Hostel 2." },
		{ name: "Hostel 2C (Periyar)", type: "Residential", icon: "🏠", lat: 28.5227347, lng: 77.5727335, desc: "Periyar — find your floor and settle in." },
		{ name: "Hostel 3A (Gir)", type: "Residential", icon: "🏠", lat: 28.524862, lng: 77.570837, desc: "Gir block, over on the Hostel 3 side." },
		{ name: "Hostel 3B (Dibang)", type: "Residential", icon: "🏠", lat: 28.525172, lng: 77.57097, desc: "Dibang — Hostel 3 living." },
		{ name: "Hostel 3C (Kanha)", type: "Residential", icon: "🏠", lat: 28.524857, lng: 77.571364, desc: "Kanha block, Hostel 3." },
		{ name: "Hostel 4A (Manas)", type: "Residential", icon: "🏠", lat: 28.523661, lng: 77.570002, desc: "Manas — welcome to Hostel 4." },
		{ name: "Hostel 4B (Marine)", type: "Residential", icon: "🏠", lat: 28.524055, lng: 77.570107, desc: "Marine block, Hostel 4." },
		{ name: "Hostel 4C (Mudumalai)", type: "Residential", icon: "🏠", lat: 28.5234444, lng: 77.571, desc: "Mudumalai — the far end of Hostel 4." },
		{ name: "Hostel 5A (Belta)", type: "Residential", icon: "🏠", lat: 28.522599, lng: 77.569385, desc: "Belta, newest of the Hostel 5 blocks." },
		{ name: "Hostel 5B (Bandipur)", type: "Residential", icon: "🏠", lat: 28.522612, lng: 77.57044, desc: "Bandipur block, Hostel 5." },
		{ name: "Hostel 5C (Bandhavgarh)", type: "Residential", icon: "🏠", lat: 28.522925, lng: 77.569519, desc: "Bandhavgarh — Hostel 5 living." },
		{ name: "Tower 1", type: "Residential", icon: "🏢", lat: 28.528446, lng: 77.575398, desc: "Tower 1 of the residential high-rises." },
		{ name: "Tower 2", type: "Residential", icon: "🏢", lat: 28.528854, lng: 77.5768375, desc: "Tower 2, up in the residential high-rises." },
		{ name: "Tower 3", type: "Residential", icon: "🏢", lat: 28.529094, lng: 77.5771375, desc: "Tower 3 of the tower cluster." },
		{ name: "Tower 4", type: "Residential", icon: "🏢", lat: 28.5297118, lng: 77.5780086, desc: "Tower 4, north end of the high-rises." },
		{ name: "Tower 5", type: "Residential", icon: "🏢", lat: 28.529865, lng: 77.5775925, desc: "Tower 5 of the residential towers." },
		{ name: "Tower 6", type: "Residential", icon: "🏢", lat: 28.530136, lng: 77.5779005, desc: "Tower 6, up top of the cluster." },
		{ name: "Tower 7", type: "Residential", icon: "🏢", lat: 28.529367, lng: 77.5783155, desc: "Tower 7 of the residential high-rises." },
		{ name: "Tower 8", type: "Residential", icon: "🏢", lat: 28.5287309, lng: 77.5777427, desc: "Tower 8 in the tower cluster." },
		{ name: "Tower 9", type: "Residential", icon: "🏢", lat: 28.528857, lng: 77.5777945, desc: "Tower 9 of the high-rises." },
		{ name: "Tower 10", type: "Residential", icon: "🏢", lat: 28.528534, lng: 77.5777165, desc: "Tower 10, last of the residential towers." },

		// ---- Academics ----
		{ name: "A Block", type: "Academics", icon: "🏛️", lat: 28.5260029, lng: 77.5754549, desc: "Engineering's home turf — labs and lecture halls." },
		{ name: "B Block", type: "Academics", icon: "🏛️", lat: 28.5265965, lng: 77.5763243, desc: "Admin and academics; where the paperwork lives." },
		{ name: "C Block", type: "Academics", icon: "🏛️", lat: 28.5260851, lng: 77.5757235, desc: "Classes and meetings, with CnD and Naveen right outside." },
		{ name: "D Block", type: "Academics", icon: "🏛️", lat: 28.52542, lng: 77.5759093, desc: "Faculty offices and a good chunk of your timetable." },
		{ name: "F Block", type: "Academics", icon: "🏛️", lat: 28.527013, lng: 77.5727915, desc: "The tucked-away block for classes and labs." },
		{ name: "Management Block (G Block)", type: "Academics", icon: "🎓", lat: 28.5276954, lng: 77.5737169, desc: "B-school turf with an auditorium that hosts the big events." },
		{ name: "Research Annexe", type: "Academics", icon: "🔬", lat: 28.5274007, lng: 77.5784083, desc: "Where the research crowd disappears for hours." },
		{ name: "Library", type: "Academics", icon: "📚", lat: 28.5248591, lng: 77.5740441, desc: "AC, wifi, books, and the occasional donut run." },

		// ---- Food ----
		{ name: "Dining Hall 1", type: "Food", icon: "🍽️", lat: 28.5237624, lng: 77.573465, desc: "The busiest mess — snacks well past midnight." },
		{ name: "CnD", type: "Food", icon: "☕", lat: 28.525418, lng: 77.576297, desc: "Coffee rolls and chai, the campus classic." },
		{ name: "Dining Hall 2", type: "Food", icon: "🍽️", lat: 28.524422, lng: 77.570528, desc: "Order, queue, eat, repeat." },
		{ name: "Dining Hall 3", type: "Food", icon: "🍽️", lat: 28.5232448, lng: 77.569707, desc: "The calm mess for when you want to eat in peace." },
		{ name: "Nescafe", type: "Food", icon: "🍩", lat: 28.52501, lng: 77.574915, desc: "Late-night espresso shots and the only donuts on campus." },
		{ name: "Naveen Tea House", type: "Food", icon: "🍵", lat: 28.5252787, lng: 77.57628, desc: "Chai for every mood and every gossip session." },
		{ name: "Surya Food & Beverages", type: "Food", icon: "🥤", lat: 28.5254585, lng: 77.5763157, desc: "Quick-snack stop when hunger strikes." },
		{ name: "Swad Kathi Roll", type: "Food", icon: "🌯", lat: 28.5254585, lng: 77.5763157, desc: "Rolls worth the dare, plus pizza, fries and poha." },
		{ name: "Rama Enterprise (Shakes)", type: "Food", icon: "🧋", lat: 28.5253552, lng: 77.5757365, desc: "Shakes and juices, plus a fiery plate of Manchurian." },
		{ name: "The Adda", type: "Food", icon: "🍴", lat: 28.5260824, lng: 77.5770077, desc: "Grab a bite and hang around a while." },
		{ name: "The Anna Cafe", type: "Food", icon: "🍛", lat: 28.5261641, lng: 77.5769734, desc: "Get there before the vadas run out." },
		{ name: "Mahesh Chinese Fast Food", type: "Food", icon: "🥡", lat: 28.5347241, lng: 77.5750717, desc: "Chinese fix just outside the gate." },
		{ name: "Adarsh Dhaba", type: "Food", icon: "🍛", lat: 28.534833, lng: 77.5741563, desc: "The off-campus dhaba everyone ends up at." },

		// ---- Essentials ----
		{ name: "Parking 1", type: "Essentials", icon: "🅿️", lat: 28.5245085, lng: 77.5742751, desc: "Park up near the academic side." },
		{ name: "Parking 2", type: "Essentials", icon: "🅿️", lat: 28.5257937, lng: 77.5737519, desc: "Second lot, closer to the towers." },
		{ name: "Mini Mart", type: "Essentials", icon: "🛒", lat: 28.5247548, lng: 77.5716399, desc: "4am cravings sorted — haircut counter included." },
		{ name: "Cycle Repair", type: "Essentials", icon: "🚲", lat: 28.5274325, lng: 77.5728886, desc: "Flat tyre or loose chain? Get it fixed here." },
		{ name: "Happy Green", type: "Essentials", icon: "🏪", lat: 28.5289344, lng: 77.5744123, desc: "Everyday store for the little things." },
		{ name: "Adidas", type: "Essentials", icon: "👟", lat: 28.5274375, lng: 77.5726823, desc: "Kit yourself out in the arcade." },
		{ name: "Supermarket", type: "Essentials", icon: "🏬", lat: 28.5272852, lng: 77.5728349, desc: "Stock up on groceries and essentials." },
		{ name: "HDFC Bank", type: "Essentials", icon: "🏧", lat: 28.5247548, lng: 77.5715031, desc: "ATM and banking runs." },
		{ name: "Unisex Salon", type: "Essentials", icon: "💈", lat: 28.5247548, lng: 77.57146, desc: "Haircut and grooming, no appointment drama." },
		{ name: "India Post", type: "Essentials", icon: "📮", lat: 28.5275579, lng: 77.5772969, desc: "Send and collect your mail." },
		{ name: "Medical Store", type: "Essentials", icon: "💊", lat: 28.5276063, lng: 77.5726312, desc: "Meds and band-aids in the arcade." },
		{ name: "Books & Stationery", type: "Essentials", icon: "✏️", lat: 28.5276157, lng: 77.5729347, desc: "Notebooks, pens, and last-minute printouts." },

		// ---- Sports ----
		{ name: "Badminton Court (Outdoor)", type: "Sports", icon: "🏸", lat: 28.5251713, lng: 77.5722183, desc: "Open-air shuttle rallies." },
		{ name: "Badminton Court (Indoor)", type: "Sports", icon: "🏸", lat: 28.5214868, lng: 77.5710233, desc: "Indoor courts for the serious games." },
		{ name: "Basketball Court 1", type: "Sports", icon: "🏀", lat: 28.5251713, lng: 77.5722183, desc: "Hoops near the courts cluster." },
		{ name: "Basketball Court 2", type: "Sports", icon: "🏀", lat: 28.523966, lng: 77.571325, desc: "The second court for pickup games." },
		{ name: "Football Field", type: "Sports", icon: "⚽", lat: 28.523017, lng: 77.571796, desc: "Full-size pitch for match days." },
		{ name: "Tennis Court", type: "Sports", icon: "🎾", lat: 28.523948, lng: 77.57155, desc: "Baseline to net — take your shot." },
		{ name: "Volleyball Court", type: "Sports", icon: "🏐", lat: 28.5244324, lng: 77.5717481, desc: "Bump, set, spike." },
		{ name: "Cricket Ground", type: "Sports", icon: "🏏", lat: 28.5260497, lng: 77.5732257, desc: "The big ground for gully-to-glory cricket." },
		{ name: "Squash Court", type: "Sports", icon: "🥎", lat: 28.5214868, lng: 77.5710233, desc: "Fast rallies behind closed walls." },
		{ name: "Table Tennis Court", type: "Sports", icon: "🏓", lat: 28.5214868, lng: 77.5710233, desc: "Quick paddle games indoors." },
		{ name: "Golf Course", type: "Sports", icon: "⛳", lat: 28.5282225, lng: 77.572396, desc: "Practise your swing on the fairway." },
	];

	const types = ["All", ...Object.keys(COLORS).filter((t) => PLACES.some((p) => p.type === t))];

	let active = $state("All");
	let term = $state("");

	// Mobile bottom sheet: `sheet` is the body's live height in px (0 = peek).
	let mobile = $state(false);
	let sheet = $state(0);
	let dragging = $state(false);
	const openHeight = () => Math.min(window.innerHeight * 0.6, window.innerHeight - 110);
	const openSheet = () => { if (mobile) sheet = openHeight(); };
	const closeSheet = () => { sheet = 0; };

	const shown = $derived(
		PLACES.filter(
			(p) =>
				(active === "All" || p.type === active) &&
				(p.name.toLowerCase().includes(term.trim().toLowerCase()) ||
					p.type.toLowerCase().includes(term.trim().toLowerCase())),
		),
	);

	const col = (p: Place) => COLORS[p.type] || "#191712";
	const dirUrl = (p: Place) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
	const esc = (s: string) =>
		(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

	// Leaflet lives only on the client — everything below is set up in onMount.
	let L: any;
	let map: any;
	let cluster: any;
	const markers = new Map<Place, any>();

	function renderMarkers() {
		if (!cluster) return;
		cluster.clearLayers();
		cluster.addLayers(shown.map((p) => markers.get(p)).filter(Boolean));
	}

	function focus(p: Place) {
		closeSheet();
		const m = markers.get(p);
		if (cluster && m) cluster.zoomToShowLayer(m, () => m.openPopup());
	}

	// Draggable bottom-sheet handle — the sheet follows the pointer live, then
	// snaps open/closed on release based on position + flick velocity.
	let startY = 0;
	let startSheet = 0;
	let lastY = 0;
	let lastT = 0;
	let vel = 0; // px/ms, +down / -up
	function grabDown(e: PointerEvent) {
		dragging = true;
		startY = lastY = e.clientY;
		startSheet = sheet;
		lastT = performance.now();
		vel = 0;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function grabMove(e: PointerEvent) {
		if (!dragging) return;
		const now = performance.now();
		vel = (e.clientY - lastY) / Math.max(1, now - lastT);
		lastY = e.clientY;
		lastT = now;
		sheet = Math.max(0, Math.min(openHeight(), startSheet + (startY - e.clientY)));
	}
	function grabUp(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		const moved = Math.abs(e.clientY - startY);
		let open: boolean;
		if (moved < 6) open = sheet === 0; // treat as a tap → toggle
		else if (vel < -0.35) open = true; // flick up
		else if (vel > 0.35) open = false; // flick down
		else open = sheet > openHeight() * 0.4; // settle by position
		sheet = open ? openHeight() : 0;
	}

	onMount(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const mq = window.matchMedia("(max-width:640px)");
		mobile = mq.matches;
		const onMq = (e: MediaQueryListEvent) => {
			mobile = e.matches;
			sheet = 0;
		};
		mq.addEventListener("change", onMq);

		(async () => {
			const leaflet = await import("leaflet");
			L = (leaflet as any).default ?? leaflet;
			await import("leaflet.markercluster");

			map = L.map("scooby-map", { zoomControl: false, attributionControl: true }).setView(CAMPUS, 16);
			L.control.zoom({ position: "bottomright" }).addTo(map);
			L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
				maxZoom: 20, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO",
			}).addTo(map);

			cluster = L.markerClusterGroup({
				showCoverageOnHover: false, maxClusterRadius: 50, spiderfyDistanceMultiplier: 1.5,
				iconCreateFunction: (c: any) =>
					L.divIcon({ html: `<div class="cluster">${c.getChildCount()}</div>`, className: "", iconSize: [38, 38] }),
			}).addTo(map);

			for (const p of PLACES) {
				const c = col(p);
				const icon = L.divIcon({
					className: "", html: `<div class="pin" style="background:${c}">${p.icon}</div>`,
					iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -17],
				});
				const m = L.marker([p.lat, p.lng], { icon }).bindPopup(
					`<div class="pop"><div class="pop-type" style="color:${c}">${esc(p.type)}</div>` +
						`<h4>${esc(p.name)}</h4><p>${esc(p.desc)}</p>` +
						`<a class="dirbtn" href="${dirUrl(p)}" target="_blank" rel="noopener">Get directions` +
						`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17 17 7M9 7h8v8"/></svg></a></div>`,
				);
				markers.set(p, m);
			}

			map.fitBounds(L.featureGroup([...markers.values()]).getBounds().pad(0.1));
			renderMarkers();
		})();

		return () => {
			document.body.style.overflow = prev;
			mq.removeEventListener("change", onMq);
			map?.remove();
		};
	});

	// keep the visible pins in sync with the search / category filter
	$effect(() => {
		shown;
		renderMarkers();
	});
</script>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Big+Shoulders+Display:wght@500;600;700;800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="scooby">
	<div id="scooby-map" class="map"></div>

	<a class="back" href="/" aria-label="Back to Scooby home">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
	</a>

	<aside class="panel">
		<div class="grab" onpointerdown={grabDown} onpointermove={grabMove} onpointerup={grabUp}><span></span></div>
		<div class="phead">
			<span class="eyebrow"><span class="sq"></span>Shiv Nadar Institute of Eminence</span>
			<h1>Scooby <em>Maps</em></h1>
			<label class="search">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
				<input type="text" placeholder="Search a hostel, block, mess…" autocomplete="off" bind:value={term} onfocus={openSheet} />
			</label>
			<div class="chips">
				{#each types as t}
					<button class="chip" class:active={active === t} onclick={() => { active = t; openSheet(); }}>{t}</button>
				{/each}
			</div>
		</div>
		<div
			class="body"
			style={mobile
				? `max-height:${sheet}px;transition:${dragging ? "none" : "max-height .42s cubic-bezier(.32,.72,0,1)"}`
				: ""}
		>
			<div class="list">
				{#each shown as p (p.name)}
					<div class="item" role="button" tabindex="0" onclick={() => focus(p)} onkeydown={(e) => (e.key === "Enter" || e.key === " ") && focus(p)}>
						<div class="ic" style="background:{col(p)}">{p.icon}</div>
						<div class="m"><h3>{p.name}</h3><div class="t">{p.type}</div></div>
						<svg class="arw" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6" /></svg>
					</div>
				{:else}
					<div class="empty">No spots match your search.</div>
				{/each}
			</div>
			<div class="foot">
				<span>{shown.length} place{shown.length === 1 ? "" : "s"}</span>
				<span>Tap → Google&nbsp;Maps</span>
			</div>
		</div>
	</aside>
</div>

<style>
	.scooby {
		--paper: #efe7d6; --card: #f7f2e7; --ink: #191712; --ink-soft: #6b6353; --accent: #cf3f1e;
		position: fixed;
		inset: 0;
		z-index: 100;
		font-family: "Archivo", system-ui, sans-serif;
		color: var(--ink);
	}
	.map {
		position: absolute;
		inset: 0;
		z-index: 0;
		background: var(--paper);
	}

	/* back to home */
	.back {
		position: absolute;
		z-index: 20;
		top: 22px;
		left: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 9px;
		background: var(--card);
		color: var(--ink);
		border: 2px solid var(--ink);
		border-radius: 3px;
		box-shadow: 4px 4px 0 var(--ink);
		text-decoration: none;
		transition: transform 0.15s, box-shadow 0.15s;
	}
	.back:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 var(--ink); }
	.back:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--ink); }
	.back svg { flex: none; }

	/* ---------- floating list panel ---------- */
	.panel {
		position: absolute;
		z-index: 10;
		top: 78px;
		left: 22px;
		width: 352px;
		max-width: calc(100vw - 44px);
		max-height: calc(100vh - 100px);
		display: flex;
		flex-direction: column;
		background: var(--card);
		border: 2px solid var(--ink);
		border-radius: 6px;
		box-shadow: 8px 8px 0 var(--ink);
		overflow: hidden;
	}
	.grab { display: none; }
	.phead { padding: 22px 22px 16px; border-bottom: 2px solid var(--ink); }
	.eyebrow { display: flex; align-items: center; gap: 8px; font-size: 10.5px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 600; color: var(--ink-soft); }
	.eyebrow .sq { width: 8px; height: 8px; background: var(--accent); border: 1.5px solid var(--ink); }
	.phead h1 { font-family: "Big Shoulders Display", sans-serif; font-weight: 800; font-size: 46px; line-height: 0.9; letter-spacing: 0.01em; text-transform: uppercase; margin: 12px 0 0; }
	.phead h1 em { font-style: normal; color: var(--accent); }
	.search { display: flex; align-items: center; gap: 10px; margin-top: 17px; padding: 11px 14px; border: 1.5px solid var(--ink); border-radius: 3px; background: var(--paper); }
	.search svg { flex: none; stroke: var(--ink); }
	.search input { flex: 1; background: none; border: none; outline: none; color: var(--ink); font-family: inherit; font-size: 14.5px; }
	.search input::placeholder { color: var(--ink-soft); }
	.chips { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 12px; }
	.chip { font-family: inherit; font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink); cursor: pointer; padding: 6px 12px; border-radius: 2px; border: 1.5px solid var(--ink); background: transparent; transition: 0.15s; }
	.chip:hover { background: var(--paper); }
	.chip.active { color: var(--paper); background: var(--ink); }

	.body { display: flex; flex-direction: column; flex: 1; min-height: 0; }
	.list { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; }
	.list::-webkit-scrollbar { width: 10px; }
	.list::-webkit-scrollbar-thumb { background: var(--ink); border: 3px solid var(--card); }
	.item { display: flex; align-items: center; gap: 13px; padding: 11px; border-radius: 3px; cursor: pointer; border: 1.5px solid transparent; transition: 0.12s; }
	.item:hover { border-color: var(--ink); background: var(--paper); }
	.item .ic { flex: none; width: 38px; height: 38px; display: grid; place-items: center; font-size: 18px; border-radius: 50%; border: 2px solid var(--ink); }
	.item .m { min-width: 0; }
	.item h3 { font-family: "Big Shoulders Display", sans-serif; font-weight: 700; font-size: 18px; letter-spacing: 0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }
	.item .t { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 600; color: var(--ink-soft); margin-top: 1px; }
	.item .arw { margin-left: auto; flex: none; transition: 0.15s; }
	.item:hover .arw { transform: translateX(3px); }
	.foot { padding: 10px 14px; border-top: 2px solid var(--ink); font-size: 11px; letter-spacing: 0.03em; color: var(--ink-soft); display: flex; justify-content: space-between; }
	.empty { text-align: center; color: var(--ink-soft); padding: 34px 0; font-size: 14px; }

	@media (max-width: 640px) {
		.panel {
			top: auto; bottom: 0; left: 0; right: 0; width: 100%; max-width: 100%; max-height: none;
			border-radius: 20px 20px 0 0; border-bottom: none; box-shadow: 0 -10px 34px rgba(25, 23, 18, 0.24);
		}
		.grab { display: flex; justify-content: center; padding: 10px 0 4px; touch-action: none; cursor: grab; }
		.grab span { width: 44px; height: 5px; border-radius: 99px; background: var(--ink); opacity: 0.28; }
		.eyebrow { display: none; }
		.phead { padding: 2px 18px 14px; border-bottom: none; }
		.phead h1 { font-size: 34px; margin-top: 2px; }
		.search { margin-top: 12px; }
		.chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; margin-top: 14px; }
		.chips::-webkit-scrollbar { display: none; }
		.chip { flex: none; }
		/* height + easing come from the inline style (live drag / snap) */
		.body { max-height: 0; overflow: hidden; border-top: 2px solid var(--ink); }
		.foot { padding: 9px 16px; }
		:global(.leaflet-control-zoom) { display: none; }
	}

	/* ---- Leaflet runtime-injected DOM (pins, clusters, popups, controls) ---- */
	:global {
		.leaflet-container { background: #efe7d6; font-family: "Archivo", system-ui, sans-serif; }
		.leaflet-control-zoom a { background: #f7f2e7; color: #191712; border: 1.5px solid #191712; font-weight: 700; }
		.leaflet-control-zoom a:first-child { border-radius: 8px 8px 0 0; }
		.leaflet-control-zoom a:last-child { border-radius: 0 0 8px 8px; border-top: none; }
		.leaflet-control-attribution { background: #f7f2e7; color: #6b6353; border: 1px solid #191712; font-size: 10px; }
		.leaflet-control-attribution a { color: #191712; }

		.pin { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-size: 15px; border: 2px solid #191712; box-shadow: 2.5px 2.5px 0 rgba(25, 23, 18, 0.85); transition: transform 0.15s, box-shadow 0.15s; }
		.pin:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 rgba(25, 23, 18, 0.85); }
		.cluster { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: #f7f2e7; border: 2px solid #191712; box-shadow: 2.5px 2.5px 0 rgba(25, 23, 18, 0.85); font-family: "Big Shoulders Display", sans-serif; font-weight: 700; font-size: 16px; color: #191712; }
		.marker-cluster-small, .marker-cluster-medium, .marker-cluster-large { background: none; }

		.leaflet-popup-content-wrapper { background: #f7f2e7; color: #191712; border: 2px solid #191712; border-radius: 4px; box-shadow: 6px 6px 0 #191712; }
		.leaflet-popup-tip { background: #f7f2e7; border: 2px solid #191712; }
		.leaflet-popup-content { margin: 15px 17px; }
		.pop-type { font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; }
		.pop h4 { font-family: "Big Shoulders Display", sans-serif; font-weight: 700; font-size: 24px; margin: 3px 0 5px; line-height: 0.98; letter-spacing: 0.01em; }
		.pop p { color: #6b6353; font-size: 13px; line-height: 1.45; margin-bottom: 13px; }
		.dirbtn { display: inline-flex; align-items: center; gap: 7px; background: #efe7d6; color: #191712; border: 1.5px solid #191712; font-weight: 700; font-size: 12.5px; letter-spacing: 0.02em; text-decoration: none; padding: 8px 14px; border-radius: 2px; text-transform: uppercase; }
		.dirbtn:hover { background: #cf3f1e; color: #efe7d6; }
	}
</style>
