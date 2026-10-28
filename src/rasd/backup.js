// Backup / restore of everything RASD keeps in the browser:
//  - every localStorage key that starts with "rasd-" (store, params, calibration, observations, ...)
//  - the uploaded regulations library (IndexedDB, including the original PDF files)
// The file is plain JSON so it can be archived, moved to another device or inspected.
import { listRegulations, saveRegulation } from "./regulations-db.js";

export const BACKUP_VERSION = 1;
const PREFIX = "rasd-";

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
    if (k && k.startsWith(PREFIX)) keys.push(k);
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
          pdfType: blob?.type ?? "",
          pdf: blob ? await toBase64(blob) : null,
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

/** Downloads the backup as rasd-backup-YYYY-MM-DD.json */
export async function exportBackup() {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rasd-backup-${backup.createdAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return { keys: Object.keys(backup.data).length, regulations: backup.regulations.length };
}

/** Validates a parsed backup object. Throws an Arabic message when it is not a RASD backup. */
export function validateBackup(b) {
  if (!b || typeof b !== "object" || b.app !== "rasd" || typeof b.data !== "object" || !b.data)
    throw Error("الملف ليس نسخة احتياطية صالحة من رصد");
  if (typeof b.version === "number" && b.version > BACKUP_VERSION)
    throw Error("النسخة الاحتياطية أحدث من هذا الإصدار من رصد");
  return b;
}

/** Restores a backup file (replaces the RASD keys it contains; keys not in the file are left alone). */
export async function importBackup(file, storage = globalThis.localStorage) {
  const b = validateBackup(JSON.parse(await file.text()));
  let keys = 0;
  for (const [k, v] of Object.entries(b.data)) {
    if (!k.startsWith(PREFIX) || typeof v !== "string") continue;
    storage.setItem(k, v);
    keys++;
  }
  let regs = 0;
  for (const r of b.regulations ?? []) {
    const { pdf, pdfType, ...rest } = r;
    await saveRegulation({ ...rest, blob: pdf ? fromBase64(pdf, pdfType) : undefined });
    regs++;
  }
  return { keys, regulations: regs };
}
