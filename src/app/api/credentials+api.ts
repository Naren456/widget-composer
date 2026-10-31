import {
  credentialsConfigured,
  isCredentialRef,
  listCredentials,
  revokeCredential,
  saveCredential,
} from "@/server/data-sources/credentials";
import { BlockedDestinationError, checkUrl } from "@/server/data-sources/network-policy";
import { allow, isUserId, readJson } from "@/server/request-guard";

/**
 * Credentials for data sources. Secrets go in once and never come back out: every
 * response carries only the reference, label and origin.
 *
 * POST   { userId, label, origin, secret } → 201 { ref, label, origin, createdAt }
 * GET    ?userId=…                         → 200 { credentials: [...] }
 * DELETE { userId, ref }                   → 204 · 404 unknown ref
 */

const unconfigured = () =>
  Response.json({ error: "Credential storage is not configured on the server (CREDENTIAL_KEY)." }, { status: 503 });

export async function POST(request: Request) {
  if (!credentialsConfigured()) return unconfigured();
  const body = await readJson(request);
  if (!body) return Response.json({ error: "Body must be a JSON object" }, { status: 400 });
  const { userId, label, origin, secret } = body;
  if (!isUserId(userId)) return Response.json({ error: "userId must be 8-64 letters, digits, _ or -" }, { status: 400 });
  if (typeof label !== "string" || label.trim().length === 0 || label.length > 60) {
    return Response.json({ error: "label must be 1-60 characters" }, { status: 400 });
  }
  if (typeof secret !== "string" || secret.length === 0 || secret.length > 4000 || /[\r\n]/.test(secret)) {
    return Response.json({ error: "secret must be 1-4000 characters on one line" }, { status: 400 });
  }
  let boundOrigin: string;
  try {
    const url = checkUrl(typeof origin === "string" ? origin : "");
    boundOrigin = url.origin;
  } catch (error) {
    const reason = error instanceof BlockedDestinationError ? error.message : "invalid";
    return Response.json({ error: `origin: ${reason}` }, { status: 400 });
  }
  if (!allow(`cred:${userId}`, 10)) return Response.json({ error: "Too many requests" }, { status: 429 });

  const info = await saveCredential(userId, label.trim(), boundOrigin, secret);
  return Response.json(info, { status: 201 });
}

export async function GET(request: Request) {
  if (!credentialsConfigured()) return unconfigured();
  const userId = new URL(request.url).searchParams.get("userId");
  if (!isUserId(userId)) return Response.json({ error: "userId must be 8-64 letters, digits, _ or -" }, { status: 400 });
  return Response.json({ credentials: await listCredentials(userId) });
}

export async function DELETE(request: Request) {
  if (!credentialsConfigured()) return unconfigured();
  const body = await readJson(request);
  const { userId, ref } = body ?? {};
  if (!isUserId(userId) || !isCredentialRef(ref)) {
    return Response.json({ error: "userId and a credential ref are required" }, { status: 400 });
  }
  const removed = await revokeCredential(userId, ref);
  return removed ? new Response(null, { status: 204 }) : Response.json({ error: "Not found" }, { status: 404 });
}
