# Chatbot Implementation Guide: RAG, Streaming, and Tool Calling

This guide provides a comprehensive, step-by-step roadmap to implement your AI chatbot using your current project stack (SvelteKit) and your desired AI architecture. 

## Tech Stack Overview
*   **LLM Interface / Orchestration:** Vercel AI SDK (`ai` and `@ai-sdk/svelte`)
*   **Vector Database (RAG):** Qdrant
*   **Guardrails & Schema Validation:** Zod
*   **LLM Provider:** Groq (Extremely fast inference, perfect for handling large models like `GPT-OSS-120B` and snappy tool calling).

---

## Step 1: Install Dependencies

Open your terminal in the root of your project and install the required packages:

```bash
# Core AI SDK, Zod for guardrails, and Groq Provider
npm install ai zod @ai-sdk/svelte @ai-sdk/groq

# Qdrant client for Vector RAG
npm install @qdrant/js-client-rest

# Standard utility for parsing env variables (optional but recommended)
npm install dotenv
```

---

## Step 2: Environment Variables

Add the necessary API keys and URLs to your `.env` file at the root of your project.

```env
# .env

# Your Groq API Key
GROQ_API_KEY="your-groq-api-key"

# Qdrant configuration
QDRANT_URL="http://localhost:6333" # Or your Qdrant Cloud URL
QDRANT_API_KEY="your-qdrant-api-key" # Leave empty if running locally without auth
```

---

## Step 3: Setting Up Qdrant (Vector Database)

Before writing the chatbot code, you need an active Qdrant instance.

### 3.1 Run Qdrant Locally (Docker)
If you don't have Qdrant running, start it via Docker:
```bash
docker run -p 6333:6333 -p 6334:6334 \
    -v $(pwd)/qdrant_storage:/qdrant/storage:z \
    qdrant/qdrant
```

### 3.2 Initialize the Qdrant Collection
Create a utility file to manage your Qdrant connection.
Create `src/lib/server/qdrant.ts`:

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '$env/dynamic/private';

export const qdrantClient = new QdrantClient({
    url: env.QDRANT_URL || 'http://localhost:6333',
    apiKey: env.QDRANT_API_KEY,
});

const COLLECTION_NAME = "chatbot_knowledge";

export async function ensureCollectionExists() {
    try {
        const collections = await qdrantClient.getCollections();
        const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
        
        if (!exists) {
            await qdrantClient.createCollection(COLLECTION_NAME, {
                vectors: {
                    size: 1536, // This MUST match your embedding model's output size (e.g., 1536 for OpenAI ada-002)
                    distance: 'Cosine',
                },
            });
            console.log(`Collection ${COLLECTION_NAME} created.`);
        }
    } catch (error) {
        console.error("Error initializing Qdrant:", error);
    }
}

// Helper to search vectors
export async function searchKnowledge(embedding: number[], limit: number = 3) {
    return await qdrantClient.search(COLLECTION_NAME, {
        vector: embedding,
        limit,
        with_payload: true, // Returns the actual text chunk attached to the vector
    });
}
```

---

## Step 4: The Chat Backend (API Route)

Now we create the backend endpoint that handles the streaming and tool calling.
Since you are using SvelteKit, create this file: `src/routes/api/chat/+server.ts`.

```typescript
import { createGroq } from '@ai-sdk/groq';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { searchKnowledge } from '$lib/server/qdrant';

// 1. Setup the Groq provider
const groq = createGroq({
    apiKey: env.GROQ_API_KEY,
});

// Select your specific model hosted on Groq
const model = groq('gpt-oss-120b');

// Helper function: You will need an embedding function to turn user queries into vectors
async function getEmbedding(text: string): Promise<number[]> {
    // Implement your embedding logic here. E.g., fetch to an embedding API.
    // This returns a dummy array for compilation purposes.
    return Array(1536).fill(0.1); 
}

