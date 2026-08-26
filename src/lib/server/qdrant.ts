// Server-only: Qdrant vector-database client, collection helpers, and search.
import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "$env/dynamic/private";

// ---------------------------------------------------------------------------
// Singleton client (reused across serverless invocations)
// ---------------------------------------------------------------------------
let _client: QdrantClient | null = null;

function getClient(): QdrantClient {
	if (_client) return _client;
	if (!env.QDRANT_URL) throw new Error("QDRANT_URL is not set");
	if (!env.QDRANT_API_KEY) throw new Error("QDRANT_API_KEY is not set");

	_client = new QdrantClient({
		url: env.QDRANT_URL,
		apiKey: env.QDRANT_API_KEY,
	});

	return _client;
}

// ---------------------------------------------------------------------------
// Collection helpers
// ---------------------------------------------------------------------------

/**
 * Options for creating a new collection when it does not yet exist.
 */
export interface EnsureCollectionOptions {
	/** Dimensionality of the dense vectors stored in this collection. */
	vectorSize: number;
	/**
	 * Distance metric used for similarity comparisons.
	 * @default "Cosine"
	 */
	distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

/**
 * Ensures a Qdrant collection exists. If the collection is already present
 * this is a no-op; otherwise the collection is created with the supplied options.
 *
 * @returns `true` when a new collection was created, `false` when it already existed.
 */
export async function ensureCollection(
	collectionName: string,
	options: EnsureCollectionOptions,
): Promise<boolean> {
	const client = getClient();
	const { vectorSize, distance = "Cosine" } = options;

	const { exists } = await client.collectionExists(collectionName);
	if (exists) return false;

	await client.createCollection(collectionName, {
		vectors: {
			size: vectorSize,
			distance,
		},
	});

	return true;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * A single result returned by {@link searchCollection}.
 */
export interface SearchResult<T extends Record<string, unknown> = Record<string, unknown>> {
	/** Qdrant point ID. */
	id: string | number;
	/** Similarity score (higher = more similar for Cosine/Dot; lower for Euclid). */
	score: number;
	/** Payload stored alongside the vector, cast to `T`. */
	payload: T;
}

/**
 * Options for a vector similarity search.
 */
export interface SearchOptions {
	/** Maximum number of results to return. @default 5 */
	limit?: number;
	/** Minimum score threshold — results below this value are excluded. */
	scoreThreshold?: number;
	/**
	 * Qdrant filter expression applied before scoring.
	 * Use the Qdrant filter DSL: https://qdrant.tech/documentation/concepts/filtering/
	 */
	filter?: Record<string, unknown>;
	/** Payload fields to include in the response. Omit to return all fields. */
	withPayload?: boolean | string[];
}

/**
 * Performs an approximate-nearest-neighbour search against a Qdrant collection.
 *
 * @param collectionName - Name of the collection to query.
 * @param queryVector    - Dense embedding vector to search with.
 * @param options        - Optional search parameters.
 * @returns              Ordered list of matching points (most similar first).
 */
export async function searchCollection<
	T extends Record<string, unknown> = Record<string, unknown>,
>(
	collectionName: string,
	queryVector: number[],
	options: SearchOptions = {},
): Promise<SearchResult<T>[]> {
	const client = getClient();
	const { limit = 5, scoreThreshold, filter, withPayload = true } = options;

	const result = await client.query(collectionName, {
		query: queryVector,
		limit,
		score_threshold: scoreThreshold,
		filter: filter as Parameters<typeof client.query>[1]["filter"],
		with_payload: withPayload,
	});

	return result.points.map((hit) => ({
		id: hit.id,
		score: hit.score,
		payload: (hit.payload ?? {}) as T,
	}));
}
