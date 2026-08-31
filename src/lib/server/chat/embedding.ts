import { genai } from "./clients";

// ---------------------------------------------------------------------------
// Embedding — gemini-embedding-001 via @google/genai
// ---------------------------------------------------------------------------

export async function getEmbedding(text: string): Promise<number[]> {
	const response = await genai.models.embedContent({
		model: "gemini-embedding-001",
		contents: [text],
	});

	const values = response.embeddings?.[0]?.values;
	if (!values || values.length === 0) {
		throw new Error("[chat] gemini-embedding-001 returned an empty embedding.");
	}

	return values;
}
