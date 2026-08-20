// Generates social-share (Open Graph) images for each page.
//
// Renders a branded 1200x630 card per page as SVG, then rasterises to PNG with
// rsvg-convert (brew install librsvg). Social platforms (Instagram, WhatsApp,
// X, Facebook) don't render SVG og:image, so PNGs are required.
//
// Output: static/og/<slug>.png
// Re-run:  npm run gen:og

import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "static/og");

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

const ICONS = {
	grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
	clubs: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.5"/><path d="M17 14.2a5.5 5.5 0 0 1 3.5 4.8"/>',
	calendar:
		'<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18"/><path d="M8 2.5v4M16 2.5v4"/>',
	exam: '<path d="M6 4a1 1 0 0 1 1-1h6l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4z"/><path d="M13 3v5h5"/><path d="M9 13l1.75 1.75L14 11.5"/>',
	switch: '<path d="M4 8h13M13 4l4 4-4 4"/><path d="M20 16H7M11 20l-4-4 4-4"/>',
	map: '<path d="M12 21s-6.5-5.2-6.5-10a6.5 6.5 0 0 1 13 0c0 4.8-6.5 10-6.5 10z"/><circle cx="12" cy="11" r="2.5"/>',
	// revision history: a clock with a rewind arrow
	changes: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 3.5V9h5.5"/><path d="M12 7.5V12l3 2"/>',
	minors: '<path d="M12 3.5 22 8.5l-10 5-10-5 10-5z"/><path d="M6 11v5.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V11"/>',
	// gpa: a gradesheet with rows of marks
	gpa: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h2M12 11h2"/><path d="M8 15h2M12 15h2"/><path d="M8 18h2M12 18h2"/>',
	// attendance: a clock face with a tick
	attendance: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
	// form: a sheet with lines and a pencil
	form: '<path d="M5 3.5h9l5 5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5v5h5"/><path d="M7.5 12.5h6M7.5 16.5h4"/>',
};

const PAGES = [
	{ slug: "default", title: "Scooby", subtitle: "Your one-stop university app", icon: "grid" },
	{ slug: "clubs", title: "Club Info", subtitle: "Every cultural & technical club on campus", icon: "clubs" },
	{ slug: "collision-checker", title: "Timetable Planner", subtitle: "Plan your week and spot clashes instantly", icon: "calendar" },
	{ slug: "exam", title: "Exam Timetable", subtitle: "Mid-sem & end-sem exam schedules", icon: "exam" },
	{ slug: "room-switch", title: "Room Switch", subtitle: "Find someone in your hostel to swap rooms with", icon: "switch" },
	{ slug: "maps", title: "Campus Map", subtitle: "Every hostel, block & mess, with directions", icon: "map" },
	{ slug: "changes", title: "Timetable Changes", subtitle: "Every timetable revision, version by version", icon: "changes" },
	{ slug: "fill", title: "Please fill this form", subtitle: "It only takes a minute", icon: "form" },
	{ slug: "gpa", title: "GPA Calculator", subtitle: "Work out your SGPA & CGPA, semester by semester", icon: "gpa" },
	{ slug: "attendance-calculator", title: "Attendance Calculator", subtitle: "How far behind you are, and how much you can skip", icon: "attendance" },
	{ slug: "minors", title: "Minors", subtitle: "Every minor on offer, with courses & credits", icon: "minors" },
];

const esc = (s) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildSvg({ title, subtitle, icon }) {
	// ponytail: rough width fit — shrink long titles so they clear the icon box.
	const titleSize = Math.min(98, Math.round(830 / (title.length * 0.55)) * 1);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#08080a"/>
  <rect x="32" y="32" width="1136" height="566" rx="28" fill="none" stroke="#26262c" stroke-width="2"/>

  <text x="96" y="134" font-family="${FONT}" font-size="26" letter-spacing="8" font-weight="600" fill="#a1a1aa">SCOOBY</text>

  <rect x="958" y="82" width="122" height="122" rx="26" fill="#0c0c10" stroke="#3a3a43" stroke-width="2"/>
  <g transform="translate(987,111) scale(2.667)" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    ${ICONS[icon]}
  </g>

  <text x="92" y="362" font-family="${FONT}" font-size="${titleSize}" font-weight="700" letter-spacing="-3" fill="#f5f5f7">${esc(title)}</text>
  <text x="96" y="432" font-family="${FONT}" font-size="40" fill="#a1a1aa">${esc(subtitle)}</text>
  <text x="96" y="550" font-family="${FONT}" font-size="26" fill="#71717a">scooby &#183; one-stop university app</text>
</svg>`;
}

function main() {
	if (!hasRsvg()) {
		console.error(
			"rsvg-convert not found. Install it with:  brew install librsvg",
		);
		process.exit(1);
	}
	fs.mkdirSync(OUT, { recursive: true });
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "og-"));

	for (const page of PAGES) {
		const svgPath = path.join(tmp, `${page.slug}.svg`);
		const pngPath = path.join(OUT, `${page.slug}.png`);
		fs.writeFileSync(svgPath, buildSvg(page));
		execSync(`rsvg-convert "${svgPath}" -o "${pngPath}"`);
		console.log(`${page.slug}.png`);
	}

	fs.rmSync(tmp, { recursive: true, force: true });

	// Cache-buster. Social scrapers key their cache on the full URL, so a card
	// whose filename never changes stays stale on WhatsApp/X/Facebook forever.
	// Hash the rendered PNGs; the query only changes when a card actually does.
	const hash = crypto.createHash("sha256");
	for (const page of PAGES) hash.update(fs.readFileSync(path.join(OUT, `${page.slug}.png`)));
	const version = hash.digest("hex").slice(0, 8);
	fs.writeFileSync(
		path.join(ROOT, "src/lib/ogVersion.ts"),
		`// Generated by scripts/generate-og.mjs. Do not edit.\nexport const OG_VERSION = "${version}";\n`,
	);

	console.log(`\nWrote ${PAGES.length} OG images -> ${path.relative(ROOT, OUT)} (v${version})`);
}

function hasRsvg() {
	try {
		execSync("command -v rsvg-convert", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

main();
