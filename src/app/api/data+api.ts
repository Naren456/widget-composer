import { fetchWidgetValues } from "@/server/data-sources/service";
import { validateDataSource } from "@/server/data-sources/validate";
import { allow, isUserId, readJson } from "@/server/request-guard";
import { type DataFetchResult } from "@/types/data-source";

/**
 * POST /api/data — refreshes a widget's values from its data source.
 *
 * Body: { userId: string, source: DataSource }
 * 200 → DataFetchResult (ok:false carries the reason) · 400 bad input · 429 too many refreshes
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  const { userId, source } = body;
  if (!isUserId(userId)) return Response.json({ error: "userId must be 8-64 letters, digits, _ or -" }, { status: 400 });

  const checked = validateDataSource(source);
  if (!checked.ok) {
    const result: DataFetchResult = { ok: false, reason: "invalid", message: checked.issues.join("; ") };
    return Response.json(result, { status: 400 });
  }
  if (!allow(`data:${userId}`, 30)) {
    const result: DataFetchResult = { ok: false, reason: "rate_limited", message: "Too many refreshes. Try again in a minute." };
    return Response.json(result, { status: 429 });
  }

  return Response.json(await fetchWidgetValues(userId, checked.source));
}
