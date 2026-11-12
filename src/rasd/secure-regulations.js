import * as raw from "./regulations-db";
import {
  b64d,
  b64e,
  getKeys,
  isUnlocked,
  isVaultEnabled,
  macSign,
  macVerify,
  onVaultLock,
  openBytes,
  registerWiper,
  sealBytes,
  VaultError,
} from "./secure-vault.js";

const MARK = "rasd-sealed-1";
const SEALED_FIELDS = new Set(["text", "blob", "textSealed", "blobSealed", "mac"]);
const DERIVED_FIELDS = new Set(["vault", "blobType", "blobName"]);
const enc = new TextEncoder();
const dec = new TextDecoder();
const opened = new Map();

onVaultLock(() => opened.clear());

export const isSealed = (d) => !!d && d.vault === MARK;

const metaOf = (doc) => {
  const meta = {};
  for (const k of Object.keys(doc)) if (!SEALED_FIELDS.has(k) && doc[k] !== undefined) meta[k] = doc[k];
  return meta;
};

const canonical = (meta) =>
  JSON.stringify(
    Object.keys(meta)
      .sort()
      .map((k) => [k, meta[k]]),
  );

const macInput = (meta, textSealed, blobSealed) => {
  const a = enc.encode(canonical(meta));
  const b = enc.encode(textSealed ?? "");
  const c = blobSealed ? new Uint8Array(blobSealed) : new Uint8Array(0);
  const out = new Uint8Array(a.length + b.length + c.length + 2);
  out.set(a, 0);
  out[a.length] = 0;
  out.set(b, a.length + 1);
  out[a.length + 1 + b.length] = 0;
  out.set(c, a.length + b.length + 2);
  return out;
};

export async function sealDoc(keys, doc) {
  const out = metaOf(doc);
  out.vault = MARK;
  out.textSealed = b64e(await sealBytes(keys, enc.encode(doc.text ?? ""), String(doc.id)));
  if (doc.blob) {
    const bytes = new Uint8Array(await doc.blob.arrayBuffer());
    out.blobSealed = await sealBytes(keys, bytes, `${doc.id}#blob`, false);
    out.blobType = doc.blob.type || "";
    out.blobName = doc.blob.name || "";
  }
  out.mac = await macSign(keys, macInput(metaOf(out), out.textSealed, out.blobSealed));
  return out;
}

export async function openDoc(keys, d) {
  const meta = metaOf(d);
  const ok = await macVerify(keys, macInput(meta, d.textSealed, d.blobSealed), d.mac);
  if (!ok) throw new VaultError("integrity");
  const out = {};
  for (const k of Object.keys(meta)) if (!DERIVED_FIELDS.has(k)) out[k] = meta[k];
  out.text = dec.decode(await openBytes(keys, b64d(d.textSealed), String(d.id)));
  if (d.blobSealed) {
    const bytes = await openBytes(keys, new Uint8Array(d.blobSealed), `${d.id}#blob`);
    out.blob = d.blobName
      ? new File([bytes], d.blobName, { type: d.blobType })
      : new Blob([bytes], { type: d.blobType });
  }
  return out;
}

const emit = (name, detail) => {
  try {
    if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent === "function")
      globalThis.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    return;
  }
};

const active = () => isVaultEnabled();

export async function listRegulations() {
  const rows = await raw.listRegulations();
  if (!active()) return rows;
  if (!isUnlocked()) return [];
  const keys = getKeys();
  const out = [];
  const bad = [];
  for (const d of rows) {
    if (!isSealed(d)) {
      out.push(d);
      try {
        await raw.saveRegulation(await sealDoc(keys, d));
      } catch {
        continue;
      }
      continue;
    }
    const ck = `${d.id}|${d.mac}`;
    let o = opened.get(ck);
    if (!o) {
      try {
        o = await openDoc(keys, d);
        opened.set(ck, o);
      } catch {
        bad.push({ id: d.id, name: d.name });
        continue;
      }
    }
    out.push(o);
  }
  if (bad.length) emit("rasd-vault-integrity", bad);
  return out;
}

export async function saveRegulation(doc) {
  if (!active()) return raw.saveRegulation(doc);
  if (!isUnlocked()) throw new VaultError("locked");
  const sealed = await sealDoc(getKeys(), doc);
  for (const k of [...opened.keys()]) if (k.startsWith(`${doc.id}|`)) opened.delete(k);
  return raw.saveRegulation(sealed);
}

export async function deleteRegulation(id) {
  for (const k of [...opened.keys()]) if (k.startsWith(`${id}|`)) opened.delete(k);
  return raw.deleteRegulation(id);
}

export async function updateRegulationMeta(id, patch) {
  if (!active()) return raw.updateRegulationMeta(id, patch);
  if (!isUnlocked()) throw new VaultError("locked");
  const keys = getKeys();
  const rows = await raw.listRegulations();
  const d = rows.find((x) => x.id === id);
  if (!d) return undefined;
  const current = isSealed(d) ? await openDoc(keys, d) : d;
  return saveRegulation({ ...current, ...patch, id });
}

registerWiper(async () => {
  const rows = await raw.listRegulations();
  for (const d of rows) await raw.deleteRegulation(d.id);
  opened.clear();
});
