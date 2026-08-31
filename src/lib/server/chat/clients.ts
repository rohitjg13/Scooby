import { createGroq } from "@ai-sdk/groq";
import { GoogleGenAI } from "@google/genai";
import { env } from "$env/dynamic/private";

// ---------------------------------------------------------------------------
// Groq client — initialised once at module load, reused across requests.
// ---------------------------------------------------------------------------

export const groq = createGroq({ apiKey: env.GROQ_API_KEY });
export const model = groq("openai/gpt-oss-120b");

// ---------------------------------------------------------------------------
// Google GenAI client — used exclusively for embeddings.
// ---------------------------------------------------------------------------

export const genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
