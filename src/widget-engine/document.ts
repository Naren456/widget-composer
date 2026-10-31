/**
 * WidgetComposer Document (WCD) — the serialized UI format the render engine plays.
 *
 * Modelled on androidx Remote Compose: a widget is *created* as a data document on
 * the app side and *played* by a separate renderer on the surface that shows it. The
 * document carries layout, themed colours, named values, small integer state and the
 * actions that change it, so the surface never runs app code — it only interprets.
 *
 * Two players implement this format and must stay in step:
 *   - `src/home-screen-widget/composer-widget.tsx` — Android home screen (Jetpack Compose)
 *   - `src/widget-engine/player.tsx` — in-app React Native preview
 *
 * Bump `WCD_VERSION` for any change a v1 player could not render correctly. Players
 * skip node types they do not know, so additive node types do not need a bump.
 */

export const WCD_VERSION = 1;

/**
 * What a surface can draw. Mirrors Remote Compose profiles: the creator checks a
 * document against the target profile before shipping it, instead of the player
 * failing on device. Limits come from the expo-widgets Jetpack Compose subset.
 */
export const androidWidgetProfile = {
  id: "android-widget-v1",
  nodes: ["column", "row", "box", "text", "spacer", "button", "pick"],
  maxDepth: 10,
  maxNodes: 120,
  maxTextLength: 400,
} as const;

export type Profile = typeof androidWidgetProfile;

/** "#RRGGBB" / "#RRGGBBAA", or "@token" resolved against the document theme. */
export type ColorRef = string;

/** A colour that follows the surface's light/dark scheme. */
export type ThemedColor = { light: string; dark: string };

/** Which palette the player uses: fixed, or follow the surface (home screen) setting. */
export type ColorScheme = "light" | "dark" | "system";

/**
 * Modifiers map 1:1 onto the expo-widgets supported set (padding, size, fill,
 * background, corner radius). Anything else would be silently ignored on device,
 * so it is not expressible here at all.
 */
export type Modifiers = {
  /** All sides, or [start, top, end, bottom]. */
  pad?: number | [number, number, number, number];
  width?: number | "fill";
  height?: number | "fill";
  bg?: ColorRef;
  radius?: number;
};

export type Arrangement = "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly";
export type Alignment = "start" | "center" | "end";

/**
 * Text content is a template. `{{name}}` reads `values.name`, `{{#name}}` reads state
 * `name` as a number, and `{{$date}}` / `{{$time}}` are evaluated by the player when it
 * renders — the Remote Compose "remote value" idea, without baking a time into the doc.
 */
export type Template = string;

export type Action =
  /** Advance state `key` by one, wrapping at `count`. */
  | { do: "cycle"; key: string; count: number }
  /** Set state `key` to `value`. */
  | { do: "set"; key: string; value: number };

export type WidgetNode =
  | { type: "column"; mod?: Modifiers; gap?: number; arrange?: Arrangement; align?: Alignment; children: WidgetNode[] }
  | { type: "row"; mod?: Modifiers; gap?: number; arrange?: Arrangement; align?: Alignment; children: WidgetNode[] }
  | { type: "box"; mod?: Modifiers; align?: "topStart" | "center" | "bottomEnd"; children: WidgetNode[] }
  | {
      type: "text";
      mod?: Modifiers;
      text: Template;
      color?: ColorRef;
      size?: number;
      weight?: "400" | "500" | "600" | "700" | "800";
      lines?: number;
      align?: "start" | "center" | "end";
    }
  | { type: "spacer"; mod?: Modifiers }
  | { type: "button"; mod?: Modifiers; label: Template; action: Action }
  /** Shows the child at index `state[key]` — the document-side equivalent of `select`. */
  | { type: "pick"; key: string; children: WidgetNode[] };

export type WidgetDocument = {
  v: number;
  profile: Profile["id"];
  scheme: ColorScheme;
  theme: Record<string, ThemedColor>;
  values: Record<string, string>;
  /** Initial state; the player keeps the live copy and actions update it. */
  state: Record<string, number>;
  root: WidgetNode;
};

export type ValidationIssue = { path: string; message: string };

/**
 * Checks a document against a profile before it is shipped to a surface. Returns every
 * issue rather than the first, so a creator can report them all at once.
 */
export function validateDocument(doc: WidgetDocument, profile: Profile = androidWidgetProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (doc.v !== WCD_VERSION) issues.push({ path: "v", message: `unsupported version ${doc.v}` });
  if (doc.profile !== profile.id) issues.push({ path: "profile", message: `built for ${doc.profile}, not ${profile.id}` });

  let count = 0;
  const checkColor = (ref: ColorRef | undefined, path: string) => {
    if (ref === undefined) return;
    if (ref.startsWith("@")) {
      if (!doc.theme[ref.slice(1)]) issues.push({ path, message: `unknown theme token ${ref}` });
    } else if (!/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(ref)) {
      issues.push({ path, message: `bad colour ${ref}` });
    }
  };
  const checkTemplate = (text: Template, path: string) => {
    if (text.length > profile.maxTextLength) issues.push({ path, message: "text too long" });
    for (const [, sigil, name] of text.matchAll(/\{\{([#$]?)(\w+)\}\}/g)) {
      if (sigil === "" && !(name in doc.values)) issues.push({ path, message: `unknown value {{${name}}}` });
      if (sigil === "#" && !(name in doc.state)) issues.push({ path, message: `unknown state {{#${name}}}` });
      if (sigil === "$" && name !== "date" && name !== "time") issues.push({ path, message: `unknown variable {{$${name}}}` });
    }
  };

  const visit = (node: WidgetNode, path: string, depth: number) => {
    count += 1;
    if (depth > profile.maxDepth) issues.push({ path, message: "nested too deeply" });
    if (!(profile.nodes as readonly string[]).includes(node.type)) {
      issues.push({ path, message: `node "${node.type}" not in profile` });
      return;
    }
    if ("mod" in node) checkColor(node.mod?.bg, `${path}.mod.bg`);
    if (node.type === "text") {
      checkTemplate(node.text, `${path}.text`);
      checkColor(node.color, `${path}.color`);
    }
    if (node.type === "button") {
      checkTemplate(node.label, `${path}.label`);
      if (!(node.action.key in doc.state)) issues.push({ path, message: `action targets unknown state ${node.action.key}` });
    }
    if (node.type === "pick" && !(node.key in doc.state)) issues.push({ path, message: `pick reads unknown state ${node.key}` });
    if ("children" in node) node.children.forEach((child, i) => visit(child, `${path}.children[${i}]`, depth + 1));
  };

  visit(doc.root, "root", 1);
  if (count > profile.maxNodes) issues.push({ path: "root", message: `${count} nodes exceeds ${profile.maxNodes}` });
  return issues;
}
