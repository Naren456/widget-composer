#!/usr/bin/env node
/**
 * Conformance check for the Android widget player.
 *
 * The home-screen player (`src/home-screen-widget/composer-widget.tsx`) is serialized
 * by babel-preset-expo and eval'd inside expo-widgets' runtime, so it cannot import the
 * reference semantics in `src/widget-engine/semantics.ts` and carries a copy instead.
 * This script keeps the two honest:
 *
 *   1. compiles the player exactly as Metro does for Android and extracts the string;
 *   2. evaluates it in a bare `vm` context holding only the runtime's globals, so any
 *      reference to module scope (or a Babel helper) fails loudly;
 *   3. plays every template and compares each text and colour with the reference;
 *   4. presses buttons and checks the returned state matches `applyAction`.
 *
 * Run: node scripts/check-widget-player.mjs
 */
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import vm from "node:vm";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(join(root, "package.json"));
const babel = require("@babel/core");
const preset = require.resolve("babel-preset-expo");

const compile = (file) =>
  babel.transformFileSync(file, {
    cwd: root,
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [preset],
    caller: { name: "metro", platform: "android", bundler: "metro", isDev: true, supportsStaticESM: false },
  }).code;

// --- Minimal CommonJS loader for the app's TS modules (resolves the "@/" alias). ---
const cache = new Map();
function resolveModule(request, from) {
  if (!request.startsWith("@/") && !request.startsWith(".")) return null;
  const base = request.startsWith("@/") ? join(root, "src", request.slice(2)) : resolve(dirname(from), request);
  for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(base + ext)) return base + ext;
  return null;
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const local = (request) => {
    const target = resolveModule(request, file);
    if (target) return load(target);
    if (request === "react-native") return { Platform: { OS: "android" } };
    return require(request);
  };
  new Function("require", "module", "exports", compile(file))(local, module, module.exports);
  return module.exports;
}

const { validateDocument, androidWidgetProfile } = load(join(root, "src/widget-engine/document.ts"));
const semantics = load(join(root, "src/widget-engine/semantics.ts"));
const templates = load(join(root, "src/widget-engine/templates.ts"));

// --- Extract the serialized player. ---
const compiled = compile(join(root, "src/home-screen-widget/composer-widget.tsx"));
const match = compiled.match(/createWidget\)?\(\s*"ComposerWidget",\s*`([\s\S]*?)`\s*,/) ?? compiled.match(/`(function\([\s\S]*?)`/);
if (!match) throw new Error("could not find the serialized widget function");
// Re-cook the template literal the way the app does at runtime.
const layoutSource = new Function("return `" + match[1] + "`")();

// --- Runtime stand-ins: exactly the globals expo-widgets provides to layouts. ---
const element = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
const modifier = (name) => (...args) => ({ $m: name, args });
const sandbox = {
  _jsx: element,
  _jsxs: element,
  jsx: element,
  jsxs: element,
  React: {},
  ...Object.fromEntries(["Box", "Button", "Column", "Row", "Spacer", "Text"].map((n) => [n, n])),
  ...Object.fromEntries(
    ["background", "cornerRadius", "fillMaxHeight", "fillMaxSize", "fillMaxWidth", "height", "padding", "paddingAll", "width"].map(
      (n) => [n, modifier(n)],
    ),
  ),
};
const context = vm.createContext(sandbox);
const layout = vm.runInContext("(" + layoutSource + ")", context);

// --- Walk a rendered tree into comparable facts. ---
function facts(node, out = { texts: [], buttons: [] }) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => facts(n, out));
    return out;
  }
  if (node.type === "Text") {
    const children = node.props.children;
    if (typeof children === "string") out.texts.push({ text: children, color: node.props.color });
  }
  if (node.type === "Button") out.buttons.push(node);
  facts(node.props.children, out);
  return out;
}

