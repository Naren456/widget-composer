import Anthropic from "@anthropic-ai/sdk";

import { agentConfigured, runWidgetAgent } from "@/server/agent";

/**
 * POST /api/agent — builds a widget document from a chat request.
 *
 * Body: { userId: string, message: string, url?: string | null }
 * 200 → AgentResult · 400 bad input · 503 agent not configured · 502 upstream failure
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const { userId, message, url } = (body ?? {}) as Record<string, unknown>;
  if (typeof userId !== "string" || !/^[\w-]{8,64}$/.test(userId)) {
    return Response.json({ error: "userId must be 8-64 letters, digits, _ or -" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length === 0 || message.length > 500) {
    return Response.json({ error: "message must be 1-500 characters" }, { status: 400 });
  }
  if (url != null && (typeof url !== "string" || !/^https?:\/\//.test(url) || url.length > 500)) {
    return Response.json({ error: "url must be an http(s) URL" }, { status: 400 });
  }

  if (!agentConfigured()) {
    return Response.json(
      { ok: false, reason: "unconfigured", message: "The widget agent is not configured on the server.", toolsUsed: [] },
      { status: 503 },
    );
  }

  try {
    const result = await runWidgetAgent({ userId, message: message.trim(), url: (url as string | null) ?? null });
    return Response.json(result);
  } catch (error) {
    // Most specific first; never leak upstream error bodies to the client.
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ ok: false, reason: "failed", message: "The agent is busy. Try again shortly.", toolsUsed: [] }, { status: 429 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[agent] Anthropic authentication failed — check ANTHROPIC_API_KEY");
    } else {
      console.error("[agent] run failed", error);
    }
    return Response.json({ ok: false, reason: "failed", message: "The agent could not build this widget.", toolsUsed: [] }, { status: 502 });
  }
}
