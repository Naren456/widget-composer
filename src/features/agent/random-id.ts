/**
 * Random UUID v4 for the per-install Composio user id.
 *
 * Prefers expo-crypto, but loads it lazily: a development build made before
 * expo-crypto was added has no `ExpoCrypto` native module, and a top-level import
 * would throw and take every screen that imports this down with it. Falls back to the
 * runtime's Web Crypto, then — only as a last resort — to Math.random, which is not
 * cryptographically secure; rebuild the app to get the secure path.
 */
export function randomId(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomUUID } = require("expo-crypto") as typeof import("expo-crypto");
    return randomUUID();
  } catch {
    // Native module missing from this build; fall through.
  }

  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) webCrypto.getRandomValues(bytes);
  else {
    if (__DEV__) console.warn("[agent] no secure random source; rebuild the app to include expo-crypto");
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
