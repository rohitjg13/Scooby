import { generateObject } from "ai";
import { z } from "zod";
import { model } from "./clients";

// ---------------------------------------------------------------------------
// Zod schema — groundedness gate
//
// Before streaming a single token we ask the model to judge, in a structured
// way, whether the retrieved context actually covers the user's question.
// generateObject() enforces the schema via Zod so we always get back a
// typed object — never a free-form string that could slip through.
// ---------------------------------------------------------------------------

export const GroundednessSchema = z.object({
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

export type Groundedness = z.infer<typeof GroundednessSchema>;

// ---------------------------------------------------------------------------
// Groundedness gate — structured LLM call validated by Zod.
//
// Returns `{ canAnswer: true }` only when the context actually covers the
// question. Any other outcome (missing context, off-topic, Zod parse error)
// causes canAnswer to be false so the caller short-circuits cleanly.
// ---------------------------------------------------------------------------

export async function checkGroundedness(
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
