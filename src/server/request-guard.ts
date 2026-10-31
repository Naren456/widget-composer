/**
 * Shared checks for API routes. The user id is the per-install id from the app; there
 * is no sign-in yet, so it is treated as a bearer secret and never logged.
 */

export const USER_ID = /^[\w-]{8,64}$/;

export function isUserId(value: unknown): value is string {
  return typeof value === "string" && USER_ID.test(value);
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const windows = new Map<string, { start: number; count: number }>();

/**
 * Fixed-window limiter, in memory: enough for one server process. Returns false once
 * `key` has made `limit` calls in the current window.
 */
export function allow(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || now - entry.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
