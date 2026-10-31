import { type DataFetchResult, type DataSource } from "@/types/data-source";
import { androidWidgetProfile } from "@/widget-engine/document";

import { ConnectorUnavailableError, CredentialError, runConnector } from "./connectors";
import { UpstreamError } from "./http";
import { applyMapping } from "./mapping";
import { BlockedDestinationError } from "./network-policy";

/**
 * Data-source service: runs a validated source through its connector, maps the
 * response into widget values, and caches the result briefly so several widgets (or a
 * refresh storm) sharing a source cost one upstream call.
 */

const DEFAULT_CACHE_SECONDS = 60;
const MAX_CACHE_ENTRIES = 500;

type Fetched = { raw: unknown; fetchedAt: number };
const cache = new Map<string, Fetched>();

function cacheKey(owner: string, source: DataSource): string {
  // Mapping does not change the upstream call, so sources differing only there share a response.
  const { mapping: _mapping, ...request } = source;
  return `${owner}\n${JSON.stringify(request)}`;
}

async function fetchRaw(owner: string, source: DataSource): Promise<Fetched> {
  const ttl = (source.cacheSeconds ?? DEFAULT_CACHE_SECONDS) * 1000;
  const key = cacheKey(owner, source);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < ttl) return hit;

  const fetched = { raw: await runConnector(owner, source), fetchedAt: Date.now() };
  if (ttl > 0) {
    cache.delete(key);
    cache.set(key, fetched);
    if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  }
  return fetched;
}

export type DataRun = { ok: true; raw: unknown; values: Record<string, string>; missing: string[]; fetchedAt: number };

/** Runs a source and returns mapped values plus the raw response (for the agent's tests). */
export async function runDataSource(
  owner: string,
  source: DataSource,
): Promise<DataRun | Extract<DataFetchResult, { ok: false }>> {
  try {
    const { raw, fetchedAt } = await fetchRaw(owner, source);
    const { values, missing } = applyMapping(raw, source.mapping, androidWidgetProfile.maxTextLength);
    return { ok: true, raw, values, missing, fetchedAt };
  } catch (error) {
    if (error instanceof BlockedDestinationError) return { ok: false, reason: "blocked", message: error.message };
    if (error instanceof CredentialError) return { ok: false, reason: "credential", message: error.message };
    if (error instanceof ConnectorUnavailableError) return { ok: false, reason: "unconfigured", message: error.message };
    if (error instanceof UpstreamError) return { ok: false, reason: "upstream", message: error.message };
    console.error("[data] source failed", error);
    return { ok: false, reason: "upstream", message: "The data source could not be read." };
  }
}

export async function fetchWidgetValues(owner: string, source: DataSource): Promise<DataFetchResult> {
  const run = await runDataSource(owner, source);
  if (!run.ok) return run;
  return { ok: true, values: run.values, missing: run.missing, fetchedAt: run.fetchedAt };
}
