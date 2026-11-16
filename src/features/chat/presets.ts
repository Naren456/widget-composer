/** Starter prompts in the ChatGPT pattern. Tapping one fills the composer; it never sends. */
type PresetPrompt = {
  request: string;
  layout: string;
  mood: string;
  palette: { background: string; surface: string; text: string; muted: string; accent: string; border: string };
  typography: string;
  imagery: string;
  data: string;
};

function presetPrompt(preset: PresetPrompt): string {
  const { palette } = preset;
  return [
    `Create a useful, glanceable Android home-screen widget. ${preset.request}`,
    "Use Material Design 3 widget styling: a clear type scale, comfortable spacing, rounded surface containers, subtle dividers, and one restrained primary accent. Treat background, surface, text, muted, accent, and border as surface, surface-container, on-surface, on-surface-variant, primary, and outline roles. Keep the requested palette and subject-specific mood.",
    `Layout: ${preset.layout}`,
    `Visual direction: ${preset.mood}`,
    `Palette: background ${palette.background}; surface ${palette.surface}; primary text ${palette.text}; muted text ${palette.muted}; accent ${palette.accent}; border ${palette.border}. Use the accent for one focal value or action, keep secondary labels subdued but readable, and maintain strong contrast.`,
    `Typography: ${preset.typography}`,
    `Image direction: ${preset.imagery}`,
    `Live data: ${preset.data}`,
    "Keep it compact with short labels. Use only registered widget components, providers, queries, and bindings. Bind every changing value to live data; never use example values as widget content, invent capabilities, add unsupported event listeners or conditional styling, or fill space with decoration.",
  ].join("\n");
}

