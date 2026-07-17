// Runnable self-check for the pure Room Switch helpers. No framework.
//   node scripts/roomSwitch.check.ts
import assert from "node:assert";
import {
	isSnuEmail,
	normalizePhone,
	isValidPhone,
	waLink,
	validateListing,
} from "../src/lib/roomSwitch.ts";

// domain gate
assert.equal(isSnuEmail("a@snu.edu.in"), true);
assert.equal(isSnuEmail("A@SNU.EDU.IN"), true);
assert.equal(isSnuEmail("a@gmail.com"), false);
assert.equal(isSnuEmail("a@snu.edu.in.evil.com"), false);

// phone
assert.equal(normalizePhone("+91 98765-43210"), "919876543210");
assert.equal(isValidPhone("9876543210"), true); // 10
assert.equal(isValidPhone("123"), false);
assert.equal(waLink("9876543210"), "https://wa.me/919876543210"); // 91 prefixed
assert.equal(waLink("+91 98765 43210"), "https://wa.me/919876543210"); // not double-prefixed

// listing validation
const ok = { hostel: "Kaziranga", roomNo: "521", floor: 5, description: "near 521", phone: "9876543210" };
assert.equal(validateListing(ok), null);
assert.equal(validateListing({ ...ok, hostel: "Nope" }) !== null, true);
assert.equal(validateListing({ ...ok, roomNo: "" }), null); // room no. is optional
assert.equal(validateListing({ ...ok, roomNo: "x".repeat(21) }) !== null, true);
assert.equal(validateListing({ ...ok, phone: "12" }) !== null, true);
assert.equal(validateListing({ ...ok, description: "x".repeat(301) }) !== null, true);

console.log("roomSwitch.check.ts: all assertions passed");
