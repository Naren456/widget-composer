import Constants from "expo-constants";

import { clearSession, loadSession, saveSession } from "@/features/session/session-store";

/**
 * Client for the WidgetComposer API (the Express backend in
 * `~/Documents/widget-composer-backend/apps/api`).
 *
 * Base URL: `EXPO_PUBLIC_API_URL` when set — required for release builds. In
 * development it falls back to the machine running the Expo dev server, port 3000, so a
 * phone on the same network (or over `adb reverse`) reaches the backend.
 *
 * Auth: each install gets an anonymous account (POST /v1/auth/device). The refresh
 * token is persisted; access tokens live in memory and are renewed on a 401.
 */

const TIMEOUT_MS = 20_000;
/** Generation runs a model and can repair its output, so it gets far longer. */
const GENERATE_TIMEOUT_MS = 120_000;
const DEV_API_PORT = 3000;

export function apiBaseUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (!__DEV__) return null;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:${DEV_API_PORT}` : null;
}

export type ApiFailure = {
  ok: false;
  /** Server error code (e.g. GENERATION_INVALID) or a client-side reason. */
  code: string;
  message: string;
  details: string[];
};

type ApiResult<T> = { ok: true; data: T } | ApiFailure;

const failure = (code: string, message: string, details: string[] = []): ApiFailure => ({ ok: false, code, message, details });

let accessToken: string | null = null;

type SessionResponse = { accessToken: string; refreshToken: string; userId: string };

async function send(path: string, init: { method: string; body?: unknown; token?: string | null; timeoutMs?: number }) {
  const base = apiBaseUrl();
  if (!base) return { error: failure("UNCONFIGURED", "The WidgetComposer API address isn't set (EXPO_PUBLIC_API_URL).") };
  try {
    const response = await fetch(`${base}${path}`, {
      method: init.method,
      headers: {
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_MS),
    });
    const body = await response.json().catch(() => null);
    return { response, body };
  } catch {
    return { error: failure("UNREACHABLE", `Couldn't reach the WidgetComposer API at ${base}.`) };
  }
}

function asFailure(status: number, body: unknown): ApiFailure {
  const error = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  const details = Array.isArray(error?.details)
    ? error.details.map((d: { path?: string; field?: string; message?: string }) =>
        [d.path ?? d.field, d.message].filter(Boolean).join(": "),
      )
    : [];
  return failure(error?.code ?? `HTTP_${status}`, error?.message ?? `The API returned ${status}.`, details);
}

/** Ensures there is an access token: refresh the stored session, or create a new account. */
async function authenticate(): Promise<ApiFailure | null> {
  const stored = loadSession();
  if (stored) {
    const r = await send("/v1/auth/refresh", { method: "POST", body: { refreshToken: stored.refreshToken } });
    if ("error" in r) return r.error ?? null;
    if (r.response.ok) {
      const s = r.body as SessionResponse;
      accessToken = s.accessToken;
      saveSession({ userId: s.userId, refreshToken: s.refreshToken });
      return null;
    }
    if (r.response.status !== 401) return asFailure(r.response.status, r.body);
    // The session is gone (expired or revoked): fall through to a fresh account.
    clearSession();
  }
  const r = await send("/v1/auth/device", { method: "POST" });
  if ("error" in r) return r.error ?? null;
  if (!r.response.ok) return asFailure(r.response.status, r.body);
  const s = r.body as SessionResponse;
  accessToken = s.accessToken;
  saveSession({ userId: s.userId, refreshToken: s.refreshToken });
  return null;
}

/** Authenticated request. Retries once with a renewed token on 401. Never throws. */
async function call<T>(path: string, init: { method: string; body?: unknown; timeoutMs?: number }): Promise<ApiResult<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!accessToken) {
      const authError = await authenticate();
      if (authError) return authError;
    }
    const r = await send(path, { ...init, token: accessToken });
    if ("error" in r) return r.error!;
    if (r.response.status === 401 && attempt === 0) {
      accessToken = null;
      continue;
    }
    if (!r.response.ok) return asFailure(r.response.status, r.body);
    return { ok: true, data: r.body as T };
  }
  return failure("UNAUTHENTICATED", "Couldn't sign in to the WidgetComposer API.");
}

/** Versioned WidgetSpec returned by the backend and consumed by both widget renderers. */
export type WidgetAction =
  | { type: "open_url"; urlBinding: string }
  | { type: "open_app"; screen: "widget_details" }
  | { type: "refresh" };

export type WidgetNode =
  | { type: "column" | "row"; gap?: number; children: WidgetNode[] }
  | { type: "text"; text: string; style?: "title" | "body" | "caption" }
  | { type: "image"; source: string; alt?: string }
  | { type: "link"; label: string; urlBinding: string }
  | { type: "clock"; format: "12_hour" | "24_hour"; showDate?: boolean; showSeconds?: boolean }
  | { type: "metric"; label: string; valueBinding: string }
  | { type: "list"; source: string; maxItems: number }
  | { type: "divider" }
  | { type: "spacer"; sizeDp: number }
  | { type: "button"; label: string; action: WidgetAction };

