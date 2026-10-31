import { Platform } from "react-native";

import ComposerWidget from "@/home-screen-widget/composer-widget";
import { type SavedWidget } from "@/types/widget";
import { androidWidgetProfile, validateDocument, type WidgetDocument } from "@/widget-engine/document";
import { documentFor, emptyDocument } from "@/widget-engine/templates";

/**
 * The single point where app state crosses into the home-screen widget.
 *
 * Android has no timeline API, so the widget only changes when a document is pushed
 * here. Each document is checked against the Android profile first: an invalid one
 * is rejected in the app rather than rendering wrongly on the home screen.
 */
export function pushWidgetDocument(doc: WidgetDocument): boolean {
  if (Platform.OS !== "android") return false;

  const issues = validateDocument(doc, androidWidgetProfile);
  if (issues.length > 0) {
    if (__DEV__) console.warn("[widgets] document rejected", issues);
    return false;
  }

  try {
    ComposerWidget.updateSnapshot({ doc, state: doc.state });
    return true;
  } catch (error) {
    // A missing native module or no placed widget must not take the app down.
    if (__DEV__) console.warn("[widgets] snapshot update failed", error);
    return false;
  }
}

/** Mirrors the most recently saved widget, or the empty card when there is none. */
export function syncHomeScreenWidget(widgets: SavedWidget[]): void {
  pushWidgetDocument(widgets[0] ? documentFor(widgets[0]) : emptyDocument());
}
