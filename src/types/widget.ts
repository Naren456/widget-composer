import { type DataSource } from "@/types/data-source";
import { type WidgetDocument } from "@/widget-engine/document";

/** The style, colour and size a widget is composed with. */
export type WidgetAppearance = {
  styleId: string;
  colorId: string;
  sizeId: string;
};

export const defaultAppearance: WidgetAppearance = {
  styleId: "minimal",
  colorId: "green",
  sizeId: "medium",
};

/** Light or dark card, picked on Create and changeable in the preview. */
export type WidgetTheme = "light" | "dark";

/**
 * A widget the user has composed from a website.
 *
 * This is deliberately NOT the backend widget specification. No WidgetComposer API
 * exists in this repository yet, so nothing here is validated against a server
 * contract and no website content is fetched. When the Fastify API lands, this
 * becomes a view model derived from the versioned spec rather than the source of truth.
 */
export type SavedWidget = {
  id: string;
  /** Shown on cards and in the preview header, derived from the site's hostname. */
  name: string;
  /** Normalised https URL of the source website; empty for agent widgets built from a service. */
  url: string;
  /** What the user asked the widget to show. */
  description: string;
  theme: WidgetTheme;
  /** Epoch ms the widget was composed on this device. */
  createdAt: number;
  /** Document built by the server agent. Absent for local drafts, which use a template. */
  document?: WidgetDocument;
  /** Agent's one-line description of what the widget shows and where the data is from. */
  summary?: string;
  /** Where the document's values refresh from (POST /api/data). Absent for fixed content. */
  dataSource?: DataSource;
  /** Epoch ms the values were last fetched from the data source. */
  refreshedAt?: number;
};

/**
 * Turns free-typed input into an https URL, or null if it cannot be a website.
 * Requires a dotted hostname so "news" or "localhost" are rejected.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!/^[^.\s]+(\.[^.\s]+)+$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Hostname without a leading "www.", e.g. "techcrunch.com". */
export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Display name from a URL: the first hostname label, capitalised, e.g. "Techcrunch". */
export function nameFromUrl(url: string): string {
  const label = hostFromUrl(url).split(".")[0] ?? "";
  if (!label) return "Untitled widget";
  return label.charAt(0).toUpperCase() + label.slice(1);
}
