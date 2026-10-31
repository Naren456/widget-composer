import { widgetDate, widgetTime } from "@/utils/time";
import { type Action, type ColorRef, type WidgetDocument } from "@/widget-engine/document";

/**
 * Reference semantics for WCD. The in-app player imports these; the Android player
 * cannot import anything (its body is serialized), so it carries a copy that
 * `scripts/check-widget-player.mjs` verifies against these functions.
 */

export type ResolvedScheme = "light" | "dark";

export function resolveScheme(doc: WidgetDocument, surface: ResolvedScheme): ResolvedScheme {
  return doc.scheme === "system" ? surface : doc.scheme;
}

/** Theme tokens resolve per scheme; unknown tokens fall back to transparent rather than crashing. */
export function resolveColor(doc: WidgetDocument, ref: ColorRef | undefined, scheme: ResolvedScheme): string | undefined {
  if (!ref) return undefined;
  if (!ref.startsWith("@")) return ref;
  const token = doc.theme[ref.slice(1)];
  return token ? token[scheme] : "#00000000";
}

/** Fills `{{value}}`, `{{#state}}` and the player variables `{{$date}}` / `{{$time}}`. */
export function renderTemplate(
  doc: WidgetDocument,
  text: string,
  state: Record<string, number>,
  now: Date,
): string {
  return text.replace(/\{\{([#$]?)(\w+)\}\}/g, (_, sigil: string, name: string) => {
    if (sigil === "#") return String(state[name] ?? 0);
    if (sigil === "$") {
      if (name === "time") return widgetTime(now);
      if (name === "date") return widgetDate(now);
      return "";
    }
    return doc.values[name] ?? "";
  });
}

export function applyAction(state: Record<string, number>, action: Action): Record<string, number> {
  const next = Object.assign({}, state);
  if (action.do === "cycle") next[action.key] = ((state[action.key] ?? 0) + 1) % Math.max(1, action.count);
  else next[action.key] = action.value;
  return next;
}

/** Index of the child a `pick` node shows, clamped so a stale state never renders nothing. */
export function pickIndex(state: Record<string, number>, key: string, childCount: number): number {
  if (childCount === 0) return -1;
  const raw = Math.trunc(state[key] ?? 0);
  return ((raw % childCount) + childCount) % childCount;
}
