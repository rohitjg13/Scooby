// useChat from @ai-sdk/svelte relies on browser-only APIs (Svelte stores,
// fetch streaming). Disabling SSR for this route prevents the
// "useChat is not a function" error during server-side rendering.
export const ssr = false;
