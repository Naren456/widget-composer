import { normalizeUrl, type SavedWidget } from "@/types/widget";

export type ChatMessage =
  | { id: string; role: "user"; text: string; url: string | null }
  /** The server agent is still working on the request. */
  | { id: string; role: "assistant"; status: "pending" }
  | {
      id: string;
      role: "assistant";
      status: "done";
      /** The draft built for the request; null when there is nothing to show yet. */
      widget: SavedWidget | null;
      saved: boolean;
      /** "agent" when the server agent built it, "local" for the on-device fallback. */
      source: "agent" | "local";
      /** Agent's own words when it needs something first, e.g. a Composio connect link. */
      text?: string;
      /** Why a local draft was made instead, shown under the reply. */
      note?: string;
      /** Composio tools the agent called. */
      toolsUsed?: string[];
    };

export type AssistantDone = Extract<ChatMessage, { status: "done" }>;

/** Words that look like a website, e.g. "techcrunch.com" or "https://news.ycombinator.com/best". */
// The last label must be letters so "v1.2" or "e.g." are not taken for sites.
const URL_TOKEN = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i;

/**
 * Splits a chat request into the website and what the widget should show.
 *
 * Purely local: an attached link wins, otherwise the first website-looking word in
 * the text is used. Nothing is fetched and no model interprets the request.
 */
export function parseRequest(text: string, attachedUrl: string | null): { url: string | null; description: string } {
  const trimmed = text.trim();
  if (attachedUrl) return { url: attachedUrl, description: trimmed };

  const match = trimmed.match(URL_TOKEN);
  const url = match ? normalizeUrl(match[0]) : null;
  if (!url || !match) return { url: null, description: trimmed };

  // Drop the site and the word joining it, so "headlines from techcrunch.com" reads "headlines".
  const joined = new RegExp(`\\s*\\b(?:from|on|at|of|for|in)?\\s*${escapeRegExp(match[0])}`, "i");
  const description = trimmed.replace(joined, "").replace(/\s{2,}/g, " ").trim();
  return { url, description };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let counter = 0;
/** Stable-enough ids for a session-only thread. */
export function messageId(): string {
  counter += 1;
  return `m_${Date.now().toString(36)}_${counter}`;
}