// Reference rendering straight from the document, using the shared semantics.
function expected(doc, state, scheme, now, out = []) {
  const walk = (node) => {
    if (node.type === "text") {
      out.push({
        text: semantics.renderTemplate(doc, node.text, state, now),
        color: semantics.resolveColor(doc, node.color, scheme),
      });
    } else if (node.type === "pick") {
      const i = semantics.pickIndex(state, node.key, node.children.length);
      if (i >= 0) walk(node.children[i]);
    } else if (node.type === "button") {
      // Button labels render as an uncoloured Text child.
      out.push({ text: semantics.renderTemplate(doc, node.label, state, now), color: undefined });
    } else if (node.children) node.children.forEach(walk);
  };
  walk(doc.root);
  return out;
}

const now = new Date(2026, 9, 29, 9, 41);
const stats = {
  login: "octocat",
  name: "The Octocat",
  avatarUrl: "",
  publicRepos: 8,
  followers: 10,
  pullRequests: { open: 2, merged: 14, closed: 3, total: 19 },
  recent: [
    { id: 1, title: "Fix widget sizing", repo: "app", state: "merged", updatedAt: "", url: "" },
    { id: 2, title: "Add pager", repo: "app", state: "open", updatedAt: "", url: "" },
    { id: 3, title: "Docs", repo: "site", state: "closed", updatedAt: "", url: "" },
  ],
  activity: { currentStreak: 0, longestStreak: 0, activeDays: 0, lastActive: null, windowDays: 90 },
  fetchedAt: now.getTime(),
};
const cases = [
  ["empty", templates.emptyDocument()],
  [
    "website (dark)",
    templates.websiteDocument({ id: "w", name: "Techcrunch", url: "https://techcrunch.com/", description: "Latest headlines", theme: "dark", createdAt: 0 }),
  ],
  [
    "website (light)",
    templates.websiteDocument({ id: "w", name: "Blog", url: "https://blog.google/", description: "", theme: "light", createdAt: 0 }),
  ],
  ["github", templates.githubDocument(stats)],
];

let failures = 0;
const fail = (label, message) => {
  failures += 1;
  console.error(`  ✗ ${label}: ${message}`);
};

for (const [label, doc] of cases) {
  const issues = validateDocument(doc, androidWidgetProfile);
  if (issues.length) fail(label, `invalid document: ${JSON.stringify(issues)}`);

  for (const surface of ["light", "dark"]) {
    const scheme = semantics.resolveScheme(doc, surface);
    let state = doc.state;
    // Render, then press every button once and render again.
    for (let round = 0; round < 3; round++) {
      const tree = layout({ doc, state }, { colorScheme: surface, date: now });
      const got = facts(tree);
      const want = expected(doc, state, scheme, now);
      const same = JSON.stringify(got.texts) === JSON.stringify(want);
      if (!same) fail(`${label}/${surface}/round ${round}`, `\n    got  ${JSON.stringify(got.texts)}\n    want ${JSON.stringify(want)}`);

      const pressed = got.buttons[0];
      if (!pressed) break;
      const next = pressed.props.onClick();
      const action = findAction(doc.root);
      const wantState = semantics.applyAction(state, action);
      if (JSON.stringify(next.state) !== JSON.stringify(wantState)) {
        fail(`${label}/${surface}/press ${round}`, `state ${JSON.stringify(next.state)} ≠ ${JSON.stringify(wantState)}`);
      }
      state = next.state;
    }
  }
  console.log(`  ${failures ? "·" : "✓"} ${label}`);
}

// The player must survive a missing document and a future format version.
for (const props of [{ doc: null }, { doc: { v: 2, root: {} } }]) {
  const texts = facts(layout(props, { colorScheme: "dark" })).texts.map((t) => t.text);
  if (!texts.includes("Open WidgetComposer")) fail("fallback", `no fallback card for ${JSON.stringify(props)}`);
}

function findAction(node) {
  if (node.type === "button") return node.action;
  for (const child of node.children ?? []) {
    const found = findAction(child);
    if (found) return found;
  }
  return null;
}

if (failures) {
  console.error(`\n${failures} conformance failure(s)`);
  process.exit(1);
}
console.log("\nwidget player matches reference semantics");
