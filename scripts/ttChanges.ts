// Bakes the timetable version history into src/lib/data/ttchanges.json so the
// /changes page needs nothing but the repo at runtime. The dumps and the diff
// itself live outside the project, in ../dump — this is the only thing that
// reaches over there.
//   node scripts/ttChanges.ts
import { writeFileSync } from "node:fs";
import { compare, versions } from "../../dump/ttdiff.ts";
import type { Course } from "../src/lib/types.ts";

const OUT = "src/lib/data/ttchanges.json";

/** "01-20260801-1700.xlsx" -> { n: "1", stamp: "2026-08-01 5:00 PM" } */
function label(file: string, i: number) {
	const current = /current/i.test(file);
	const m = file.match(/^(\d+)[-_]?(\d{4})(\d\d)(\d\d)[-_]?(\d\d)?(\d\d)?/);
	if (!m) return { title: `V${i + 1}`, stamp: file, current };
	const [, n, y, mo, d, hh, mm] = m;
	let stamp = `${y}-${mo}-${d}`;
	if (hh) stamp += ` ${+hh % 12 || 12}:${mm} ${+hh < 12 ? "AM" : "PM"}`;
	return { title: current ? "CURRENT" : `V${n || i + 1}`, stamp, current };
}

// Enough of a row to identify the class on screen; the whole Course would
// quadruple the file for fields nobody reads there.
const when = (c: Course) =>
	[c.day, c.startTime && `${c.startTime} – ${c.endTime}`, c.room].filter(Boolean).join("  ") || c.slot;
const detail = (c: Course) =>
	[when(c), c.faculty, c.major && `[${c.major}]`].filter(Boolean).join("  ·  ");

const files = versions();
if (files.length < 2) throw new Error("need at least 2 versions in ../dump/timetables");

const list = files.map((f, i) => ({
	file: f,
	format: /\.xlsx?$/i.test(f) ? "Excel" : "JSON",
	...label(f, i),
}));

const pairs = files.slice(0, -1).map((f, i) => {
	const r = compare(f, files[i + 1]);
	// which fields moved, commonest first — the shape of a revision at a glance
	const tally = new Map<string, number>();
	for (const ch of r.changes) for (const d of ch.deltas) tally.set(d.label, (tally.get(d.label) ?? 0) + 1);

	return {
		from: list[i].title,
		to: list[i + 1].title,
		crossFormat: r.crossFormat,
		oldCount: r.oldCount,
		newCount: r.newCount,
		added: r.added,
		removed: r.removed,
		changed: r.changed,
		newCourses: r.newCourses,
		goneCourses: r.goneCourses,
		fields: [...tally].sort((a, b) => b[1] - a[1]),
		changes: r.changes.map((ch) => ({
			kind: ch.kind,
			code: ch.code,
			name: ch.name,
			at: detail((ch.old ?? ch.new)!),
			deltas: ch.deltas.map((d) => [d.label, d.before, d.after]),
		})),
	};
});

writeFileSync(OUT, JSON.stringify({ versions: list, pairs }));
console.log(`${OUT}  ${list.length} versions, ${pairs.reduce((n, p) => n + p.changes.length, 0)} changes`);
