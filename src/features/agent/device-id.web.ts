import { randomId } from "@/features/agent/random-id";

/** Web variant: expo-file-system is native-only, so the id lives in localStorage. */
const KEY = "device-id";
let cached: string | null = null;

export function deviceId(): string {
  if (cached) return cached;
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    if (stored) return (cached = stored);
    const id = randomId();
    globalThis.localStorage?.setItem(KEY, id);
    return (cached = id);
  } catch {
    return (cached = randomId());
  }
}