export type WidgetDataItem = {
  title?: string;
  url?: string;
  repo?: string;
  number?: number;
  author?: string;
  updatedAt?: string;
  imageUrl?: string;
  imageData?: string;
  imageMimeType?: string;
};

export type WidgetSpec = {
  schemaVersion: 1 | 2 | 3 | 4;
  name: string;
  presentation: {
    theme: "light" | "dark" | "system";
    fontFamily?: "sans" | "serif" | "monospace";
    refreshMinutes: number;
    minWidthDp?: number;
    minHeightDp?: number;
  };
  dataSources: ({ id: string; connector: "github"; query: string } | { id: string; connector: "website"; query: "page"; url: string })[];
  root: WidgetNode;
};

export type WidgetReferenceImage = { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };

export function generateWidget(prompt: string, widgetId?: string, image?: WidgetReferenceImage): Promise<ApiResult<{ spec: WidgetSpec; generationRunId: string }>> {
  return call("/v1/widgets/generate", {
    method: "POST",
    body: { prompt, ...(widgetId ? { widgetId } : {}), ...(image ? { image } : {}) },
    timeoutMs: GENERATE_TIMEOUT_MS,
  });
}

export type DesignReview = { score: number; summary: string; strengths: string[]; improvements: string[] };

/** AI review of a structurally valid widget spec for glanceability, fit, and readability. */
export function validateWidgetDesign(spec: WidgetSpec): Promise<ApiResult<{ valid: true; review: DesignReview }>> {
  return call("/v1/widgets/validate-design", { method: "POST", body: { spec }, timeoutMs: GENERATE_TIMEOUT_MS });
}

export type WidgetComponent = { type: string; description: string; properties: string[] };

/** The same allowlisted component registry used by generation and spec validation. */
export function getWidgetComponents(): Promise<ApiResult<{
  components: WidgetComponent[];
  sizes: ("small" | "medium" | "large")[];
  themes: ("light" | "dark" | "system")[];
  fontFamilies: ("sans" | "serif" | "monospace")[];
  actions: ("open_url" | "open_app" | "refresh")[];
}>> {
  return call("/v1/widgets/components", { method: "GET" });
}

export type SavedWidget = { id: string; name: string; latestVersion: { spec: WidgetSpec } | null };
export type ConnectedAccount = {
  id: string;
  provider: "github";
  status: "active" | "pending" | "failed" | "expired";
  createdAt: string;
};

/** Connected accounts contain status only; provider credentials never reach the app. */
export function listConnectors(): Promise<ApiResult<{ connectors: ConnectedAccount[] }>> {
  return call("/v1/connectors", { method: "GET" });
}

/** Requests a one-time authorization URL from the backend for GitHub OAuth. */
export function connectGitHub(): Promise<ApiResult<{ authorizeUrl: string }>> {
  return call("/v1/connectors/github/connect", { method: "POST" });
}

export function disconnectConnector(connectorId: string): Promise<ApiResult<void>> {
  return call(`/v1/connectors/${encodeURIComponent(connectorId)}`, { method: "DELETE" });
}

/** Normalized connector data, keyed by data source id. */
export type WidgetDataMap = Record<string, {
  count: number;
  items: WidgetDataItem[];
  metadata?: {
    title: string;
    description: string;
    canonicalUrl: string;
    logoUrl: string;
    headings: string[];
    paragraphs: string[];
    pageText: string;
    truncated?: boolean;
    links: { title: string; url: string; imageUrl?: string }[];
    images: { url: string; alt: string; title: string }[];
    structuredData: { type: string; name: string; headline: string; description: string; url: string; author: string; datePublished: string; keywords: string; imageUrl: string }[];
  };
}>;

/** Saves a generated spec as a new widget (version 1). */
export function saveWidget(spec: WidgetSpec, generationRunId?: string): Promise<ApiResult<SavedWidget>> {
  return call("/v1/widgets", { method: "POST", body: { spec, generationRunId } });
}

/** Saves a generated follow-up as a new version of the active widget. */
export function saveWidgetVersion(widgetId: string, spec: WidgetSpec, generationRunId?: string): Promise<ApiResult<{ id: string; versionNumber: number }>> {
  return call(`/v1/widgets/${encodeURIComponent(widgetId)}/versions`, { method: "POST", body: { spec, generationRunId } });
}

export function getWidget(widgetId: string): Promise<ApiResult<SavedWidget>> {
  return call(`/v1/widgets/${widgetId}`, { method: "GET" });
}

/** Live data when an account is connected, otherwise sample data flagged `sample: true`. */
export function previewData(spec: WidgetSpec): Promise<ApiResult<{ data: WidgetDataMap; sample: boolean }>> {
  return call("/v1/widgets/preview-data", { method: "POST", body: { spec } });
}

/** Cached data for a saved widget; fails with CONNECTOR_REQUIRED until GitHub is connected. */
export function widgetData(widgetId: string, options: { refresh?: boolean } = {}): Promise<ApiResult<{ data: WidgetDataMap | null; lastError: string | null }>> {
  const query = options.refresh ? "?refresh=true" : "";
  return call(`/v1/widgets/${widgetId}/data${query}`, { method: "GET" });
}
