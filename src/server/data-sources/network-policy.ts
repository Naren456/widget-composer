import { BlockList, isIP } from "node:net";

/**
 * Which destinations a user- or agent-defined data source may reach.
 *
 * The server fetches URLs it did not choose, so without this a widget could read the
 * cloud metadata service or anything on the server's private network (SSRF). Hostnames
 * are checked again at connect time against every address DNS returns (see `http.ts`),
 * which also defeats DNS rebinding.
 */

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT, also Tailscale
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, including 169.254.169.254 metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved and broadcast
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96], // NAT64: embeds an IPv4 address
  ["2002::", 16], // 6to4: embeds an IPv4 address
  ["2001:db8::", 32],
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

// IPv4-mapped IPv6 (::ffff:a.b.c.d) would bypass the IPv4 list, so it is refused outright.
// It lives in its own list because BlockList also matches plain IPv4 addresses against
// a mapped rule — in the main list it would block every IPv4 address.
const mapped = new BlockList();
mapped.addSubnet("::ffff:0:0", 96, "ipv6");

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  if (family === 4) return blocked.check(address, "ipv4");
  return mapped.check(address, "ipv6") || blocked.check(address, "ipv6");
}

export class BlockedDestinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedDestinationError";
  }
}

/** Throws unless `raw` is a URL a data source may fetch. Returns the parsed URL. */
export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedDestinationError("not a valid URL");
  }
  if (url.protocol !== "https:") throw new BlockedDestinationError("only https URLs are allowed");
  if (url.username || url.password) throw new BlockedDestinationError("credentials in the URL are not allowed");
  if (url.port && url.port !== "443") throw new BlockedDestinationError("only the default https port is allowed");

  // Node skips DNS lookup for IP literals, so they must be checked here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0) {
    if (isBlockedAddress(host)) throw new BlockedDestinationError("private or reserved address");
  } else if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
    throw new BlockedDestinationError("internal hostnames are not allowed");
  }
  return url;
}
