import { ensureCollection } from "$lib/server/qdrant";
import type { Handle } from "@sveltejs/kit";

// ---------------------------------------------------------------------------
// Collection config — edit these if your embedding model changes.
// ---------------------------------------------------------------------------
const COLLECTION_NAME = "chatbot_knowledge";
/**
 * Vector size MUST match the output dimension of your embedding model.
 * 1536 → OpenAI text-embedding-ada-002 / text-embedding-3-small
 * 768  → most open-source models (e.g. nomic-embed-text, mxbai-embed-large)
 */
const VECTOR_SIZE = 1536;

// ---------------------------------------------------------------------------
// One-time startup: ensure the Qdrant collection exists before any request
// is served. ensureCollection() is idempotent — it's a no-op when the
// collection is already present.
// ---------------------------------------------------------------------------
try {
	const created = await ensureCollection(COLLECTION_NAME, {
		vectorSize: VECTOR_SIZE,
		distance: "Cosine",
	});

	if (created) {
		console.log(`[qdrant] Collection "${COLLECTION_NAME}" created (${VECTOR_SIZE}-dim, Cosine).`);
	} else {
		console.log(`[qdrant] Collection "${COLLECTION_NAME}" already exists — skipping creation.`);
	}
} catch (err) {
	// Log but don't crash the server — the app can still serve non-RAG routes.
	console.error("[qdrant] Failed to initialise collection:", err);
}

// ---------------------------------------------------------------------------
// SvelteKit handle hook — pass-through (add middleware here when needed).
// ---------------------------------------------------------------------------
export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
