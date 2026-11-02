// Backup / restore of everything RASD keeps in the browser:
//  - every localStorage key that starts with "rasd-" (store, params, calibration, observations, ...)
//  - the uploaded regulations library (IndexedDB, including the original PDF files)
// The file is JSON. With a passphrase it is wrapped in an AES-256-GCM envelope (see crypto.js) so it can be
// archived or moved between devices without exposing municipal data.
// Keys under "rasd-sync-" (server token / URL) are device-local secrets and are never exported or restored.
import { getRegulation, listRegulations, saveRegulation } from "./regulations-db.js";
import { decryptJson, encryptJson, isEncryptedEnvelope } from "./crypto.js";

export const BACKUP_VERSION = 1;
const PREFIX = "rasd-";
const LOCAL_ONLY = "rasd-sync-";
const DEMO_ONLY = "rasd-demo-"; // لقطة بيانات المستخدم قبل العرض وعلامة التفعيل: لا تُصدَّر ولا تُزامَن
export const LAST_BACKUP_KEY = "rasd-last-backup";
export const BACKUP_REMIND_DAYS = 7;

const toBase64 = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

const fromBase64 = (b64, type) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type || "application/pdf" });
};

export function localKeys(storage = globalThis.localStorage) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(PREFIX) && !k.startsWith(LOCAL_ONLY) && !k.startsWith(DEMO_ONLY)) keys.push(k);
  }
  return keys;
}

/** Approximate localStorage usage of RASD keys, in bytes (UTF-16 => 2 bytes/char) vs the usual 5 MB cap. */
export function storageUsage(storage = globalThis.localStorage) {
  let chars = 0;
  for (const k of localKeys(storage)) chars += k.length + (storage.getItem(k) ?? "").length;
  const bytes = chars * 2;
  const limit = 5 * 1024 * 1024;
  return { bytes, limit, ratio: bytes / limit };
}

/** Days since the last exported backup (Infinity when never). Used for the reminder banner. */
export function daysSinceBackup(storage = globalThis.localStorage, now = Date.now()) {
  try {
    const t = Date.parse(storage.getItem(LAST_BACKUP_KEY) ?? "");
    return Number.isFinite(t) ? Math.floor((now - t) / 86_400_000) : Infinity;
  } catch {
    return Infinity;
  }
}

export const backupDue = (storage, now) => daysSinceBackup(storage, now) >= BACKUP_REMIND_DAYS;

export async function buildBackup(storage = globalThis.localStorage, withLibrary = true) {
  const data = {};
  for (const k of localKeys(storage)) data[k] = storage.getItem(k);
  let regulations = [];
  if (withLibrary) {
    try {
      const docs = await listRegulations();
      regulations = await Promise.all(
        docs.map(async ({ blob, ...rest }) => ({
          ...rest,
          // withLibrary === "text": نص الأنظمة وبياناتها (تاريخ النفاذ والمصدر) دون ملفات PDF، لتبقى المزامنة خفيفة
          pdfType: withLibrary === "text" ? "" : (blob?.type ?? ""),
          pdf: blob && withLibrary !== "text" ? await toBase64(blob) : null,
        })),
      );
    } catch {
      /* IndexedDB unavailable: back up the rest */
    }
  }
  return {
    app: "rasd",
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    data,
    regulations,
  };
}

/** Downloads the backup as rasd-backup-YYYY-MM-DD.json (or .rasd when encrypted). */
export async function exportBackup({ passphrase } = {}, storage = globalThis.localStorage) {
  const backup = await buildBackup(storage);
  const payload = passphrase ? await encryptJson(backup, passphrase) : backup;
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rasd-backup-${backup.createdAt.slice(0, 10)}${passphrase ? ".enc" : ""}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  try {
    storage.setItem(LAST_BACKUP_KEY, backup.createdAt);
  } catch {
    /* storage full: the backup file was still produced */
  }
  return {
    keys: Object.keys(backup.data).length,
    regulations: backup.regulations.length,
    encrypted: !!passphrase,
  };
}

/** Validates a parsed backup object. Throws an Arabic message when it is not a RASD backup. */
export function validateBackup(b) {
  if (!b || typeof b !== "object" || b.app !== "rasd" || typeof b.data !== "object" || !b.data)
    throw Error("الملف ليس نسخة احتياطية صالحة من رصد");
  if (typeof b.version === "number" && b.version > BACKUP_VERSION)
    throw Error("النسخة الاحتياطية أحدث من هذا الإصدار من رصد");
  return b;
}

/** Applies an already-parsed backup object (shared by file restore and server restore). */
export async function applyBackup(parsed, storage = globalThis.localStorage) {
  const b = validateBackup(parsed);
  let keys = 0;
  for (const [k, v] of Object.entries(b.data)) {
    if (!k.startsWith(PREFIX) || k.startsWith(LOCAL_ONLY) || k.startsWith(DEMO_ONLY) || typeof v !== "string") continue;
    storage.setItem(k, v);
    keys++;
  }
  let regs = 0;
  for (const r of b.regulations ?? []) {
    const { pdf, pdfType, ...rest } = r;
    // نسخة بلا PDF (مزامنة الخادم): لا تُفقد ملفات PDF المحلية للمستند نفسه
    const keep = pdf ? undefined : await getRegulation(rest.id).catch(() => undefined);
    await saveRegulation({ ...rest, blob: pdf ? fromBase64(pdf, pdfType) : keep?.blob });
    regs++;
  }
  return { keys, regulations: regs };
}

/** True when the file is an encrypted RASD backup (so the UI can ask for the passphrase first). */
export async function isEncryptedBackupFile(file) {
  try {
    return isEncryptedEnvelope(JSON.parse(await file.text()));
  } catch {
    return false;
  }
}

/** Restores a backup file (replaces the RASD keys it contains; keys not in the file are left alone). */
export async function importBackup(file, storage = globalThis.localStorage, passphrase) {
  let parsed = JSON.parse(await file.text());
  if (isEncryptedEnvelope(parsed)) parsed = await decryptJson(parsed, passphrase);
  return applyBackup(parsed, storage);
}
