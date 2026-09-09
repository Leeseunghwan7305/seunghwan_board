const KEY = "openai_key";

export function getKey(): string | null {
  if (typeof window === "undefined") return null; // node (vitest/SSR) safety
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setKey(value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, value.trim());
  } catch {
    // storage unavailable (e.g. private mode) — silently no-op
  }
}

export function clearKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // storage unavailable — silently no-op
  }
}
