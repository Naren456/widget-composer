import { type ComposioDataSource, type DataSource, type RestDataSource } from "@/types/data-source";
import { readOnlyViolation } from "@/server/read-only";

import { resolveCredential } from "./credentials";
import { getJson, UpstreamError } from "./http";

/**
 * Connector registry: one adapter per `connector` kind. Each takes a validated data
 * source and returns the raw upstream response; mapping happens in the service.
 */

export class CredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialError";
  }
}

export class ConnectorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorUnavailableError";
  }
}

type Connector<S extends DataSource> = (owner: string, source: S) => Promise<unknown>;

const rest: Connector<RestDataSource> = async (owner, source) => {
  const url = new URL(source.url);
  for (const [k, v] of Object.entries(source.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { ...source.headers };
  const sensitive = ["authorization"];

  const { auth } = source;
  if (auth.strategy !== "none") {
    const secret = await resolveCredential(owner, auth.credentialRef, url.origin);
    if (secret === null) {
      throw new CredentialError(`the credential is missing, was revoked, or is not for ${url.origin}`);
    }
    if (auth.strategy === "bearer") headers.authorization = `Bearer ${secret}`;
    else if (auth.in === "header") {
      headers[auth.name.toLowerCase()] = secret;
      sensitive.push(auth.name.toLowerCase());
    } else url.searchParams.set(auth.name, secret);
  }

  return getJson(url.toString(), { headers, sensitiveHeaders: sensitive });
};

const DEFAULT_TOOLKITS = ["github", "hackernews", "youtube", "reddit", "googlecalendar"];

const composio: Connector<ComposioDataSource> = async (owner, source) => {
  if (!process.env.COMPOSIO_API_KEY) throw new ConnectorUnavailableError("Composio is not configured on the server");
  const violation = readOnlyViolation(source.tool, source.args);
  if (violation) throw new UpstreamError(`refused: ${violation}`);

  // Loaded lazily so REST-only deployments never pay for the Composio SDK.
  const { Composio } = await import("@composio/core");
  const client = new Composio();
  const toolkits = (process.env.COMPOSIO_TOOLKITS ?? DEFAULT_TOOLKITS.join(","))
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const session = await client.create(owner, { toolkits, manageConnections: false });
  try {
    return await session.execute(source.tool, source.args);
  } catch (error) {
    throw new UpstreamError(`Composio tool failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export function runConnector(owner: string, source: DataSource): Promise<unknown> {
  switch (source.connector) {
    case "rest":
      return rest(owner, source);
    case "composio":
      return composio(owner, source);
  }
}
