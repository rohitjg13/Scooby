import { streamText } from "ai";
import { searchCollection } from "$lib/server/qdrant";
import type { RequestHandler } from "./$types";
import { COLLECTION_NAME, SEARCH_LIMIT, SCORE_THRESHOLD, NOT_IN_DB_REPLY, SYSTEM_PROMPT } from "$lib/server/chat/constants";
import { model } from "$lib/server/chat/clients";
import { getEmbedding } from "$lib/server/chat/embedding";
import { checkGroundedness } from "$lib/server/chat/grounding";

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
