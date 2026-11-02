// Passphrase-based encryption for RASD backups (WebCrypto only, no dependencies).
// Envelope: { app:"rasd", encrypted:true, v:1, kdf:"PBKDF2-SHA256", iter, salt, iv, data }  (base64 fields)
// AES-256-GCM authenticates the payload, so a wrong passphrase or a tampered file fails cleanly.

const ITER = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw Error("المتصفح لا يدعم التشفير (يتطلب اتصالًا آمنًا HTTPS)");
  return s;
};

export function bytesToB64(bytes) {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(s);
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase, salt, iter) {
  const base = await subtle().importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export const isEncryptedEnvelope = (o) =>
  !!o && typeof o === "object" && o.app === "rasd" && o.encrypted === true && typeof o.data === "string";

export async function encryptJson(value, passphrase, iter = ITER) {
  if (!passphrase || passphrase.length < 8) throw Error("كلمة المرور قصيرة (8 أحرف على الأقل)");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iter);
  const ct = new Uint8Array(
    await subtle().encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value))),
  );
  return {
    app: "rasd",
    encrypted: true,
    v: 1,
    kdf: "PBKDF2-SHA256",
    iter,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    data: bytesToB64(ct),
  };
}

export async function decryptJson(envelope, passphrase) {
  if (!isEncryptedEnvelope(envelope)) throw Error("الملف ليس نسخة مشفّرة من رصد");
  if (!passphrase) throw Error("هذه النسخة مشفّرة: أدخل كلمة المرور");
  try {
    const key = await deriveKey(passphrase, b64ToBytes(envelope.salt), envelope.iter || ITER);
    const pt = await subtle().decrypt(
      { name: "AES-GCM", iv: b64ToBytes(envelope.iv) },
      key,
      b64ToBytes(envelope.data),
    );
    return JSON.parse(dec.decode(pt));
  } catch {
    throw Error("كلمة المرور غير صحيحة أو الملف تالف");
  }
}
