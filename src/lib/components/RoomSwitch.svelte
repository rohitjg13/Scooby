<script lang="ts">
	import { onMount } from "svelte";
	import { env } from "$env/dynamic/public";
	import { HOSTELS, waLink, validateListing, type Listing, type ListingInput } from "$lib/roomSwitch";

	const CLIENT_ID = env.PUBLIC_GOOGLE_CLIENT_ID ?? "";

	let token = $state<string | null>(null);
	let me = $state<{ name: string; email: string } | null>(null);

	// The hostel you're browsing — asked once on first sign-in, changeable any time.
	let hostel = $state<string>("");
	let pickHostel = $state(""); // onboarding dropdown

	let all = $state<Listing[]>([]); // board for `hostel`
	let myListing = $state<Listing | null>(null); // yours, whatever hostel it's in
	let loading = $state(false);
	let error = $state("");

	let floorFilter = $state<string>("");

	// Floor layout images, added per hostel as they come in.
	const HOSTEL_MAPS: Record<string, { label: string; src: string }[]> = {
		"Mudumalai(4C)": [
			{ label: "1st floor", src: "/hostel-maps/mudumalai-1st-floor.jpeg" },
			{ label: "Other floors", src: "/hostel-maps/mudumalai.jpeg" },
		],
	};
	let mapDialog = $state<HTMLDialogElement>();
	let mapIndex = $state(0);

	// post form — hostel comes from the selected hostel, not a field
	let form = $state<Omit<ListingInput, "hostel">>({ roomNo: "", floor: 0, description: "", phone: "" });
	let posting = $state(false);
	let formError = $state("");

	let gisReady = $state(false);
	let buttonEl = $state<HTMLDivElement>();

	const board = $derived(
		all
			.filter((l) => l.email !== me?.email)
			.filter((l) => (floorFilter === "" ? true : l.floor === Number(floorFilter))),
	);
	const floors = $derived(
		[...new Set(all.filter((l) => l.email !== me?.email).map((l) => l.floor))].sort((a, b) => a - b),
	);

	function decodeJwt(t: string): { name: string; email: string } | null {
		try {
			const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
			return { name: p.name ?? p.email, email: p.email };
		} catch {
			return null;
		}
	}

	async function loadListings() {
		if (!token) return;
		loading = true;
		error = "";
		try {
			const qs = hostel ? `?hostel=${encodeURIComponent(hostel)}` : "";
			const res = await fetch(`/api/listings${qs}`, { headers: { authorization: `Bearer ${token}` } });
			if (res.status === 401) {
				signOut();
				error = "Your session expired — sign in again.";
				return;
			}
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to load listings.");
			all = data.listings;
			myListing = data.myListing;
			// Server resolves the hostel from your listing when we didn't send one.
			if (data.hostel && data.hostel !== hostel) setHostelLocal(data.hostel);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	function setHostelLocal(h: string) {
		hostel = h;
		localStorage.setItem("rs_hostel", h);
	}

	function chooseHostel(h: string) {
		if (!h || h === hostel) return;
		setHostelLocal(h);
		floorFilter = "";
		loadListings();
	}

	function handleCredential(response: { credential: string }) {
		token = response.credential;
		me = decodeJwt(token);
		localStorage.setItem("rs_token", token);
		loadListings();
	}

	function signOut() {
		token = null;
		me = null;
		all = [];
		myListing = null;
		hostel = "";
		floorFilter = "";
		localStorage.removeItem("rs_token");
		localStorage.removeItem("rs_hostel");
		(window as any).google?.accounts?.id?.disableAutoSelect?.();
	}

	async function submit() {
		formError = "";
		const payload = { ...form, hostel };
		const err = validateListing(payload);
		if (err) {
			formError = err;
			return;
		}
		posting = true;
		try {
			const res = await fetch("/api/listings", {
				method: "POST",
				headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Could not post listing.");
			await loadListings();
		} catch (e) {
			formError = e instanceof Error ? e.message : String(e);
		} finally {
			posting = false;
		}
	}

	async function takeDown() {
		if (!token) return;
		if (!confirm("Take down your listing?")) return;
		posting = true;
		try {
			await fetch("/api/listings", { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
			await loadListings();
		} finally {
			posting = false;
		}
	}

	onMount(() => {
		hostel = localStorage.getItem("rs_hostel") ?? "";
		const saved = localStorage.getItem("rs_token");
		if (saved) {
			token = saved;
			me = decodeJwt(saved);
			loadListings();
		}
		const s = document.createElement("script");
		s.src = "https://accounts.google.com/gsi/client";
		s.async = true;
		s.onload = () => (gisReady = true);
		document.head.appendChild(s);
	});

	// Render the Google button whenever we're signed out and GIS is ready.
	$effect(() => {
		if (gisReady && !token && buttonEl && CLIENT_ID) {
			const g = (window as any).google;
			g.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredential, hd: "snu.edu.in" });
			g.accounts.id.renderButton(buttonEl, {
				theme: "filled_black",
				size: "large",
				text: "signin_with",
				shape: "pill",
			});
		}
	});
</script>

<main class="rs">
	<header class="rs-head">
		<a href="/" class="back">← Home</a>
		<h1>Room Switch</h1>
		<p class="sub">
			Find someone in your hostel who wants to swap rooms. Browse who's looking, post your own
			room, and sort it out over WhatsApp.
		</p>
	</header>

	{#if !CLIENT_ID}
		<div class="notice">Google sign-in isn't configured yet (missing PUBLIC_GOOGLE_CLIENT_ID).</div>
	{:else if !token}
		<section class="signin">
			<p>Sign in with your <strong>@snu.edu.in</strong> account to browse and post.</p>
			<div bind:this={buttonEl} class="gbtn"></div>
			{#if error}<p class="err">{error}</p>{/if}
		</section>
	{:else}
		<div class="userbar">
			<span class="chip">{me?.name}</span>
			<button class="btn btn-sm" onclick={signOut}>Sign out</button>
		</div>

		{#if loading}
			<section class="panel" aria-busy="true">
				<div class="skel skel-label"></div>
				<div class="skel-row">
					<div class="skel skel-badge"></div>
					<div class="skel skel-badge"></div>
					<div class="skel skel-badge"></div>
				</div>
				<div class="skel skel-line"></div>
				<div class="skel skel-line short"></div>
			</section>
		{:else if !hostel}
			<!-- Onboarding: ask the hostel once, then they can browse without posting -->
			<section class="panel onboard">
				<span class="label">Step 1 of 1</span>
				<h2>Which hostel are you in?</h2>
				<p class="panel-sub">
					We'll show you everyone in that hostel looking to swap. You can change it later.
				</p>
				<div class="onboard-row">
					<select class="input" bind:value={pickHostel}>
						<option value="" disabled>Select your hostel</option>
						{#each HOSTELS as h}<option value={h}>{h}</option>{/each}
					</select>
					<button class="btn btn-primary" disabled={!pickHostel} onclick={() => chooseHostel(pickHostel)}>
						Continue
					</button>
				</div>
				{#if error}<p class="err">{error}</p>{/if}
			</section>
		{:else}
			<!-- One hostel control for the whole page: drives the board and where you post -->
			<div class="hostel-bar">
				<svg
					class="hostel-ico"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M3 21h18" />
					<path d="M5 21V6l7-3 7 3v15" />
					<path d="M9 21v-4h6v4" />
					<path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
				</svg>
				<span class="label">Hostel</span>
				<select
					class="input hostel-sel"
					value={hostel}
					onchange={(e) => chooseHostel(e.currentTarget.value)}
					aria-label="Your hostel"
				>
					{#each HOSTELS as h}<option value={h}>{h}</option>{/each}
				</select>
			</div>

			{#if HOSTEL_MAPS[hostel]}
				<div class="map-row">
					<button type="button" class="btn btn-sm" onclick={() => (mapIndex = 0, mapDialog?.showModal())}>
						View floor layout
					</button>
					<span class="map-credit">Map: @wrongbora</span>
				</div>
				<dialog bind:this={mapDialog} class="map-dialog" onclick={(e) => e.target === mapDialog && mapDialog.close()}>
					{#if HOSTEL_MAPS[hostel].length > 1}
						<div class="map-picker" role="tablist" aria-label="Floor">
							{#each HOSTEL_MAPS[hostel] as m, i}
								<button
									type="button"
									role="tab"
									aria-selected={i === mapIndex}
									class="map-picker-btn"
									class:active={i === mapIndex}
									onclick={() => (mapIndex = i)}
								>
									{m.label}
								</button>
							{/each}
						</div>
					{/if}
					<img src={HOSTEL_MAPS[hostel][mapIndex].src} alt="{hostel} — {HOSTEL_MAPS[hostel][mapIndex].label}" />
					<button type="button" class="btn btn-sm map-close" onclick={() => mapDialog?.close()}>Close</button>
				</dialog>
			{/if}

			<!-- Your listing, or the form to post one -->
			{#if myListing}
				<section class="panel mine-panel">
					<div class="mine-head">
						<span class="label">Your listing</span>
						<button class="btn btn-sm btn-danger" onclick={takeDown} disabled={posting}>
							Take down
						</button>
					</div>
					<div class="tags">
						<span class="badge strong">{myListing.hostel}</span>
						{#if myListing.roomNo}<span class="badge">Room {myListing.roomNo}</span>{/if}
						<span class="badge">Floor {myListing.floor}</span>
					</div>
					<p class="desc">{myListing.description}</p>
				</section>
			{:else}
				<!-- Collapsed by default so the board is what you see first -->
				<details class="panel post-panel">
					<summary class="post-summary">
						<span class="post-summary-text">
							<h2>Post your room</h2>
							<span class="post-summary-sub">Optional — you can just browse.</span>
						</span>
						<svg
							class="chev"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M6 9l6 6 6-6" />
						</svg>
					</summary>
					<form onsubmit={(e) => (e.preventDefault(), submit())} class="post-form">
						<div class="row3">
							<label class="field field-room">
								<span>Room no. <em class="opt">optional</em></span>
								<input class="input" bind:value={form.roomNo} placeholder="528" />
								<span class="hint-inline">
									<svg
										class="hint-ico"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<circle cx="12" cy="12" r="9" />
										<path d="M12 11.5v4.5" />
										<path d="M12 8h.01" />
									</svg>
									Not out yet? Floor alone works.
								</span>
							</label>
							<label class="field">
								<span>Floor</span>
								<input class="input" type="number" min="0" bind:value={form.floor} placeholder="5" required />
							</label>
							<label class="field">
								<span>Phone (WhatsApp)</span>
								<input class="input" type="tel" bind:value={form.phone} placeholder="10-digit mobile" required />
							</label>
						</div>
						<label class="field">
							<span>What room do you want?</span>
							<textarea
								class="input"
								bind:value={form.description}
								rows="2"
								maxlength="300"
								placeholder="Ex: Any room on the 5th floor, or any room near 528"
								required
							></textarea>
						</label>
						{#if formError}<p class="err">{formError}</p>{/if}
						<button class="btn btn-primary submit" type="submit" disabled={posting}>
							{posting ? "Posting…" : "Post listing"}
						</button>
					</form>
				</details>
			{/if}

			<!-- Board -->
			<section class="panel">
				<div class="board-head">
					<h2>Looking to swap</h2>
					<div class="filters">
						<select class="input" bind:value={floorFilter} aria-label="Filter by floor">
							<option value="">All floors</option>
							{#each floors as f}<option value={String(f)}>Floor {f}</option>{/each}
						</select>
					</div>
				</div>

				{#if board.length === 0}
					<p class="muted">
						{floorFilter
							? `No one on floor ${floorFilter} in ${hostel} right now.`
							: `No one else in ${hostel} has posted yet. Check back later.`}
					</p>
				{:else}
					<div class="cards">
						{#each board as l (l.id)}
							<div class="card">
								<div class="card-top">
									{#if l.roomNo}
										<span class="badge strong">Room {l.roomNo}</span>
										<span class="badge">Floor {l.floor}</span>
									{:else}
										<span class="badge strong">Floor {l.floor}</span>
									{/if}
								</div>
								<p class="desc">{l.description}</p>
								<div class="card-meta">— {l.name}</div>
								<div class="card-actions">
									<a class="btn btn-sm btn-primary" href={waLink(l.phone)} target="_blank" rel="noopener">
										WhatsApp
									</a>
									<a class="btn btn-sm" href={`mailto:${l.email}`}>Email</a>
								</div>
							</div>
						{/each}
					</div>
				{/if}
				{#if error}<p class="err">{error}</p>{/if}
			</section>
		{/if}
	{/if}
</main>

<style>
	.rs {
		flex: 1;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: 4rem 1.5rem 3rem;
	}
	.rs-head {
		margin-bottom: 2rem;
	}
	.back {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-secondary);
		text-decoration: none;
	}
	.back:hover {
		color: var(--text);
	}
	.rs-head h1 {
		margin-top: 1rem;
		font-size: clamp(2rem, 7vw, 2.6rem);
		font-weight: 700;
		letter-spacing: -0.03em;
	}
	.sub {
		margin-top: 0.75rem;
		max-width: 52ch;
		color: var(--text-secondary);
		line-height: 1.5;
		font-size: 0.95rem;
	}

	.signin {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		text-align: center;
		padding: 3rem 1.5rem;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--bg-card);
	}
	.gbtn {
		min-height: 44px;
		color-scheme: light;
	}

	.userbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.chip {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.panel {
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--bg-card);
		padding: 1.5rem;
		margin-bottom: 1.25rem;
	}
	.panel h2 {
		font-size: 1.15rem;
		font-weight: 600;
	}
	.panel-sub {
		margin: 0.4rem 0 1.25rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}
	.label {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	/* Onboarding */
	.onboard h2 {
		margin-top: 0.6rem;
	}
	.onboard-row {
		display: flex;
		gap: 0.6rem;
	}
	.onboard-row .input {
		flex: 1;
	}

	/* Your listing */
	.mine-panel {
		background: linear-gradient(180deg, var(--bg-hover), var(--bg-card));
	}
	.mine-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
	}

	/* Hostel bar — the single hostel control for the page */
	.hostel-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-card);
		margin-bottom: 1.25rem;
	}
	.hostel-ico {
		width: 17px;
		height: 17px;
		flex: none;
		color: var(--text-secondary);
	}
	.hostel-bar .label {
		flex: none;
	}
	.hostel-sel {
		flex: 1;
		min-width: 0;
		width: auto;
		padding: 0.3rem 0.4rem;
		font-size: 0.95rem;
		font-weight: 600;
		background: transparent;
		border-color: transparent;
	}

	.map-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1.25rem;
	}
	.map-credit {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.map-picker {
		display: flex;
		gap: 0.3rem;
		padding: 0.25rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-input);
	}
	.map-picker-btn {
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		padding: 0.4rem 0.9rem;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}
	.map-picker-btn.active {
		background: var(--bg-card);
		color: var(--text);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}
	.map-dialog {
		position: fixed;
		inset: 0;
		margin: auto;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--bg-card);
		padding: 1rem;
		width: min(90vw, 640px);
		max-height: 85vh;
	}
	.map-dialog[open] {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}
	.map-dialog::backdrop {
		background: rgba(0, 0, 0, 0.6);
	}
	.map-dialog img {
		display: block;
		max-width: 100%;
		max-height: 70vh;
		width: auto;
		border-radius: 8px;
		object-fit: contain;
	}
	.map-close {
		align-self: center;
	}

	@media (max-width: 640px) {
		.map-dialog {
			width: 92vw;
			max-height: 80vh;
			padding: 0.75rem;
		}
		.map-dialog img {
			max-height: 62vh;
		}
	}
	.hostel-sel:hover {
		border-color: var(--border-hover);
	}

	/* Post form (collapsible) */
	.post-panel {
		padding: 0;
	}
	.post-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem 1.5rem;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}
	.post-summary::-webkit-details-marker {
		display: none;
	}
	.post-summary:hover {
		background: var(--bg-hover);
		border-radius: 14px;
	}
	.post-summary-text {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.post-summary-sub {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}
	.chev {
		width: 18px;
		height: 18px;
		flex: none;
		color: var(--text-secondary);
		transition: transform 0.2s ease;
	}
	.post-panel[open] .chev {
		transform: rotate(180deg);
	}
	.post-panel[open] .post-summary:hover {
		border-radius: 14px 14px 0 0;
	}
	.post-panel .post-form {
		padding: 0 1.5rem 1.5rem;
	}
	.post-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: var(--text-secondary);
		min-width: 0;
	}
	.row3 {
		display: grid;
		grid-template-columns: 1.4fr 0.8fr 1.6fr;
		gap: 0.85rem;
	}
	.opt {
		font-style: normal;
		color: var(--text-muted);
		font-size: 0.68rem;
		padding: 0.05rem 0.3rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		vertical-align: 1px;
	}
	/* Help text sits inside the room field so it stays under it at every width. */
	.hint-inline {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-top: 0.1rem;
		font-size: 0.72rem;
		line-height: 1.3;
		color: var(--text-muted);
	}
	.hint-ico {
		width: 12px;
		height: 12px;
		flex: none;
	}
	textarea.input {
		resize: vertical;
		font-family: inherit;
	}
	.submit {
		margin-top: 0.25rem;
		width: 100%;
		padding: 0.75rem;
	}

	/* Board */
	.board-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}
	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.filters .input {
		width: auto;
		padding: 0.45rem 0.7rem;
		font-size: 0.85rem;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.85rem;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 1.1rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-input);
	}
	.card-top {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.badge.strong {
		background: var(--bg-hover);
		color: var(--text);
	}
	.desc {
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.45;
		word-break: break-word;
	}
	.card-meta {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin-top: auto;
	}
	.card-actions {
		display: flex;
		gap: 0.5rem;
	}
	.card-actions .btn {
		text-decoration: none;
		flex: 1;
	}

	.muted {
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.err {
		color: #ff6b6b;
		font-size: 0.85rem;
	}
	.notice {
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	/* Loading skeleton */
	.skel {
		border-radius: 6px;
		background: linear-gradient(90deg, var(--bg-input) 25%, var(--bg-hover) 37%, var(--bg-input) 63%);
		background-size: 400% 100%;
		animation: skel-pulse 1.4s ease infinite;
	}
	.skel-label {
		width: 90px;
		height: 12px;
		margin-bottom: 1rem;
	}
	.skel-row {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	.skel-badge {
		width: 72px;
		height: 20px;
		border-radius: var(--radius-sm);
	}
	.skel-line {
		height: 12px;
		margin-bottom: 0.6rem;
	}
	.skel-line.short {
		width: 60%;
	}
	@keyframes skel-pulse {
		0% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0 50%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.skel {
			animation: none;
		}
	}

	@media (max-width: 560px) {
		.rs {
			padding: 2.5rem 1rem 2rem;
		}
		.panel {
			padding: 1.25rem;
		}
		/* Room (+ its hint) full width, then Floor | Phone share the next row. */
		.row3 {
			grid-template-columns: 0.8fr 1.6fr;
		}
		.row3 .field-room {
			grid-column: 1 / -1;
		}
		.onboard-row {
			flex-direction: column;
		}
		.filters {
			width: 100%;
		}
		.filters .input {
			flex: 1;
			min-width: 0;
		}
		.cards {
			grid-template-columns: 1fr;
		}
	}
</style>
