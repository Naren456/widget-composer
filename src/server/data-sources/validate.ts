import { type AuthConfig, type DataSource } from "@/types/data-source";

import { isCredentialRef } from "./credentials";
import { isValidPath } from "./mapping";
import { BlockedDestinationError, checkUrl } from "./network-policy";

/**
 * Checks an untrusted data source — from the app or from the agent — before it is
 * stored or run. Returns every issue, like `validateDocument`, so the agent can fix
 * them in one pass.
 */

const MAX_MAPPINGS = 30;
const SAFE_HEADER = /^(?:accept|accept-language|x-[a-z0-9-]{1,40})$/;
/** Header names an API-key strategy may not use: they would rewrite the request itself. */
const RESERVED_HEADER = /^(?:host|cookie|connection|content-length|transfer-encoding|te|upgrade|proxy-.*|authorization)$/;
const TOOL_SLUG = /^[A-Z][A-Z0-9_]{2,99}$/;

type Result = { ok: true; source: DataSource } | { ok: false; issues: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function stringMap(value: unknown, path: string, issues: string[], max: number): Record<string, string> {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`);
    return {};
  }
  const entries = Object.entries(value);
  if (entries.length > max) issues.push(`${path} has more than ${max} entries`);
  for (const [k, v] of entries) {
    if (typeof v !== "string" || v.length > 500) issues.push(`${path}.${k} must be a string up to 500 characters`);
  }
  return value as Record<string, string>;
}

function checkMapping(value: unknown, issues: string[]) {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    issues.push("mapping must map at least one value name to a response path");
    return;
  }
  if (Object.keys(value).length > MAX_MAPPINGS) issues.push(`mapping has more than ${MAX_MAPPINGS} entries`);
  for (const [name, path] of Object.entries(value)) {
    if (!/^\w{1,40}$/.test(name)) issues.push(`mapping name "${name}" must be letters, digits or _`);
    if (!isValidPath(path)) issues.push(`mapping.${name} must be a path like data.items[0].title`);
  }
}

function checkAuth(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push('auth must be {strategy:"none"}, apiKey or bearer');
    return;
  }
  const auth = value as AuthConfig;
  if (auth.strategy === "none") return;
  if (auth.strategy !== "apiKey" && auth.strategy !== "bearer") {
    issues.push(`unknown auth strategy ${String((value as { strategy?: unknown }).strategy)}`);
    return;
  }
  if (!isCredentialRef(auth.credentialRef)) issues.push("auth.credentialRef must be a stored credential reference");
  if (auth.strategy === "apiKey") {
    if (auth.in !== "header" && auth.in !== "query") issues.push('auth.in must be "header" or "query"');
    if (typeof auth.name !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(auth.name)) {
      issues.push("auth.name must be a header or parameter name");
    } else if (auth.in === "header" && RESERVED_HEADER.test(auth.name.toLowerCase())) {
      issues.push(`auth.name ${auth.name} is reserved; use the bearer strategy for Authorization`);
    }
  }
}

export function validateDataSource(input: unknown): Result {
  const issues: string[] = [];
  if (!isRecord(input)) return { ok: false, issues: ["data source must be an object"] };
  if (input.v !== 1) issues.push("v must be 1");
  if (input.cacheSeconds !== undefined) {
    const s = input.cacheSeconds;
    if (typeof s !== "number" || !Number.isInteger(s) || s < 0 || s > 3600) issues.push("cacheSeconds must be 0-3600");
  }
  checkMapping(input.mapping, issues);

  if (input.connector === "rest") {
    if (typeof input.url !== "string" || input.url.length > 1000) issues.push("url must be a string");
    else {
      try {
        checkUrl(input.url);
      } catch (error) {
        issues.push(`url: ${error instanceof BlockedDestinationError ? error.message : "invalid"}`);
      }
    }
    stringMap(input.query, "query", issues, 20);
    const headers = stringMap(input.headers, "headers", issues, 10);
    for (const name of Object.keys(headers)) {
      if (!SAFE_HEADER.test(name.toLowerCase())) issues.push(`header ${name} is not allowed; only accept, accept-language and x-*`);
    }
    checkAuth(input.auth, issues);
  } else if (input.connector === "composio") {
    if (typeof input.tool !== "string" || !TOOL_SLUG.test(input.tool)) issues.push("tool must be a Composio tool slug");
    if (!isRecord(input.args)) issues.push("args must be an object");
    else if (JSON.stringify(input.args).length > 4000) issues.push("args are too large");
  } else {
    issues.push('connector must be "rest" or "composio"');
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, source: input as unknown as DataSource };
}
