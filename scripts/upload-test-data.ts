/**
 * upload-test-data.ts
 *
 * Embeds text documents using gemini-embedding-001 and upserts them into the
 * Qdrant "chatbot_knowledge" collection for testing the RAG pipeline.
 *
 * Usage:
 *   node --env-file=.env scripts/upload-test-data.ts
 *
 * Each entry in TEST_DOCUMENTS becomes one Qdrant point with:
 *   - A deterministic numeric ID  (index in the array)
 *   - A 3072-float vector         (gemini-embedding-001 output)
 *   - A payload { text, source }  (returned by the chatbot in answers)
 */

import { GoogleGenAI } from "@google/genai";
import { QdrantClient } from "@qdrant/js-client-rest";

// ---------------------------------------------------------------------------
// Config — kept in sync with hooks.server.ts and the chat route.
// ---------------------------------------------------------------------------

const COLLECTION_NAME = "chatbot_knowledge";
const EMBEDDING_MODEL = "gemini-embedding-001";
const BATCH_SIZE = 5; // Gemini free-tier: keep batches small to avoid rate limits

// ---------------------------------------------------------------------------
// Test documents — edit or extend this array freely.
// ---------------------------------------------------------------------------

interface Document {
	text: string;
	source: string;
}

const TEST_DOCUMENTS: Document[] = [
	{
		text: "The SNU library is open from 8 AM to 10 PM on weekdays and 9 AM to 6 PM on weekends. Students can borrow up to 5 books at a time for a period of 14 days.",
		source: "SNU Library Policy 2025",
	},
	{
		text: "The Academic Calendar for 2025–26 shows that the mid-semester examinations are scheduled from October 6 to October 11. Students must carry their ID cards to the examination hall.",
		source: "SNU Academic Calendar 2025-26",
	},
	{
		text: "The hostel mess serves breakfast from 7:30 AM to 9:30 AM, lunch from 12:00 PM to 2:00 PM, and dinner from 7:30 PM to 9:30 PM. A late-night snack counter operates from 10:00 PM to 11:00 PM.",
		source: "SNU Hostel Handbook 2025",
	},
	{
		text: "Students wishing to switch hostel rooms must submit a Room Switch Request form to the hostel warden. Requests are processed every Monday. Both parties involved in the switch must consent and sign the form.",
		source: "SNU Hostel Room Switch Policy",
	},
	{
		text: "The SNU health centre is located in Block A, Ground Floor. It is open 24 hours for emergencies. General OPD hours are 9 AM to 1 PM and 2 PM to 5 PM on weekdays.",
		source: "SNU Health Centre Information",
	},
	{
		text: "WiFi on campus is provided under the network name SNU-Student. Students can connect up to 3 devices using their university credentials. For technical issues contact helpdesk@snu.edu.in or visit the IT helpdesk in the Admin Block.",
		source: "SNU IT Services Guide 2025",
	},
	{
		text: "The grading system at SNU uses a 10-point scale. An 'O' grade corresponds to 10 points (90–100%), 'A+' to 9 points (80–89%), 'A' to 8 points (70–79%), 'B+' to 7 points (60–69%), and 'B' to 6 points (50–59%). Grades below 50% are considered failing.",
		source: "SNU Academic Regulations",
	},
	{
		text: "SNU students are eligible for the Merit Scholarship if they maintain a CGPA of 8.5 or above at the end of each academic year. The scholarship covers 25% of the annual tuition fee and is automatically renewed each year subject to maintaining the required CGPA.",
		source: "SNU Scholarships and Financial Aid Brochure 2025",
	},
];

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const apiKey = process.env.GEMINI_API_KEY;
const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;

if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Run with --env-file=.env");
if (!qdrantUrl) throw new Error("QDRANT_URL is not set. Run with --env-file=.env");

const genai = new GoogleGenAI({ apiKey });
const qdrant = new QdrantClient({ url: qdrantUrl, apiKey: qdrantApiKey });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sleep for `ms` milliseconds — used between batches to respect rate limits. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Embed a single text string using gemini-embedding-001. */
async function embed(text: string): Promise<number[]> {
	const response = await genai.models.embedContent({
		model: EMBEDDING_MODEL,
		contents: [text],
	});
	const values = response.embeddings?.[0]?.values;
	if (!values || values.length === 0) {
		throw new Error(`Empty embedding returned for text: "${text.slice(0, 60)}…"`);
	}
	return values;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log(`\n🔍  Checking Qdrant collection "${COLLECTION_NAME}"…`);

	// Verify collection exists (hooks.server.ts creates it on app start, but
	// this script can also be run standalone before the server has been booted).
	const { exists } = await qdrant.collectionExists(COLLECTION_NAME);
	if (!exists) {
		console.log(`   Collection not found — creating it now (3072-dim, Cosine)…`);
		await qdrant.createCollection(COLLECTION_NAME, {
			vectors: { size: 3072, distance: "Cosine" },
		});
		console.log(`   ✅ Collection created.`);
	} else {
		const info = await qdrant.getCollection(COLLECTION_NAME);
		console.log(
			`   ✅ Exists — ${info.points_count ?? 0} point(s) currently stored.`,
		);
	}

	console.log(
		`\n📄  Embedding ${TEST_DOCUMENTS.length} document(s) in batches of ${BATCH_SIZE}…\n`,
	);

	const points: Array<{ id: number; vector: number[]; payload: Document }> = [];

	// Process documents in batches to stay within API rate limits.
	for (let i = 0; i < TEST_DOCUMENTS.length; i += BATCH_SIZE) {
		const batch = TEST_DOCUMENTS.slice(i, i + BATCH_SIZE);

		for (const [j, doc] of batch.entries()) {
			const globalIdx = i + j;
			process.stdout.write(`   [${globalIdx + 1}/${TEST_DOCUMENTS.length}] Embedding "${doc.source}" … `);

			const vector = await embed(doc.text);
			points.push({ id: globalIdx, vector, payload: doc });

			console.log(`✅  (${vector.length} dims)`);
		}

		// Pause between batches — adjust if you hit 429s.
		if (i + BATCH_SIZE < TEST_DOCUMENTS.length) {
			process.stdout.write(`\n   ⏳ Waiting 1 s before next batch…\n\n`);
			await sleep(1000);
		}
	}

	// Upsert all points in one Qdrant request.
	console.log(`\n⬆️   Upserting ${points.length} point(s) into Qdrant…`);
	const result = await qdrant.upsert(COLLECTION_NAME, {
		wait: true, // Block until Qdrant confirms the write is complete.
		points,
	});

	console.log(`   ✅ Upsert status: ${result.status}`);

	// Quick sanity-check: retrieve the first point back.
	console.log(`\n🔎  Sanity check — fetching point 0 back from Qdrant…`);
	const retrieved = await qdrant.retrieve(COLLECTION_NAME, {
		ids: [0],
		with_payload: true,
	});

	if (retrieved.length > 0) {
		const p = retrieved[0];
		const payload = p.payload as Document;
		console.log(`   ✅ Retrieved point id=${p.id}`);
		console.log(`      source : ${payload.source}`);
		console.log(`      text   : ${payload.text.slice(0, 80)}…`);
	} else {
		console.warn("   ⚠️  Point 0 not found — upsert may not have committed yet.");
	}

	console.log(`\n🎉  Done! ${points.length} document(s) are ready for RAG queries.\n`);
}

main().catch((err) => {
	console.error("\n❌  Script failed:", err);
	process.exit(1);
});
