import { Box, Button, Column, Row, Spacer, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  cornerRadius,
  fillMaxHeight,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

import type { Action, Modifiers, WidgetDocument, WidgetNode } from "@/widget-engine/document";

/**
 * Android home-screen player for WidgetComposer Documents (see `widget-engine/document.ts`).
 *
 * The app *creates* a document and pushes it with `updateSnapshot`; this function only
 * *plays* it, in the spirit of Remote Compose. It runs in expo-widgets' isolated runtime,
 * where only this function's body exists — so every helper lives inside it, and the
 * semantics are a copy of `widget-engine/semantics.ts`, checked by
 * `scripts/check-widget-player.mjs`. Keep the two in step.
 *
 * Buttons return the next props, which the runtime renders straight away: document
 * actions such as paging therefore work on the home screen without the app running.
 */

export type ComposerWidgetProps = {
  /** Null until the app has composed something; the player then shows its own card. */
  doc: WidgetDocument | null;
  /** Live state; actions replace it. Falls back to the document's initial state. */
  state?: Record<string, number>;
};

const ComposerWidget = (props: ComposerWidgetProps, environment: WidgetEnvironment) => {
  "widget";
  const doc = props.doc;
  const surface = environment && environment.colorScheme === "light" ? "light" : "dark";
  const now = environment && environment.date ? environment.date : new Date();

  // No document, or one from a newer format: show a built-in card instead of guessing.
  if (!doc || doc.v !== 1 || !doc.root) {
    return (
      <Column
        modifiers={[fillMaxSize(), background("#070C09"), cornerRadius(20), paddingAll(14)]}
        verticalArrangement="spaceBetween"
      >
        <Text color="#FFFFFF" maxLines={2} style={{ fontSize: 20, fontWeight: "700" }}>
          Open WidgetComposer
        </Text>
        <Text color="#A6EF5C" maxLines={1} style={{ fontSize: 11, fontWeight: "500" }}>
          Compose your first widget
        </Text>
      </Column>
    );
  }

  const scheme = doc.scheme === "system" ? surface : doc.scheme;
  const state = props.state || doc.state || {};

  function color(ref: string | undefined): string | undefined {
    if (!ref) return undefined;
    if (ref.charAt(0) !== "@") return ref;
    const token = doc!.theme[ref.slice(1)];
    return token ? token[scheme] : "#00000000";
  }

  function two(n: number): string {
    return n < 10 ? "0" + n : String(n);
  }

  function fill(text: string): string {
    return text.replace(/\{\{([#$]?)(\w+)\}\}/g, function (_: string, sigil: string, name: string) {
      if (sigil === "#") return String(state[name] || 0);
      if (sigil === "$") {
        if (name === "time") return two(now.getHours()) + ":" + two(now.getMinutes());
        if (name === "date") {
          const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
          const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          return days[now.getDay()] + ", " + months[now.getMonth()] + " " + now.getDate();
        }
        return "";
      }
      const value = doc!.values[name];
      return value === undefined ? "" : value;
    });
  }

  function act(action: Action): ComposerWidgetProps {
    const next: Record<string, number> = {};
    for (const key in state) next[key] = state[key];
    if (action.do === "cycle") next[action.key] = ((state[action.key] || 0) + 1) % Math.max(1, action.count);
    else next[action.key] = action.value;
    return { doc: doc, state: next };
  }

  // Order matters in Compose: size, then background and corners, then inner padding.
  function mods(m: Modifiers | undefined) {
    const out: ReturnType<typeof paddingAll>[] = [];
    if (!m) return out;
    if (m.width === "fill" && m.height === "fill") out.push(fillMaxSize());
    else {
      if (m.width === "fill") out.push(fillMaxWidth());
      else if (typeof m.width === "number") out.push(width(m.width));
      if (m.height === "fill") out.push(fillMaxHeight());
      else if (typeof m.height === "number") out.push(height(m.height));
    }
    if (m.bg) out.push(background(color(m.bg)!));
    if (typeof m.radius === "number") out.push(cornerRadius(m.radius));
    if (typeof m.pad === "number") out.push(paddingAll(m.pad));
    else if (m.pad) out.push(padding(m.pad[0], m.pad[1], m.pad[2], m.pad[3]));
    return out;
  }

  function mainAxis(arrange: string | undefined, gap: number | undefined, vertical: boolean) {
    if (arrange === "start") return vertical ? "top" : "start";
    if (arrange === "end") return vertical ? "bottom" : "end";
    if (arrange) return arrange;
    return gap ? { spacedBy: gap } : undefined;
  }

  function render(node: WidgetNode, key: string): React.JSX.Element | null {
    if (node.type === "column") {
      return (
        <Column
          key={key}
          modifiers={mods(node.mod)}
          verticalArrangement={mainAxis(node.arrange, node.gap, true) as never}
          horizontalAlignment={node.align}
        >
          {node.children.map(function (child, i) {
            return render(child, key + "." + i);
          })}
        </Column>
      );
    }
    if (node.type === "row") {
      const cross = node.align === "start" ? "top" : node.align === "end" ? "bottom" : node.align;
      return (
        <Row
          key={key}
          modifiers={mods(node.mod)}
          horizontalArrangement={mainAxis(node.arrange, node.gap, false) as never}
          verticalAlignment={cross}
        >
          {node.children.map(function (child, i) {
            return render(child, key + "." + i);
          })}
        </Row>
      );
    }
    if (node.type === "box") {
      return (
        <Box key={key} modifiers={mods(node.mod)} contentAlignment={node.align}>
          {node.children.map(function (child, i) {
            return render(child, key + "." + i);
          })}
        </Box>
      );
    }
    if (node.type === "text") {
      return (
        <Text
          key={key}
          modifiers={mods(node.mod)}
          color={color(node.color)}
          maxLines={node.lines}
          overflow="ellipsis"
          style={{ fontSize: node.size, fontWeight: node.weight, textAlign: node.align }}
        >
          {fill(node.text)}
        </Text>
      );
    }
    if (node.type === "spacer") {
      return <Spacer key={key} modifiers={mods(node.mod)} />;
    }
    if (node.type === "button") {
      const action = node.action;
      return (
        <Button
          key={key}
          modifiers={mods(node.mod)}
          onClick={function () {
            return act(action) as never;
          }}
        >
          <Text>{fill(node.label)}</Text>
        </Button>
      );
    }
    if (node.type === "pick") {
      const count = node.children.length;
      if (count === 0) return null;
      const raw = Math.trunc(state[node.key] || 0);
      const index = ((raw % count) + count) % count;
      return render(node.children[index], key + ".p" + index);
    }
    // Unknown node types are skipped so newer documents degrade instead of failing.
    return null;
  }

  return render(doc.root, "r") ?? <Spacer />;
};

export default createWidget<ComposerWidgetProps>("ComposerWidget", ComposerWidget, { doc: null });
