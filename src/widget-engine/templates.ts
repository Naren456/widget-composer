import { colors } from "@/theme/tokens";
import { type GitHubStats } from "@/types/github";
import { hostFromUrl, type SavedWidget } from "@/types/widget";
import { box, button, column, createDocument, pick, row, spacer, text } from "@/widget-engine/builders";
import { type ThemedColor, type WidgetDocument, type WidgetNode } from "@/widget-engine/document";

/** App palette as themed colours, so one document renders correctly in either scheme. */
const theme: Record<string, ThemedColor> = {
  bg: { light: "#F2F5EF", dark: colors.background },
  surface: { light: "#E4EAE0", dark: colors.surface },
  text: { light: "#0B120D", dark: colors.text },
  muted: { light: "#4B554D", dark: colors.textMuted },
  brand: { light: "#3E8E1F", dark: colors.brand },
  merged: { light: "#6D4BD8", dark: "#A78BFA" },
  onBadge: { light: "#FFFFFF", dark: "#FFFFFF" },
};

const badgeColors = ["#22C55E", "#F97316", "#EF4444", "#3B82F6", "#A855F7", "#EAB308", "#14B8A6"];

/** Source badge colour, picked by hostname so a site keeps its colour everywhere. */
export function badgeColor(host: string): string {
  let hash = 0;
  for (let i = 0; i < host.length; i++) hash = (hash * 31 + host.charCodeAt(i)) >>> 0;
  return badgeColors[hash % badgeColors.length];
}

const card = (children: WidgetNode[]) =>
  column({ mod: { width: "fill", height: "fill", bg: "@bg", radius: 20, pad: 14 }, arrange: "spaceBetween" }, children);

/**
 * A website widget. No site content is fetched yet, so the body is the user's request
 * — the document never claims headlines it does not have.
 */
export function websiteDocument(widget: SavedWidget): WidgetDocument {
  const host = hostFromUrl(widget.url);
  return createDocument({
    scheme: widget.theme,
    theme,
    values: {
      name: widget.name,
      host,
      initial: widget.name.charAt(0).toUpperCase(),
      description: widget.description || `Updates from ${host}`,
    },
    root: card([
      row({ gap: 8, align: "center" }, [
        box({ mod: { width: 22, height: 22, bg: badgeColor(host), radius: 6 }, align: "center" }, [
          text("{{initial}}", { color: "@onBadge", size: 12, weight: "800" }),
        ]),
        text("{{name}}", { color: "@text", size: 14, weight: "600", lines: 1 }),
      ]),
      text("{{description}}", { color: "@text", size: 13, lines: 3 }),
      row({ mod: { width: "fill" }, arrange: "spaceBetween", align: "center" }, [
        text("{{host}}", { color: "@muted", size: 11, lines: 1 }),
        text("{{$date}}", { color: "@muted", size: 10, weight: "600" }),
      ]),
    ]),
  });
}

/**
 * The document a saved widget renders: the agent's own when it built one, otherwise
 * the website template. The widget's light/dark choice always wins over the scheme.
 */
export function documentFor(widget: SavedWidget): WidgetDocument {
  return widget.document ? { ...widget.document, scheme: widget.theme } : websiteDocument(widget);
}

/** Placeholder shown before anything has been composed. */
export function emptyDocument(): WidgetDocument {
  return createDocument({
    scheme: "system",
    theme,
    root: card([
      text("{{$date}}", { color: "@muted", size: 10, weight: "600" }),
      text("Open WidgetComposer", { color: "@text", size: 20, weight: "700", lines: 2 }),
      text("Compose your first widget", { color: "@brand", size: 11, weight: "500" }),
    ]),
  });
}

/**
 * GitHub pull requests from real API data. Recent PRs page in place with the Next
 * button: the action and its state live in the document, so paging works on the
 * home screen without the app running.
 */
export function githubDocument(stats: GitHubStats): WidgetDocument {
  const recent = stats.recent.slice(0, 5);
  const values: Record<string, string> = {
    login: stats.login,
    open: String(stats.pullRequests.open),
    merged: String(stats.pullRequests.merged),
    closed: String(stats.pullRequests.closed),
    // Fetch time is baked in: {{$time}} would show when the widget was drawn, not when the data is from.
    updated: new Date(stats.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
  recent.forEach((pr, i) => {
    values[`pr${i}`] = pr.title;
    values[`pr${i}meta`] = `${pr.repo} · ${pr.state} · ${i + 1}/${recent.length}`;
  });

  const count = (key: string, label: string, color: string) =>
    column({ gap: 0 }, [
      text(`{{${key}}}`, { color, size: 18, weight: "700" }),
      text(label, { color: "@muted", size: 9, weight: "600" }),
    ]);

  return createDocument({
    scheme: "system",
    theme,
    values,
    state: { pr: 0 },
    root: card([
      row({ mod: { width: "fill" }, arrange: "spaceBetween", align: "center" }, [
        text("GitHub · {{login}}", { color: "@text", size: 13, weight: "700", lines: 1 }),
        row({ gap: 12 }, [
          count("open", "OPEN", "@brand"),
          count("merged", "MERGED", "@merged"),
          count("closed", "CLOSED", "@muted"),
        ]),
      ]),
      recent.length > 0
        ? pick(
            "pr",
            recent.map((_, i) =>
              column({ gap: 2 }, [
                text(`{{pr${i}}}`, { color: "@text", size: 13, weight: "500", lines: 2 }),
                text(`{{pr${i}meta}}`, { color: "@muted", size: 10, lines: 1 }),
              ]),
            ),
          )
        : text("No recent pull requests", { color: "@muted", size: 12 }),
      row({ mod: { width: "fill" }, arrange: "spaceBetween", align: "center" }, [
        text("Updated {{updated}}", { color: "@muted", size: 10 }),
        recent.length > 1 ? button("Next", { do: "cycle", key: "pr", count: recent.length }) : spacer(),
      ]),
    ]),
  });
}
