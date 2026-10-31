import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Encrypted credential store. Secrets are written with AES-256-GCM under
 * `CREDENTIAL_KEY` (32 bytes, base64 or hex) and are only ever decrypted to make an
 * upstream request; the API hands out references, never the secret.
 *
 * Each credential belongs to the user id that stored it and is bound to one https
 * origin: it is only released for a request to that origin, so neither a mistyped
 * source nor an agent misled by fetched text can send it to another host. Storage is a JSON file under `DATA_DIR` (default `.data`) —
 * enough for one server instance; swap this module for a database table when the
 * backend scales out.
 */

type StoredCredential = {
  owner: string;
  label: string;
  origin: string;
  createdAt: number;
  iv: string;
  tag: string;
  data: string;
};

export type CredentialInfo = { ref: string; label: string; origin: string; createdAt: number };

const REF_PATTERN = /^cred_[0-9a-f-]{36}$/;

function storePath(): string {
  return join(process.env.DATA_DIR ?? ".data", "credentials.json");
}

function encryptionKey(): Buffer | null {
  const raw = process.env.CREDENTIAL_KEY;
  if (!raw) return null;
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

export function credentialsConfigured(): boolean {
  return encryptionKey() !== null;
}

export function isCredentialRef(value: unknown): value is string {
  return typeof value === "string" && REF_PATTERN.test(value);
}

async function load(): Promise<Record<string, StoredCredential>> {
  try {
    return JSON.parse(await readFile(storePath(), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

// Writes are serialized so two requests cannot drop each other's credential.
let queue: Promise<unknown> = Promise.resolve();
function update<T>(change: (all: Record<string, StoredCredential>) => T): Promise<T> {
  const run = queue.then(async () => {
    const all = await load();
    const result = change(all);
    const path = storePath();
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const tmp = `${path}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(all), { mode: 0o600 });
    await rename(tmp, path);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function saveCredential(
  owner: string,
  label: string,
  origin: string,
  secret: string,
): Promise<CredentialInfo> {
  const key = encryptionKey();
  if (!key) throw new Error("CREDENTIAL_KEY is not configured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  // The owner is bound in as associated data, so a record copied to another user fails to decrypt.
  cipher.setAAD(Buffer.from(owner));
  const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const ref = `cred_${randomUUID()}`;
  const createdAt = Date.now();
  await update((all) => {
    all[ref] = {
      owner,
      label,
      origin,
      createdAt,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: data.toString("base64"),
    };
  });
  return { ref, label, origin, createdAt };
}

/** The secret for `ref`, or null if it is missing, someone else's, or bound to another origin. */
export async function resolveCredential(owner: string, ref: string, origin: string): Promise<string | null> {
  const key = encryptionKey();
  if (!key || !isCredentialRef(ref)) return null;
  const record = (await load())[ref];
  if (!record || record.owner !== owner || record.origin !== origin) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
    decipher.setAAD(Buffer.from(owner));
    decipher.setAuthTag(Buffer.from(record.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(record.data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function listCredentials(owner: string): Promise<CredentialInfo[]> {
  return Object.entries(await load())
    .filter(([, c]) => c.owner === owner)
    .map(([ref, c]) => ({ ref, label: c.label, origin: c.origin, createdAt: c.createdAt }));
}

export async function revokeCredential(owner: string, ref: string): Promise<boolean> {
  return update((all) => {
    if (all[ref]?.owner !== owner) return false;
    delete all[ref];
    return true;
  });
}
