// Shared (client + server) types and pure helpers for the Room Switch feature.
// No SvelteKit / env imports here so it stays importable from both the browser
// and a plain `node` self-check (see roomSwitch.check.ts).

export const EMAIL_DOMAIN = "snu.edu.in";

// Hostels shown in the dropdown (duplicates from the source list removed).
export const HOSTELS: string[] = [
	"Dibang",
	"Bandhavgarh",
	"Kaziranga",
	"Sariska (6A)",
	"Satpura (6B)",
	"Tower 6",
	"Manas (4A)",
	"Marine (4B)",
	"Tower 9",
	"Hemis",
	"Mudumalai(4C)",
	"Betla",
];

export type Listing = {
	id: string;
	name: string;
	email: string;
	hostel: string;
	roomNo: string;
	floor: number;
	description: string;
	phone: string; // stored as entered (digits)
	createdAt: number;
};

// Data the client posts; server fills name/email/createdAt from the verified token.
export type ListingInput = {
	hostel: string;
	roomNo: string;
	floor: number;
	description: string;
	phone: string;
};

export function isSnuEmail(email: string): boolean {
	return email.trim().toLowerCase().endsWith("@" + EMAIL_DOMAIN);
}

// Keep only digits; used for storage + validation.
export function normalizePhone(raw: string): string {
	return (raw || "").replace(/\D/g, "");
}

// Indian 10-digit mobile, or already country-coded (11-12 digits).
export function isValidPhone(raw: string): boolean {
	const d = normalizePhone(raw);
	return d.length === 10 || d.length === 11 || d.length === 12;
}

// wa.me needs a country code. Assume +91 for bare 10-digit numbers.
export function waLink(raw: string): string {
	let d = normalizePhone(raw);
	if (d.length === 10) d = "91" + d;
	return "https://wa.me/" + d;
}

// Validate + normalize a listing input. Returns an error string or null.
export function validateListing(input: Partial<ListingInput>): string | null {
	if (!input.hostel || !HOSTELS.includes(input.hostel)) return "Pick a valid hostel.";
	if (input.roomNo && input.roomNo.trim().length > 20) return "Room number too long.";
	const floor = Number(input.floor);
	if (!Number.isInteger(floor) || floor < 0 || floor > 50) return "Enter a valid floor.";
	if (!input.description || !input.description.trim()) return "Add a short preference.";
	if (input.description.trim().length > 300) return "Preference too long (max 300 chars).";
	if (!isValidPhone(input.phone || "")) return "Enter a valid phone number.";
	return null;
}
