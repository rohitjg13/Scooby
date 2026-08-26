import { createGroq } from "@ai-sdk/groq";
import { generateObject, streamText } from "ai";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { env } from "$env/dynamic/private";
import { searchCollection } from "$lib/server/qdrant";
import type { RequestHandler } from "./$types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION_NAME = "chatbot_knowledge";
const VECTOR_SIZE = 3072; // gemini-embedding-001 default output dimensionality
const SEARCH_LIMIT = 5;
const SCORE_THRESHOLD = 0.5; // Results below this similarity score are discarded

const NOT_IN_DB_REPLY =
  "I'm sorry, I don't have information about that in my database right now. " +
  "Please check with the SNU administration or the relevant department for accurate details.";

// ---------------------------------------------------------------------------
// Groq client — initialised once at module load, reused across requests.
// ---------------------------------------------------------------------------

const groq = createGroq({ apiKey: env.GROQ_API_KEY });
const model = groq("openai/gpt-oss-120b");

// ---------------------------------------------------------------------------
// Google GenAI client — used exclusively for embeddings.
// ---------------------------------------------------------------------------

const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// ---------------------------------------------------------------------------
// Zod schema — groundedness gate
//
// Before streaming a single token we ask the model to judge, in a structured
// way, whether the retrieved context actually covers the user's question.
// generateObject() enforces the schema via Zod so we always get back a
// typed object — never a free-form string that could slip through.
// ---------------------------------------------------------------------------

const GroundednessSchema = z.object({
  /** Whether the retrieved context contains enough information to answer. */
  canAnswer: z
    .boolean()
    .describe(
      "true only if the retrieved database context contains sufficient information " +
      "to answer the user question accurately and completely. " +
      "false if the context is empty, off-topic, or only tangentially related.",
    ),
  /** Short reason for the decision — used for server-side logging only. */
  reason: z
    .string()
    .describe("One-sentence explanation of why canAnswer is true or false."),
});

type Groundedness = z.infer<typeof GroundednessSchema>;

// ---------------------------------------------------------------------------
// Embedding — gemini-embedding-001 via @google/genai
// ---------------------------------------------------------------------------

async function getEmbedding(text: string): Promise<number[]> {
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

// ---------------------------------------------------------------------------
// Groundedness gate — structured LLM call validated by Zod.
//
// Returns `{ canAnswer: true }` only when the context actually covers the
// question. Any other outcome (missing context, off-topic, Zod parse error)
// causes canAnswer to be false so the caller short-circuits cleanly.
// ---------------------------------------------------------------------------

async function checkGroundedness(
  userQuestion: string,
  contextBlock: string,
): Promise<Groundedness> {
  // If Qdrant returned nothing at all, skip the LLM round-trip entirely.
  // if (!contextBlock) {
  //   return { canAnswer: false, reason: "No context was retrieved from the database." };
  // }

  try {
    const { object } = await generateObject({
      model,
      schema: GroundednessSchema,
      system:
        "You are a strict grounding evaluator. " +
        "You are given a user question and a set of context passages retrieved from a knowledge database. " +
        "Your sole task is to decide whether those passages contain enough information to answer the question accurately. " +
        "HOWEVER, if the user message is simply a greeting (like 'hi' or 'hello') or casual small talk, you MUST return { canAnswer: true, reason: 'casual greeting' } so the conversation can continue.",
      prompt:
        `User question:\n${userQuestion}\n\n` +
        `Retrieved context:\n${contextBlock}`,
    });
    return object;
  } catch (err) {
    // Zod parse failure or network error → fail closed (deny the stream).
    console.error("[chat] Groundedness check failed:", err);
    return { canAnswer: false, reason: "Groundedness check encountered an error." };
  }
}

// ---------------------------------------------------------------------------
// System prompt — defines the AI's personality and strict RAG behaviour.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `\
You are Scooby, a knowledgeable and friendly campus assistant for SNU (Shiv Nadar University) students.

## Personality
- Warm, helpful, and concise — like a well-informed senior student.
- Use clear, simple language. Avoid jargon unless the context demands it.
- Be encouraging and supportive when students seem stressed or confused.

## Critical rules you MUST follow
1. If the user asks a factual question, you ONLY answer using the database context provided.
2. Do NOT make up, assume, or hallucinate any facts, dates, room numbers, policies, or people.
3. Do NOT draw on your general training knowledge to fill gaps — database context only.
4. Cite the source naturally when the context includes one (e.g. "According to the hostel policy…").
5. Keep answers focused. If the retrieved context covers the question, answer directly without padding.
6. If the user is simply greeting you (e.g., 'hi'), warmly greet them back and ask how you can help them with SNU campus info
`;

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export const POST: RequestHandler = async ({ request }) => {
  // 1. Parse the incoming message list from the frontend (Vercel AI SDK format).
  const { messages } = await request.json();

  // 2. Extract the latest user message to embed and search the database.
  const latestUserMessage: string =
    [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content ?? "";

  // 3. Embed the query and retrieve relevant context from Qdrant.
  let contextBlock = "";
  try {
    const queryVector = await getEmbedding(latestUserMessage);
    const hits = await searchCollection<{ text?: string; source?: string }>(
      COLLECTION_NAME,
      queryVector,
      { limit: SEARCH_LIMIT, scoreThreshold: SCORE_THRESHOLD },
    );

    if (hits.length > 0) {
      contextBlock = hits
        .map((hit, i) => {
          const text = hit.payload.text ?? "(no text)";
          const source = hit.payload.source ? ` [source: ${hit.payload.source}]` : "";
          return `[${i + 1}]${source}\n${text}`;
        })
        .join("\n\n");
    }
  } catch (err) {
    console.error("[chat] Qdrant search failed:", err);
  }

  // 4. ── Zod-validated groundedness gate ──────────────────────────────────
  //    generateObject() + GroundednessSchema guarantees we always receive a
  //    typed { canAnswer, reason } — never an unparsed string. If canAnswer
  //    is false we short-circuit here and return the polite decline as a
  //    plain text stream so the frontend receives it in the same format.
  const groundedness = await checkGroundedness(latestUserMessage, contextBlock);
  console.log(`[chat] Groundedness → canAnswer=${groundedness.canAnswer} | ${groundedness.reason}`);

  if (!groundedness.canAnswer) {
    // Return the decline as a minimal text stream so the frontend's
    // useChat / streaming reader works exactly the same way.
    const decline = streamText({
      model,
      // Single-turn: system forces a verbatim reply with no embellishment.
      system:
        "You are a helpful assistant. " +
        "Output the user's message EXACTLY, word for word, with no additions or changes.",
      prompt: NOT_IN_DB_REPLY,
    });
    return (await decline).toTextStreamResponse();
  }

  // 5. Context is grounded — stream the full answer.
  const systemWithContext =
    `${SYSTEM_PROMPT}\n\n## Retrieved context from the database\n${contextBlock}`;

  const result = await streamText({
    model,
    system: systemWithContext,
    messages,
  });

  return result.toTextStreamResponse();
};
