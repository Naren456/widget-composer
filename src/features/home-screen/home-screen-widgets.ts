import { homeScreenWidgets } from "../../../modules/widget-runtime";
import { getWidget, previewData, saveWidget, widgetData, type WidgetDataMap, type WidgetSpec } from "@/services/widget-api";

/**
 * Puts generated widgets on the Android home screen (native module
 * `modules/widget-runtime`) and keeps the placed ones' data fresh. The widget itself
 * never calls the API: the app fetches data and hands it over.
 */

export type PlaceOutcome =
  | { kind: "prompted" }
  | { kind: "manual" }
  | { kind: "updated" }
  | { kind: "unsupported" }
  | { kind: "failed"; message: string };

/** Saves the spec on the server, stores it with data for the widget, and asks the launcher to add it. */
export async function addToHomeScreen(
  spec: WidgetSpec,
  generationRunId?: string,
  preview?: { data: WidgetDataMap | null; sample: boolean },
  widgetId?: string,
): Promise<PlaceOutcome> {
  const saved = widgetId ? await getWidget(widgetId) : await saveWidget(spec, generationRunId);
  if (!saved.ok) return { kind: "failed", message: saved.message };

  const currentSpec = saved.data.latestVersion?.spec ?? spec;

  if (!homeScreenWidgets) return { kind: "unsupported" };

  let data = widgetId ? null : preview?.data ?? null;
  let sample = widgetId ? false : preview?.sample ?? false;
  if (widgetId || !preview) {
    const resolvedPreview = await previewData(currentSpec);
    if (resolvedPreview.ok) {
      data = resolvedPreview.data.data;
      sample = resolvedPreview.data.sample;
    }
  }
  const payload = {
    id: saved.data.id,
    spec: currentSpec,
    data,
    sample,
    updatedAt: new Date().toISOString(),
  };

  try {
    homeScreenWidgets.save(payload);
    return homeScreenWidgets.requestPin(saved.data.id) ? { kind: "prompted" } : { kind: "manual" };
  } catch (error) {
    return { kind: "failed", message: error instanceof Error ? error.message : "The Android widget could not be updated." };
  }
}

/** Refetches data for every widget on the home screen. Failures keep the data already shown. */
export async function refreshPlacedWidgets(options: { widgetId?: string; force?: boolean } = {}): Promise<void> {
  if (!homeScreenWidgets) return;
  const placedIds = homeScreenWidgets.placedWidgetIds();
  const targetIds = options.widgetId ? placedIds.filter((id) => id === options.widgetId) : placedIds;
  for (const id of targetIds) {
    const widget = await getWidget(id);
    const spec = widget.ok ? widget.data.latestVersion?.spec : undefined;
    if (!spec) continue;

    const live = await widgetData(id, { refresh: options.force });
    if (live.ok && live.data.data) {
      homeScreenWidgets.save({ id, spec, data: live.data.data, sample: false, updatedAt: new Date().toISOString() });
      continue;
    }
    // Not connected yet: show sample data, flagged as such, rather than nothing.
    if (!live.ok && live.code === "CONNECTOR_REQUIRED") {
      const preview = await previewData(spec);
      if (preview.ok) {
        homeScreenWidgets.save({ id, spec, data: preview.data.data, sample: preview.data.sample, updatedAt: new Date().toISOString() });
      }
    }
  }
}

/** Redraws an already placed widget after a chat edit without opening the pin prompt again. */
export function syncPlacedWidget(
  widgetId: string,
  spec: WidgetSpec,
  data: WidgetDataMap,
  sample: boolean,
): boolean {
  if (!homeScreenWidgets || !homeScreenWidgets.placedWidgetIds().includes(widgetId)) return false;
  try {
    homeScreenWidgets.save({ id: widgetId, spec, data, sample, updatedAt: new Date().toISOString() });
    return true;
  } catch {
    return false;
  }
}
