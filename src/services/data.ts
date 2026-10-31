import { deviceId } from "@/features/agent/device-id";
import { type DataFetchResult, type DataSource } from "@/types/data-source";
import { type SavedWidget } from "@/types/widget";

const TIMEOUT_MS = 20_000;

/**
 * Fetches fresh values for a data source (POST /api/data). The server holds any
 * credentials and enforces the network policy; the app only sends the source.
 * Never throws — failures come back as a result the UI can explain.
 */
export async function fetchWidgetData(source: DataSource): Promise<DataFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: deviceId(), source }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as DataFetchResult | null;
    if (body && typeof body === "object" && "ok" in body) return body;
    return { ok: false, reason: "upstream", message: `The server returned ${response.status}.` };
  } catch {
    return { ok: false, reason: "unreachable", message: "Couldn't reach the server." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Re-fetches a widget's values and returns the updated widget. Names the response did
 * not contain keep their previous value rather than going blank.
 */
export async function refreshWidget(
  widget: SavedWidget,
): Promise<{ ok: true; widget: SavedWidget; missing: string[] } | Extract<DataFetchResult, { ok: false }>> {
  if (!widget.dataSource || !widget.document) {
    return { ok: false, reason: "invalid", message: "This widget has no data source." };
  }
  const result = await fetchWidgetData(widget.dataSource);
  if (!result.ok) return result;
  const document = { ...widget.document, values: { ...widget.document.values, ...result.values } };
  return { ok: true, widget: { ...widget, document, refreshedAt: result.fetchedAt }, missing: result.missing };
}
