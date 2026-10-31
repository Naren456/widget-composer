import { deviceId } from "@/features/agent/device-id";
import { type AgentResult } from "@/types/agent";

/** Agent runs call a model and live APIs, so allow well beyond a normal request. */
const TIMEOUT_MS = 120_000;

export type ComposeResult = AgentResult | { ok: false; reason: "unreachable"; message: string; toolsUsed: string[] };

/**
 * Asks the server agent (POST /api/agent) to build a widget.
 *
 * Relative URL on purpose: in development Expo routes it to the dev server; in
 * production set `origin` on the expo-router plugin so it reaches the deployed server.
 * Never throws — every failure comes back as a result the chat can explain.
 */
export async function composeWithAgent(message: string, url: string | null): Promise<ComposeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: deviceId(), message, url }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as AgentResult | null;
    if (body && typeof body === "object" && "ok" in body) return body;
    return { ok: false, reason: "failed", message: `The agent returned ${response.status}.`, toolsUsed: [] };
  } catch {
    return { ok: false, reason: "unreachable", message: "Couldn't reach the widget agent.", toolsUsed: [] };
  } finally {
    clearTimeout(timer);
  }
}
