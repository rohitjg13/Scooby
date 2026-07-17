import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listings, verifyGoogle } from "$lib/server/roomSwitch";
import { validateListing, type Listing } from "$lib/roomSwitch";

// Token comes in the Authorization header: "Bearer <google-id-token>".
function bearer(request: Request): string {
	return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
}

function toListing(doc: any): Listing {
	const { _id, ...rest } = doc;
	return { id: String(_id), ...rest } as Listing;
}

// GET /api/listings — the board for YOUR hostel only. You see listings from the
// hostel of your own active listing; no listing → empty board (post one first).
export const GET: RequestHandler = async ({ request }) => {
	const user = await verifyGoogle(bearer(request));
	if (!user) return json({ error: "Sign in with your SNU account." }, { status: 401 });
	const col = await listings();
	const mine = await col.findOne({ email: user.email });
	if (!mine) return json({ listings: [], me: user.email, myHostel: null });
	const docs = await col.find({ hostel: mine.hostel }).sort({ createdAt: -1 }).toArray();
	return json({ listings: docs.map(toListing), me: user.email, myHostel: mine.hostel });
};

// POST /api/listings  — create/replace my listing
export const POST: RequestHandler = async ({ request }) => {
	const user = await verifyGoogle(bearer(request));
	if (!user) return json({ error: "Sign in with your SNU account." }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const err = validateListing(body);
	if (err) return json({ error: err }, { status: 400 });

	const col = await listings();
	const doc = {
		name: user.name,
		email: user.email,
		hostel: body.hostel,
		roomNo: String(body.roomNo || "").trim(),
		floor: Number(body.floor),
		description: String(body.description).trim(),
		phone: String(body.phone).replace(/\D/g, ""),
		createdAt: Date.now(),
	};
	await col.replaceOne({ email: user.email }, doc, { upsert: true });
	return json({ ok: true });
};

// DELETE /api/listings  — take down my own listing
export const DELETE: RequestHandler = async ({ request }) => {
	const user = await verifyGoogle(bearer(request));
	if (!user) return json({ error: "Sign in with your SNU account." }, { status: 401 });
	const col = await listings();
	await col.deleteOne({ email: user.email });
	return json({ ok: true });
};