export const suggestions = [
  {
    title: "Assigned issues",
    body: "live count and recent titles",
    prompt: presetPrompt({
      request: "Show the live number of issues assigned to me on GitHub and up to two recent issue titles with repository names.",
      layout: "Lead with the live issue count, then show at most two compact issue rows with repository names.",
      mood: "A focused graphite engineering dashboard with one warm orange accent and a calm, data-first feel.",
      palette: { background: "#101820", surface: "#1C2732", text: "#F4F7FA", muted: "#ABB8C4", accent: "#F4A261", border: "#34424F" },
      typography: "Use clean sans typography, a bold count, readable issue titles, and smaller muted repository labels.",
      imagery: "Do not use decorative or generated images; let the live count and issue list lead.",
      data: "Use GitHub assigned_issues. Bind the count to assigned_issues.count and each row to assigned_issues.items[i].title and repo.",
    }),
  },
  {
    title: "Open pull requests",
    body: "live count and recent titles",
    prompt: presetPrompt({
      request: "Show the live number of open pull requests I authored on GitHub and up to two recent PR titles with repository names.",
      layout: "Put the live count beside a short heading, then show at most two tidy pull-request rows.",
      mood: "A bright editorial workspace with warm paper, precise spacing, and an indigo count accent.",
      palette: { background: "#F6F5F2", surface: "#FFFFFF", text: "#202A36", muted: "#657180", accent: "#4F46E5", border: "#E3E5E8" },
      typography: "Use readable sans typography, a prominent bold count, and compact PR titles with smaller muted repository labels.",
      imagery: "Skip decorative imagery; use the live count and PR rows for hierarchy.",
      data: "Use GitHub open_pull_requests. Bind the count to open_pull_requests.count and every PR title and repository label to returned items.",
    }),
  },
  {
    title: "Review requests",
    body: "GitHub PRs needing your review",
    prompt: presetPrompt({
      request: "Show the live number of GitHub pull requests waiting for my review and up to two PR titles with repository names.",
      layout: "Make the live review-request count prominent, followed by at most two short PR rows.",
      mood: "A polished midnight-indigo workspace with a cool mint accent and restrained dividers.",
      palette: { background: "#17152A", surface: "#24213B", text: "#F8F6FF", muted: "#C3BDD8", accent: "#5EEAD4", border: "#3A3555" },
      typography: "Use sans typography, a bold count, readable PR titles, and small muted repository labels.",
      imagery: "Skip decorative images; use spacing and a subtle divider between live PRs.",
      data: "Use GitHub review_requests. Bind the count to review_requests.count and PR details to returned items.",
    }),
  },
  {
    title: "GitHub overview",
    body: "issues and pull requests",
    prompt: presetPrompt({
      request: "Show my live assigned GitHub issue count and open pull-request count, with one recent title from each when available.",
      layout: "Show the two live counts side by side or stacked, then one compact issue row and one compact pull-request row.",
      mood: "A crisp light productivity dashboard with cool blue-gray surfaces and a confident cobalt accent.",
      palette: { background: "#F2F6FC", surface: "#FFFFFF", text: "#172B4D", muted: "#586B82", accent: "#2864DC", border: "#D8E1EE" },
      typography: "Use clean sans typography, bold counts, and smaller readable titles with muted repository labels.",
      imagery: "Do not add artwork; keep both live counts and their matching rows easy to scan.",
      data: "Use two GitHub sources: assigned_issues and open_pull_requests. Bind each count and title to its matching source; do not invent values.",
    }),
  },
  {
    title: "Local clock",
    body: "live time and date",
    prompt: presetPrompt({
      request: "Show the current device-local time in 24-hour format and the current weekday and date.",
      layout: "Make the live time the focal point, with the weekday and date on one smaller line below.",
      mood: "A quiet midnight observatory with deep navy, cool pale text, and a restrained golden accent.",
      palette: { background: "#0B1220", surface: "#121C2D", text: "#F4F7FB", muted: "#A7B3C4", accent: "#F6C85F", border: "#29364A" },
      typography: "Use crisp monospace numerals for the time and smaller, readable type for the date.",
      imagery: "Do not add images; keep the live time as the clear focal point.",
      data: "Use the on-device clock component. Never hard-code the time or date.",
    }),
  },
  {
    title: "Battery status",
    body: "live charge and charging state",
    prompt: presetPrompt({
      request: "Show the device's live battery percentage, a level bar, and current charging state.",
      layout: "Place a large percentage above a slim progress bar, with charging state on a short caption line.",
      mood: "An understated forest-night power panel with a vivid lime accent and soft green-black surfaces.",
      palette: { background: "#0E1714", surface: "#17231E", text: "#F2F6F2", muted: "#A8B8AD", accent: "#B8F36B", border: "#2A3B32" },
      typography: "Use a bold sans percentage, with concise charging text and a quieter caption.",
      imagery: "Use the native progress bar as the battery visual; do not generate a battery image.",
      data: "Read on-device battery_level and battery_status only. Bind the progress bar to battery_level and the status text to battery_status.",
    }),
  },
  {
    title: "Battery meter",
    body: "minimal live charge display",
    prompt: presetPrompt({
      request: "Create a minimal live battery meter with the percentage and a horizontal level bar; include a short charging label.",
      layout: "Center the percentage in a white card and use one wide progress bar beneath it.",
      mood: "Warm modern hardware design with porcelain surfaces, ink-like text, and a precise tangerine accent.",
      palette: { background: "#FCF7F2", surface: "#FFFFFF", text: "#2B2724", muted: "#766D67", accent: "#D95D39", border: "#EAE1D8" },
      typography: "Use bold sans numerals for the percentage and smaller muted text for charging status.",
      imagery: "Let the progress bar be the battery graphic; do not add an icon or illustration.",
      data: "Use on-device battery_level and battery_status. Bind the bar to battery_level and the label to battery_status.",
    }),
  },
  {
    title: "Power overview",
    body: "battery and saver status",
    prompt: presetPrompt({
      request: "Show live battery percentage, charging state, and whether Battery Saver is enabled.",
      layout: "Show the percentage with a slim progress bar, then compact rows for charging and Battery Saver status.",
      mood: "A calm daylight energy panel with pale sage surfaces, deep botanical text, and a fresh green accent.",
      palette: { background: "#EFF6F1", surface: "#FFFFFF", text: "#18352A", muted: "#587166", accent: "#2F855A", border: "#D6E5DA" },
      typography: "Use legible sans typography, a bold percentage, and short labels with easy-to-scan live values.",
      imagery: "Use the native progress bar and restrained color; do not add decorative icons or artwork.",
      data: "Read on-device battery_level, battery_status, and power_saver only. Bind each value to its matching device metric.",
    }),
  },
  {
    title: "Hacker News",
    body: "live community headlines",
    prompt: presetPrompt({
      request: "Create a live Hacker News widget from https://news.ycombinator.com with the source name and up to two current story titles.",
      layout: "Put a small source header above at most two compact story rows; keep titles readable and concise.",
      mood: "A contemporary newspaper card with warm paper, restrained ink, and a small rust-orange editorial marker.",
      palette: { background: "#F6F2E9", surface: "#FFFCF5", text: "#29251E", muted: "#736B5E", accent: "#B54A2D", border: "#E6DDCB" },
      typography: "Use readable serif story titles and small sans-serif source labels. Keep the accent for the source marker.",
      imagery: "Use a real story thumbnail only when available; do not generate logos or artwork.",
      data: "Use news.latest_items for this URL. Bind story titles and links to returned news items; do not make titles static.",
    }),
  },
  {
    title: "YouTube channel",
    body: "live channel details and shortcut",
    prompt: presetPrompt({
      request: "Create a compact channel card for https://www.youtube.com/@YouTube with the live channel name, a short description, and a link to open the channel.",
      layout: "Show the channel mark beside its name, a short description beneath, and one clear open-channel action.",
      mood: "A clean charcoal media card with bright text and one restrained red accent.",
      palette: { background: "#111315", surface: "#202326", text: "#F5F5F5", muted: "#B7BDC4", accent: "#FF3D3D", border: "#353A3F" },
      typography: "Use a bold sans channel name, regular short description, and concise accent-colored action label.",
      imagery: "Use only the channel's actual website image if available. Do not invent an avatar, statistics, or uploads.",
      data: "Use the website page source. Bind the name, description, and image to its returned item fields, and open only the returned source URL.",
    }),
  },
  {
    title: "XDA Developers",
    body: "live tech headlines and story",
    prompt: presetPrompt({
      request: "Create a live tech-news widget for https://www.xda-developers.com/ with the publisher name, newest story headline, short summary, and a relevant thumbnail when available.",
      layout: "Show a compact publisher header and one lead-story card with a bold headline, up to two summary lines, and one thumbnail when available.",
      mood: "A crisp technology editorial card with cool white surfaces, midnight-blue type, and an electric-blue accent.",
      palette: { background: "#F4F7FB", surface: "#FFFFFF", text: "#1D2A3A", muted: "#64748B", accent: "#2563EB", border: "#DCE4EF" },
      typography: "Use a bold sans headline, regular short summary, and small muted publisher label.",
      imagery: "Use only a real story thumbnail returned by the source. Never invent an image; omit it when unavailable.",
      data: "Use news.latest_items for this publisher URL. Bind the headline, summary, publisher, and image to the newest returned item; never hard-code story content.",
    }),
  },
];
