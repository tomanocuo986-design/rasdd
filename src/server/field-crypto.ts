// Column-level encryption for the server database (AES-256-GCM, node:crypto).
// Every sensitive column is stored as  v1.<keyId>.<iv>.<tag>.<ciphertext>  (base64url parts).
//  - key comes from RASD_DATA_KEY (base64, 32 bytes); old keys stay readable via RASD_DATA_KEY_PREV (comma list)
//    so keys can be rotated: new writes use the current key, old rows decrypt with the previous one.
//  - `aad` binds a ciphertext to its row (owner + id): copying an encrypted value to another row fails to decrypt.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type KeyRing = { currentId: string; keys: Map<string, Buffer> };

const keyId = (k: Buffer) => createHash("sha256").update(k).digest("hex").slice(0, 8);

function parseKey(b64: string, label: string): Buffer {
  const k = Buffer.from(b64.trim(), "base64");
  if (k.length !== 32) throw new Error(`${label} must be 32 random bytes encoded as base64 (openssl rand -base64 32)`);
  return k;
}

export function loadKeyRing(env: Record<string, string | undefined> = process.env): KeyRing {
  if (!env["RASD_DATA_KEY"]) throw new Error("RASD_DATA_KEY is not set");
  const current = parseKey(env["RASD_DATA_KEY"], "RASD_DATA_KEY");
  const keys = new Map<string, Buffer>([[keyId(current), current]]);
  for (const p of (env["RASD_DATA_KEY_PREV"] ?? "").split(",").filter((s) => s.trim())) {
    const k = parseKey(p, "RASD_DATA_KEY_PREV");
    keys.set(keyId(k), k);
  }
  return { currentId: keyId(current), keys };
}

const b64u = (b: Buffer) => b.toString("base64url");

export function encryptField(ring: KeyRing, plaintext: string, aad: string): string {
  const key = ring.keys.get(ring.currentId)!;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return ["v1", ring.currentId, b64u(iv), b64u(c.getAuthTag()), b64u(ct)].join(".");
}

export function decryptField(ring: KeyRing, token: string, aad: string): string {
  const [v, id, iv, tag, ct] = token.split(".");
  if (v !== "v1" || !id || !iv || !tag || ct === undefined) throw new Error("unrecognised encrypted value");
  const key = ring.keys.get(id);
  if (!key) throw new Error("encryption key not available (rotated out?)");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** True when the value was written with a key other than the current one (re-encrypt on next write). */
export const needsRotation = (ring: KeyRing, token: string) => token.split(".")[1] !== ring.currentId;
