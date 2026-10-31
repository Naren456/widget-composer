/**
 * Where a widget's live values come from — kept separate from its layout, so one
 * document can be refreshed without the agent and one source can feed several widgets.
 *
 * A data source never holds a secret. Authenticated requests name a `credentialRef`
 * that the server resolves from its encrypted store for the owning user.
 */

export const DATA_SOURCE_VERSION = 1;

export type AuthConfig =
  | { strategy: "none" }
  /** Secret sent as a header (`X-Api-Key: …`) or a query parameter (`?api_key=…`). */
  | { strategy: "apiKey"; credentialRef: string; in: "header" | "query"; name: string }
  /** Secret sent as `Authorization: Bearer …`. */
  | { strategy: "bearer"; credentialRef: string };

/**
 * Maps document value names to paths in the response, e.g.
 * `{ title: "items[0].title", stars: "stargazers_count" }`.
 */
export type ResponseMapping = Record<string, string>;

export type RestDataSource = {
  v: 1;
  connector: "rest";
  /** HTTPS only. Widgets only read, so the method is always GET. */
  url: string;
  query?: Record<string, string>;
  /** Only `accept`, `accept-language` and `x-*` headers are sent; auth goes in `auth`. */
  headers?: Record<string, string>;
  auth: AuthConfig;
  mapping: ResponseMapping;
  /** Seconds a result may be reused, 0–3600. Defaults to 60. */
  cacheSeconds?: number;
};

export type ComposioDataSource = {
  v: 1;
  connector: "composio";
  /** A read-only Composio tool slug, e.g. `GITHUB_GET_A_REPOSITORY`. */
  tool: string;
  args: Record<string, unknown>;
  mapping: ResponseMapping;
  cacheSeconds?: number;
};

export type DataSource = RestDataSource | ComposioDataSource;

/** Response of POST /api/data. */
export type DataFetchResult =
  | {
      ok: true;
      values: Record<string, string>;
      /** Mapped names the response did not contain; their old values are kept. */
      missing: string[];
      /** Epoch ms the upstream response was fetched (earlier than now when cached). */
      fetchedAt: number;
    }
  | {
      ok: false;
      reason: "invalid" | "blocked" | "credential" | "upstream" | "unconfigured" | "rate_limited" | "unreachable";
      message: string;
    };
