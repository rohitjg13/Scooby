// Checks the committed ttchanges.json the /changes page renders — it is baked
// from files outside the repo, so nothing else can catch a bad regeneration.
//   node scripts/ttChanges.check.ts
import { readFileSync } from "node:fs";
import assert from "node:assert";

const d = JSON.parse(readFileSync("src/lib/data/ttchanges.json", "utf8"));

assert.ok(d.versions.length >= 2, "at least two versions");
assert.equal(d.pairs.length, d.versions.length - 1, "one pair per consecutive versions");
assert.ok(d.versions.at(-1).current, "the newest version is the current one");

for (const [i, p] of d.pairs.entries()) {
	const where = `${p.from} → ${p.to}`;
	assert.equal(p.from, d.versions[i].title, `${where}: pairs follow the version order`);
	assert.equal(p.to, d.versions[i + 1].title, `${where}: pairs follow the version order`);

	for (const k of ["added", "removed", "changed"]) {
		const n = p.changes.filter((c: { kind: string }) => c.kind === k).length;
		assert.equal(p[k], n, `${where}: ${k} count says ${p[k]}, rows say ${n}`);
	}

	// row counts have to move by the net of the rows gained and lost
	assert.equal(p.newCount - p.oldCount, p.added - p.removed, `${where}: class row total`);

	const fields = new Map<string, number>();
	for (const c of p.changes) {
		assert.ok(c.code && c.at, `${where}: every row names a class`);
		assert.equal(c.deltas.length > 0, c.kind === "changed",
			`${where}: ${c.code} — only changed rows carry field deltas`);
		for (const [label, before, after] of c.deltas) {
			assert.notEqual(before, after, `${where}: ${c.code} ${label} — a delta that changes nothing`);
			fields.set(label, (fields.get(label) ?? 0) + 1);
		}
	}
	assert.deepEqual(Object.fromEntries(p.fields), Object.fromEntries(fields),
		`${where}: field tally matches the deltas`);
}

console.log(`ok — ${d.versions.length} versions, ${d.pairs.reduce((n: number, p: { changes: unknown[] }) => n + p.changes.length, 0)} changes`);
