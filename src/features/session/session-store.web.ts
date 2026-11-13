/** Web: the refresh token lives in localStorage for this origin. */
const KEY = "api-session";

export type StoredSession = { userId: string; refreshToken: string };

export function loadSession(): StoredSession | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (private window): a new anonymous account next time.
  }
}

export function clearSession(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
