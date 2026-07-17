<script lang="ts">
	import { onMount } from "svelte";
	import { env } from "$env/dynamic/public";
	import {
		HOSTELS,
		waLink,
		validateListing,
		type Listing,
		type ListingInput,
	} from "$lib/roomSwitch";

	const CLIENT_ID = env.PUBLIC_GOOGLE_CLIENT_ID ?? "";

	let token = $state<string | null>(null);
	let me = $state<{ name: string; email: string } | null>(null);

	// Server returns only the board for the signed-in user's own hostel.
	let all = $state<Listing[]>([]);
	let loading = $state(false);
	let error = $state("");

	let floorFilter = $state<string>("");

	// post form
	let form = $state<ListingInput>({ hostel: "", roomNo: "", floor: 0, description: "", phone: "" });
	let posting = $state(false);
	let formError = $state("");

	let gisReady = $state(false);
	let buttonEl = $state<HTMLDivElement>();

	const myListing = $derived(all.find((l) => l.email === me?.email) ?? null);
	const boardHostel = $derived(myListing?.hostel ?? "");
	const board = $derived(
		all.filter((l) => (floorFilter === "" ? true : l.floor === Number(floorFilter))),
	);
	const floors = $derived([...new Set(all.map((l) => l.floor))].sort((a, b) => a - b));

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
			const res = await fetch("/api/listings", { headers: { authorization: `Bearer ${token}` } });
			if (res.status === 401) {
				signOut();
				error = "Your session expired — sign in again.";
				return;
			}
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to load listings.");
			all = data.listings;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
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
		floorFilter = "";
		localStorage.removeItem("rs_token");
		(window as any).google?.accounts?.id?.disableAutoSelect?.();
	}

	async function submit() {
		formError = "";
		const err = validateListing(form);
		if (err) {
			formError = err;
			return;
		}
		posting = true;
		try {
			const res = await fetch("/api/listings", {
				method: "POST",
				headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
				body: JSON.stringify(form),
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
		if (!confirm("Take down your listing? You can post again with a different hostel.")) return;
		posting = true;
		try {
			await fetch("/api/listings", { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
			floorFilter = "";
			await loadListings();
		} finally {
			posting = false;
		}
	}

	onMount(() => {
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
			Find someone in your hostel who wants to swap rooms. Post your room, browse others in the
			same hostel, and sort it out over WhatsApp.
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
			<!-- Fetching your listing / board -->
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
		{:else if myListing}
			<!-- Your active listing -->
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
				<p class="hint">To browse a different hostel, take this down and post again.</p>
			</section>

			<!-- Board (locked to your hostel) -->
			<section class="panel">
				<div class="board-head">
					<h2>Swaps in {boardHostel}</h2>
					<select class="input floor-sel" bind:value={floorFilter} aria-label="Filter by floor">
						<option value="">All floors</option>
						{#each floors as f}<option value={String(f)}>Floor {f}</option>{/each}
					</select>
				</div>

				{#if board.filter((l) => l.email !== me?.email).length === 0}
					<p class="muted">No one else in {boardHostel} has posted yet. Check back later.</p>
				{:else}
					<div class="cards">
						{#each board as l (l.id)}
							{#if l.email !== me?.email}
								<div class="card">
									<div class="card-top">
										{#if l.roomNo}<span class="badge strong">Room {l.roomNo}</span>{/if}
										<span class="badge">Floor {l.floor}</span>
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
							{/if}
						{/each}
					</div>
				{/if}
				{#if error}<p class="err">{error}</p>{/if}
			</section>
		{:else}
			<!-- No listing yet → post one to unlock the board -->
			<section class="panel">
				<h2>Post your room</h2>
				<p class="panel-sub">Post your room to see everyone else in your hostel looking to swap.</p>
				<form onsubmit={(e) => (e.preventDefault(), submit())} class="post-form">
					<label class="field">
						<span>Hostel</span>
						<select class="input" bind:value={form.hostel} required>
							<option value="" disabled>Select your hostel</option>
							{#each HOSTELS as h}<option value={h}>{h}</option>{/each}
						</select>
					</label>
					<div class="row3">
						<label class="field">
							<span>Room no.</span>
							<input class="input" bind:value={form.roomNo} placeholder="521" />
							<span class="field-hint">
								Since room no. isn't released yet, you can leave this empty and opt for floor
								alone.
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
							placeholder="Any room on the 5th floor, or any room near 521"
							required
						></textarea>
					</label>
					{#if formError}<p class="err">{formError}</p>{/if}
					<button class="btn btn-primary submit" type="submit" disabled={posting}>
						{posting ? "Posting…" : "Post listing"}
					</button>
				</form>
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
	.label {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
	}
	.hint {
		margin-top: 0.75rem;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	/* Post form */
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
	.field-hint {
		font-size: 0.72rem;
		color: var(--text-muted);
		line-height: 1.35;
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
	.floor-sel {
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

	/* Loading skeleton for the your-listing / board fetch */
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

	@media (max-width: 560px) {
		.rs {
			padding: 2.5rem 1rem 2rem;
		}
		.panel {
			padding: 1.25rem;
		}
		.row3 {
			grid-template-columns: 1fr 1fr;
		}
		.row3 .field:last-child {
			grid-column: 1 / -1;
		}
		.cards {
			grid-template-columns: 1fr;
		}
	}
</style>