export async function POST({ request }) {
    // Extract the chat history from the frontend
    const { messages } = await request.json();

    // 2. Initiate the stream with Tools configured
    const result = await streamText({
        model: model,
        messages,
        system: "You are a helpful AI assistant. Use tools to search the knowledge base when needed.",
        
        // 3. Define Guardrails & Tools using Zod
        tools: {
            searchDatabase: tool({
                description: 'Search the internal vector database to answer questions about specific knowledge.',
                parameters: z.object({
                    query: z.string().describe('The search query to look up in the database'),
                }),
                execute: async ({ query }) => {
                    // a) Convert query to embedding
                    const queryEmbedding = await getEmbedding(query);
                    
                    // b) Retrieve from Qdrant
                    const results = await searchKnowledge(queryEmbedding);
                    
                    // c) Format results for the LLM
                    const contextText = results.map(r => r.payload?.text).join('\n\n');
                    
                    return {
                        tool_result: `Here is the retrieved context:\n${contextText}`
                    };
                },
            }),
            
            // Example of a secondary tool
            getWeather: tool({
                description: 'Get the current weather for a location',
                parameters: z.object({
                    location: z.string().describe('City name'),
                }),
                execute: async ({ location }) => {
                    // Fetch external API
                    return { weather: 'sunny', temp: '72F' };
                }
            })
        },
        
        // Let the model decide to execute up to 3 tools in a single request automatically
        maxSteps: 3, 
    });

    // 4. Return the Stream to the client
    return result.toDataStreamResponse();
}
```

---

## Step 5: The Frontend UI (SvelteKit)

Finally, create the user interface. The `useChat` hook handles connecting to the stream, updating the state token-by-token, and seamlessly handling when the stream pauses to execute a tool.

Create or edit your main page: `src/routes/+page.svelte`.

```html
<script lang="ts">
  import { useChat } from '@ai-sdk/svelte';

  // useChat automatically connects to /api/chat
  const { messages, input, handleSubmit, isLoading } = useChat();
</script>

<main class="max-w-2xl mx-auto p-4 flex flex-col h-screen">
  <header class="mb-4">
    <h1 class="text-2xl font-bold">Groq Chatbot</h1>
  </header>

  <!-- Chat History -->
  <div class="flex-1 overflow-y-auto mb-4 border rounded p-4 bg-gray-50">
    {#each $messages as message}
      <div class="mb-4">
        <strong class="capitalize">{message.role}:</strong>
        
        <!-- Render normal text -->
        <p class="whitespace-pre-wrap">{message.content}</p>

        <!-- Render tool call UI (Optional, but good for debugging/UX) -->
        {#if message.toolInvocations}
          {#each message.toolInvocations as toolInvocation}
            <div class="mt-2 text-sm text-gray-500 bg-gray-100 p-2 rounded">
              {#if toolInvocation.state === 'result'}
                ✅ Used tool: <strong>{toolInvocation.toolName}</strong> 
              {:else}
                ⏳ Calling tool: <strong>{toolInvocation.toolName}...</strong>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {/each}
    
    {#if $isLoading}
      <div class="text-gray-400 text-sm">AI is thinking...</div>
    {/if}
  </div>

  <!-- Input Form -->
  <form on:submit={handleSubmit} class="flex gap-2">
    <input 
      bind:value={$input} 
      disabled={$isLoading}
      placeholder="Ask a question..."
      class="flex-1 p-2 border rounded"
    />
    <button 
      type="submit" 
      disabled={$isLoading}
      class="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
    >
      Send
    </button>
  </form>
</main>
```

---

## Step 6: Testing the Workflow

1. Start Qdrant (`docker start qdrant`).
2. Run the SvelteKit development server:
   ```bash
   npm run dev
   ```
3. Navigate to `http://localhost:5173`.
4. Ask a question.
   * If the question requires general knowledge, it will stream normally.
   * If the question requires specialized data, the LLM will stop streaming text, invoke `searchDatabase`, your backend will query Qdrant, return the chunks to the LLM, and the LLM will resume streaming a summarizing answer based on those chunks.

## How Zod Guardrails Protect You Here
Notice how the `parameters: z.object({...})` is used inside the `tool()` definition in **Step 4**.
* The Vercel AI SDK automatically extracts the LLM's raw output.
* It passes that raw output through your Zod schema.
* If the LLM hallucinates an argument (e.g., forgets the `query` field), Zod throws an error, and the Vercel AI SDK can automatically prompt the LLM to fix its syntax or gracefully fallback. You don't have to manually parse JSON strings!
