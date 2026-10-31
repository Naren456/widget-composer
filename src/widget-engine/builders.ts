import {
  androidWidgetProfile,
  type Action,
  type ColorScheme,
  type ThemedColor,
  WCD_VERSION,
  type WidgetDocument,
  type WidgetNode,
} from "@/widget-engine/document";

/**
 * Creation DSL. Builds plain WCD objects so templates read like a layout tree,
 * the way Remote Compose's creation API mirrors Compose.
 */

type NodeOf<T extends WidgetNode["type"]> = Extract<WidgetNode, { type: T }>;
type Options<T extends WidgetNode["type"]> = Omit<NodeOf<T>, "type" | "children">;

export const column = (opts: Options<"column">, children: WidgetNode[]): WidgetNode => ({
  type: "column",
  ...opts,
  children,
});

export const row = (opts: Options<"row">, children: WidgetNode[]): WidgetNode => ({ type: "row", ...opts, children });

export const box = (opts: Options<"box">, children: WidgetNode[]): WidgetNode => ({ type: "box", ...opts, children });

export const text = (value: string, opts: Omit<Options<"text">, "text"> = {}): WidgetNode => ({
  type: "text",
  text: value,
  ...opts,
});

export const spacer = (opts: Options<"spacer"> = {}): WidgetNode => ({ type: "spacer", ...opts });

export const button = (label: string, action: Action, opts: Omit<Options<"button">, "label" | "action"> = {}): WidgetNode => ({
  type: "button",
  label,
  action,
  ...opts,
});

export const pick = (key: string, children: WidgetNode[]): WidgetNode => ({ type: "pick", key, children });

export function createDocument(parts: {
  scheme: ColorScheme;
  theme: Record<string, ThemedColor>;
  values?: Record<string, string>;
  state?: Record<string, number>;
  root: WidgetNode;
}): WidgetDocument {
  return {
    v: WCD_VERSION,
    profile: androidWidgetProfile.id,
    scheme: parts.scheme,
    theme: parts.theme,
    values: parts.values ?? {},
    state: parts.state ?? {},
    root: parts.root,
  };
}
