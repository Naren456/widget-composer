/**
 * Response normalizer: turns an upstream JSON response into the string values a
 * widget document renders, following the data source's mapping.
 *
 * Paths are a small dotted syntax (`data.items[0].title`, `[0].name`) — no
 * expressions — and only own properties are followed, so `__proto__` and friends
 * cannot be reached.
 */

const PATH = /^(?:[A-Za-z_][\w-]*|\[\d+\])(?:\.[A-Za-z_][\w-]*|\[\d+\])*$/;
const SEGMENT = /[A-Za-z_][\w-]*|\[\d+\]/g;

export function isValidPath(path: unknown): path is string {
  return typeof path === "string" && path.length <= 200 && PATH.test(path);
}

export function readPath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.match(SEGMENT) ?? []) {
    if (current === null || typeof current !== "object") return undefined;
    if (segment.startsWith("[")) {
      if (!Array.isArray(current)) return undefined;
      current = current[Number(segment.slice(1, -1))];
    } else {
      if (Array.isArray(current) || !Object.hasOwn(current, segment)) return undefined;
      current = (current as Record<string, unknown>)[segment];
    }
  }
  return current;
}

/** A scalar as widget text; objects, arrays and null count as missing. */
function asText(value: unknown, maxLength: number): string | undefined {
  let text: string;
  if (typeof value === "string") text = value;
  else if (typeof value === "number" && Number.isFinite(value)) text = String(value);
  else if (typeof value === "boolean") text = value ? "Yes" : "No";
  else return undefined;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export function applyMapping(
  response: unknown,
  mapping: Record<string, string>,
  maxLength: number,
): { values: Record<string, string>; missing: string[] } {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const [name, path] of Object.entries(mapping)) {
    const text = asText(readPath(response, path), maxLength);
    if (text === undefined) missing.push(name);
    else values[name] = text;
  }
  return { values, missing };
}
