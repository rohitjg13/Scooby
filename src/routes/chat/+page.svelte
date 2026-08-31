<script lang="ts">
  import { Chat } from '@ai-sdk/svelte';

  const chat = new Chat({});

  let input = $state('');

  const isLoading = $derived(
    chat.status === 'submitted' || chat.status === 'streaming'
  );

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    chat.sendMessage({ text: input });
    input = '';
  }
</script>

<div class="chat-page">
  <header class="chat-header">
    <h1>ScoobyBot</h1>
  </header>

  <main class="message-list">
    {#each chat.messages as message (message.id)}
      <div class="message-row {message.role}">
        <span class="message-sender">
          {message.role === 'user' ? 'You' : 'ScoobyBot'}
        </span>
        <div class="message-bubble {message.role}">
          {#each message.parts as part}
            {#if part.type === 'text'}
              {part.text}
            {/if}
          {/each}
        </div>
      </div>
    {/each}

    {#if isLoading}
      <div class="message-row assistant">
        <span class="message-sender">ScoobyBot</span>
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
        placeholder="Ask ScoobyBot something..."
        disabled={isLoading}
        autocomplete="off"
      />
      <button type="submit" disabled={isLoading}>
        Send
      </button>
    </form>
  </footer>
</div>

<style>
  /* ── Page Layout ─────────────────────────────────────────────── */
  .chat-page {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 760px;
    margin: 0 auto;
    font-family: system-ui, sans-serif;
    background: #f9f9fb;
  }

  /* ── Header ──────────────────────────────────────────────────── */
  .chat-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #ffffff;
  }

  .chat-header h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
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
    max-width: 75%;
  }

  .message-row.user {
    align-self: flex-end;
    align-items: flex-end;
  }

  .message-row.assistant {
    align-self: flex-start;
    align-items: flex-start;
  }

  .message-sender {
    font-size: 0.72rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0 0.25rem;
  }

  /* ── Bubbles ─────────────────────────────────────────────────── */
  .message-bubble {
    padding: 0.65rem 1rem;
    border-radius: 1.25rem;
    line-height: 1.5;
    font-size: 0.95rem;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .message-bubble.user {
    background: #2563eb;
    color: #ffffff;
    border-bottom-right-radius: 0.25rem;
  }

  .message-bubble.assistant {
    background: #e5e7eb;
    color: #111827;
    border-bottom-left-radius: 0.25rem;
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
    background: #9ca3af;
    animation: bounce 1.2s infinite ease-in-out;
  }

  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40%           { transform: translateY(-6px); }
  }

  /* ── Input Area ──────────────────────────────────────────────── */
  .input-area {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #ffffff;
  }

  .input-area form {
    display: flex;
    gap: 0.75rem;
  }

  .input-area input {
    flex: 1;
    padding: 0.65rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.75rem;
    font-size: 0.95rem;
    outline: none;
    background: #f9f9fb;
    transition: border-color 0.15s;
  }

  .input-area input:focus {
    border-color: #2563eb;
    background: #ffffff;
  }

  .input-area input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input-area button {
    padding: 0.65rem 1.25rem;
    background: #2563eb;
    color: #ffffff;
    border: none;
    border-radius: 0.75rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .input-area button:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .input-area button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
