<script lang="ts">
  import { Chat } from "@ai-sdk/svelte";

  const chat = new Chat({});

  let input = $state("");

  const isLoading = $derived(
    chat.status === "submitted" || chat.status === "streaming",
  );

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    chat.sendMessage({ text: input });
    input = "";
  }
</script>

<div class="chat-page">
  <header class="chat-header">
    <h1>Scooby</h1>
  </header>

  <main class="message-list">
    {#each chat.messages as message (message.id)}
      <div class="message-row {message.role}">
        <div class="message-bubble {message.role}">
          {#each message.parts as part}
            {#if part.type === "text"}
              {part.text}
            {/if}
          {/each}
        </div>
      </div>
    {/each}

    {#if isLoading}
      <div class="message-row assistant">
        <div class="message-bubble assistant thinking">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    {/if}
  </main>

  <footer class="input-area">
    <form onsubmit={handleSubmit}>
      <input
        type="text"
        bind:value={input}
        placeholder="Ask Scooby something..."
        disabled={isLoading}
        autocomplete="off"
      />
      <button type="submit" disabled={isLoading} aria-label="Send">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
    </form>
  </footer>
</div>

<style>
  /* ── Fonts ───────────────────────────────────────────────────── */
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap");

  /* ── Page Layout ─────────────────────────────────────────────── */
  .chat-page {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    width: 100%;
    font-family:
      "Inter",
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
    background: #0f0f0f;
  }

  /* ── Header ──────────────────────────────────────────────────── */
  .chat-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #2a2a2a;
    background: #141414;
  }

  .chat-header h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #ffffff;
  }

  /* ── Message List ────────────────────────────────────────────── */
  .message-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    scroll-behavior: smooth;
  }

  .message-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .message-row.user {
    align-self: flex-end;
    align-items: flex-end;
    max-width: 75%;
  }

  .message-row.assistant {
    align-self: stretch;
    align-items: stretch;
  }

  /* ── Bubbles ─────────────────────────────────────────────────── */
  .message-bubble {
    line-height: 1.5;
    font-size: 0.95rem;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .message-bubble.user {
    padding: 0.65rem 1rem;
    border-radius: 1.25rem;
    background: #ffffff;
    color: #08080a;
  }

  .message-bubble.assistant {
    padding: 1rem 1.5rem;
    color: #e5e5e5;
  }

  /* ── Thinking Indicator ──────────────────────────────────────── */
  .message-bubble.thinking {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.75rem 1rem;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #555555;
    animation: bounce 1.2s infinite ease-in-out;
  }

  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-6px);
    }
  }

  /* ── Input Area ──────────────────────────────────────────────── */
  .input-area {
    padding: 1rem 1.5rem;
    border-top: 1px solid #2a2a2a;
    background: #141414;
  }

  .input-area form {
    display: flex;
    gap: 0.75rem;
  }

  .input-area input {
    flex: 1;
    padding: 0.65rem 1rem;
    border: 1px solid #2a2a2a;
    border-radius: 0.75rem;
    font-size: 0.95rem;
    outline: none;
    background: #1c1c1c;
    color: #ffffff;
    transition: border-color 0.15s;
  }

  .input-area input::placeholder {
    color: #555555;
  }

  .input-area input:focus {
    border-color: #ffffff;
    background: #1c1c1c;
  }

  .input-area input:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .input-area button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    background: #ffffff;
    color: #0a0a0a;
    border: none;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .input-area button:hover:not(:disabled) {
    background: #e5e5e5;
  }

  .input-area button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
