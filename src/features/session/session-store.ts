import { File, Paths } from "expo-file-system";

/**
 * Persists the API refresh token in the app's private documents directory, which
 * other apps cannot read and which is removed with the app. The short-lived access
 * token is kept in memory only.
 *
 * TODO: move to expo-secure-store (Android Keystore) with the next native build — it
 * is not in the current development build, and a missing native module would crash.
 */
const file = () => new File(Paths.document, "api-session.json");

export type StoredSession = { userId: string; refreshToken: string };

export function loadSession(): StoredSession | null {
  try {
    const f = file();
    if (!f.exists) return null;
    const parsed = JSON.parse(f.textSync()) as Partial<StoredSession>;
    return typeof parsed.userId === "string" && typeof parsed.refreshToken === "string"
      ? { userId: parsed.userId, refreshToken: parsed.refreshToken }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(JSON.stringify(session));
  } catch (error) {
    // Failing only means a new anonymous account on next launch.
    if (__DEV__) console.warn("[session] could not save", error);
  }
}

export function clearSession(): void {
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch {
    // Nothing to clear.
  }
}
