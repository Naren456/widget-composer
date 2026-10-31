import { type SavedWidget } from "@/types/widget";
import { type WidgetDocument } from "@/widget-engine/document";

/**
 * Web has no home-screen widget. This stub keeps the Jetpack Compose widget module,
 * which crashes outside Android, out of the web bundle entirely.
 */
export function pushWidgetDocument(_doc: WidgetDocument): boolean {
  return false;
}

export function syncHomeScreenWidget(_widgets: SavedWidget[]): void {}
