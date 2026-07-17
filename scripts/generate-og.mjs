// Generates social-share (Open Graph) images for each page.
//
// Renders a branded 1200x630 card per page as SVG, then rasterises to PNG with
// rsvg-convert (brew install librsvg). Social platforms (Instagram, WhatsApp,
// X, Facebook) don't render SVG og:image, so PNGs are required.
//
// Output: static/og/<slug>.png
// Re-run:  npm run gen:og

import { execSync } from "node:child_process";
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
};

const PAGES = [
	{ slug: "default", title: "Scooby", subtitle: "Your one-stop university app", icon: "grid" },
	{ slug: "clubs", title: "Club Info", subtitle: "Every cultural & technical club on campus", icon: "clubs" },
	{ slug: "collision-checker", title: "Clash Checker", subtitle: "Spot UWE / CCC timetable clashes instantly", icon: "calendar" },
	{ slug: "exam", title: "Exam Timetable", subtitle: "Mid-sem & end-sem exam schedules", icon: "exam" },
	{ slug: "room-switch", title: "Room Switch", subtitle: "Find someone in your hostel to swap rooms with", icon: "switch" },
];

const esc = (s) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildSvg({ title, subtitle, icon }) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="50%" cy="10%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.10"/>
      <stop offset="70%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#000000"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="32" y="32" width="1136" height="566" rx="28" fill="none" stroke="#232323" stroke-width="2"/>

  <text x="96" y="134" font-family="${FONT}" font-size="26" letter-spacing="8" font-weight="600" fill="#8a8a8a">SCOOBY</text>

  <rect x="958" y="82" width="122" height="122" rx="26" fill="#0b0b0b" stroke="#333333" stroke-width="2"/>
  <g transform="translate(987,111) scale(2.667)" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    ${ICONS[icon]}
  </g>

  <text x="92" y="362" font-family="${FONT}" font-size="98" font-weight="700" letter-spacing="-3" fill="#ffffff">${esc(title)}</text>
  <text x="96" y="432" font-family="${FONT}" font-size="40" fill="#a6a6a6">${esc(subtitle)}</text>
  <text x="96" y="550" font-family="${FONT}" font-size="26" fill="#5f5f5f">scooby &#183; one-stop university app</text>
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
	console.log(`\nWrote ${PAGES.length} OG images -> ${path.relative(ROOT, OUT)}`);
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
