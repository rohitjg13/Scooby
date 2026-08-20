// Runnable self-check for the GPA maths. No framework.
//   node scripts/gpa.check.ts
import assert from "node:assert";
import { computeSGPA, computeCGPA, cgpaFromSgpa } from "../src/lib/gpa/calculator.ts";
import { GRADE_POINTS } from "../src/lib/gpa/grades.ts";
import type { SemesterEntry } from "../src/lib/gpa/types.ts";

let n = 0;
const sem = (...courses: [string, number, string][]): SemesterEntry => ({
	id: `s${n++}`,
	label: "Sem",
	courses: courses.map(([name, credits, grade], i) => ({ id: `c${n}-${i}`, name, credits, grade }))
});

// --- the two scales are the two curricula --------------------------------
assert.equal(GRADE_POINTS.post2025.O, 10); // new: O … D
assert.equal(GRADE_POINTS.pre2025.A, 10); // old: A … D
assert.equal(GRADE_POINTS.post2025.A, 8); // same letter, different meaning
assert.equal(GRADE_POINTS.pre2025["A-"], 9);
assert.equal(GRADE_POINTS.post2025["A-"], undefined); // A- only exists pre-2025
assert.equal(GRADE_POINTS.pre2025.O, undefined); // O only exists post-2025

// --- SGPA ----------------------------------------------------------------
// new scale: (4×10 + 3×8) / 7
const s1 = computeSGPA(sem(["Maths", 4, "O"], ["Physics", 3, "A"]), "post2025");
assert.equal(s1.status, "ok");
assert.equal(s1.status === "ok" && s1.value, 64 / 7);
assert.equal(s1.status === "ok" && s1.credits, 7);

// old scale, same letters, different points: (4×10 + 3×10) / 7
const s2 = computeSGPA(sem(["Maths", 4, "A"], ["Physics", 3, "A"]), "pre2025");
assert.equal(s2.status === "ok" && s2.value, 10);

// an F is a real zero — it drags the average, it isn't skipped
const s3 = computeSGPA(sem(["A", 4, "O"], ["B", 4, "F"]), "post2025");
assert.equal(s3.status === "ok" && s3.value, 5);

// blank rows are ignored, not counted as zeros
assert.deepEqual(
	computeSGPA(sem(["Maths", 4, "O"], ["", 4, "F"]), "post2025"),
	computeSGPA(sem(["Maths", 4, "O"]), "post2025")
);

// operational grades leave the formula entirely (not a zero)
const s4 = computeSGPA(sem(["Lab", 2, "S"], ["Maths", 4, "O"]), "post2025");
assert.equal(s4.status === "ok" && s4.value, 10);
assert.equal(s4.status === "ok" && s4.credits, 4); // the S credits aren't weighted

// a W withdraws the whole semester; an I or Z parks it until it resolves
assert.equal(computeSGPA(sem(["Maths", 4, "O"], ["X", 4, "W"]), "post2025").status, "excluded");
assert.equal(computeSGPA(sem(["Maths", 4, "O"], ["X", 4, "I"]), "post2025").status, "pending");
assert.equal(computeSGPA(sem(["Maths", 4, "O"], ["X", 4, "Z"]), "post2025").status, "pending");
assert.equal(computeSGPA(sem(), "post2025").status, "empty");
// nothing but operational grades → no denominator
assert.equal(computeSGPA(sem(["Lab", 2, "S"]), "post2025").status, "empty");

// --- CGPA ----------------------------------------------------------------
const c = computeCGPA(
	[sem(["Maths", 4, "O"], ["Physics", 4, "B"]), sem(["Chem", 2, "D"], ["Seminar", 2, "S"])],
	"post2025"
);
// (4×10 + 4×6 + 2×4) / 10
assert.equal(c.cgpa, 7.2);
assert.equal(c.percentage, 72);
assert.equal(c.totalCreditsRegistered, 10); // S is not registered credit for GPA
assert.equal(c.totalCreditsEarned, 12); // D passes, and S still earns its 2

// F earns no credit but stays in the denominator
const failed = computeCGPA([sem(["Maths", 4, "O"], ["Physics", 4, "F"])], "post2025");
assert.equal(failed.cgpa, 5);
assert.equal(failed.totalCreditsRegistered, 8);
assert.equal(failed.totalCreditsEarned, 4);

// AF earns nothing at all; AP and TR earn credit without points
const audit = computeCGPA([sem(["Audit", 3, "AF"], ["Xfer", 3, "TR"], ["Maths", 4, "O"])], "post2025");
assert.equal(audit.cgpa, 10);
assert.equal(audit.totalCreditsEarned, 7);

// no courses at all → 0, not NaN
assert.equal(computeCGPA([], "post2025").cgpa, 0);

// --- CGPA straight from SGPAs -------------------------------------------
const term = (sgpa: number, credits: number) => ({ id: `t${n++}`, label: "", sgpa, credits });

// credit-weighted, not a plain average: 20 credits at 8 beats 10 at 9
const mixed = cgpaFromSgpa([term(8, 20), term(9, 10)]);
assert.equal(mixed.cgpa, 8.33);
assert.equal(mixed.percentage, 83.33); // percentage is CGPA×10, both rounded to 2dp
assert.equal(mixed.totalCreditsRegistered, 30);

// equal credits → plain average
assert.equal(cgpaFromSgpa([term(8, 20), term(9, 20)]).cgpa, 8.5);

// zero-credit rows drop out instead of poisoning the mean
assert.deepEqual(cgpaFromSgpa([term(8, 20), term(0, 0)]), cgpaFromSgpa([term(8, 20)]));
assert.equal(cgpaFromSgpa([]).cgpa, 0);
assert.equal(cgpaFromSgpa([term(9, 0)]).cgpa, 0);

// the two paths agree: one semester of courses vs its SGPA + credits
const only = sem(["Maths", 4, "O"], ["Physics", 4, "B"]);
const viaCourses = computeCGPA([only], "post2025");
const s = computeSGPA(only, "post2025");
assert.equal(s.status, "ok");
if (s.status === "ok")
	assert.equal(cgpaFromSgpa([term(s.value, s.credits)]).cgpa, viaCourses.cgpa);

console.log("gpa.check.ts OK");
