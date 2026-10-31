import dns, { type LookupAddress } from "node:dns";
import https from "node:https";
import { type LookupFunction } from "node:net";

import { BlockedDestinationError, checkUrl, isBlockedAddress } from "./network-policy";

/**
 * GET a JSON document from a URL the server did not choose.
 *
 * Every address is checked when the socket connects, not before, so a hostname cannot
 * pass the check and then resolve somewhere private (DNS rebinding). Redirects are
 * followed by hand so each hop is re-checked, and auth headers are dropped when a
 * redirect leaves the original origin.
 */

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as unknown as LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      return callback(new BlockedDestinationError(`${hostname} resolves to a private or reserved address`), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

type Options = {
  headers: Record<string, string>;
  /** Header names to drop if a redirect changes origin. */
  sensitiveHeaders: string[];
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

export async function getJson(rawUrl: string, options: Options): Promise<unknown> {
  const { timeoutMs = 8000, maxBytes = 1_000_000, maxRedirects = 3 } = options;
  const signal = AbortSignal.timeout(timeoutMs);
  let url = checkUrl(rawUrl);
  const origin = url.origin;
  let headers = { ...options.headers };

  for (let hop = 0; ; hop++) {
    const response = await request(url, headers, signal, maxBytes);
    if (response.redirect) {
      if (hop >= maxRedirects) throw new UpstreamError("too many redirects");
      url = checkUrl(new URL(response.redirect, url).toString());
      if (url.origin !== origin) {
        headers = Object.fromEntries(
          Object.entries(headers).filter(([k]) => !options.sensitiveHeaders.includes(k.toLowerCase())),
        );
      }
      continue;
    }
    try {
      return JSON.parse(response.body);
    } catch {
      throw new UpstreamError("response is not JSON");
    }
  }
}

function request(
  url: URL,
  headers: Record<string, string>,
  signal: AbortSignal,
  maxBytes: number,
): Promise<{ redirect?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      // Many APIs (GitHub among them) reject requests without a User-Agent.
      { headers: { accept: "application/json", ...headers, "user-agent": "WidgetComposer/1.0" }, lookup: guardedLookup, signal },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location, body: "" });
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new UpstreamError(`upstream returned ${status}`, status));
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > maxBytes) {
          res.destroy();
          return reject(new UpstreamError("response is too large"));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            reject(new UpstreamError("response is too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("error", (error) => {
      if (error instanceof BlockedDestinationError) reject(error);
      else if (signal.aborted) reject(new UpstreamError("upstream timed out"));
      else reject(new UpstreamError(`could not reach upstream: ${error.message}`));
    });
  });
}
