import { randomId } from "@/features/agent/random-id";
import { File, Paths } from "expo-file-system";

/**
 * Stable per-install id used as the Composio user id, so connected accounts survive
 * restarts. There is no sign-in yet: whoever holds this id can use its connections,
 * so it is random (UUID v4) and never shown in the UI.
 */
let cached: string | null = null;

export function deviceId(): string {
  if (cached) return cached;
  const file = new File(Paths.document, "device-id");
  try {
    if (file.exists) {
      const stored = file.textSync().trim();
      if (stored) return (cached = stored);
    }
    const id = randomId();
    if (!file.exists) file.create();
    file.writeSync(id);
    return (cached = id);
  } catch {
    // Storage failed: a session-only id still lets the agent run, connections just won't persist.
    return (cached = randomId());
  }
}
