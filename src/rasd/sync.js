// Hybrid storage client: the browser (localStorage + IndexedDB) stays the fast, offline-capable working copy; this module
// mirrors it to the server database (/api/workspaces) so records survive clearing the browser or switching devices.
// Config lives under "rasd-sync-*" keys, which backup.js never exports (the token is a device secret).
import { applyBackup, buildBackup, localKeys } from "./backup.js";

const K = {
  url: "rasd-sync-url", // optional: another server; empty = same origin
  token: "rasd-sync-token",
  id: "rasd-sync-workspace",
  version: "rasd-sync-version", // last server version this device has seen
  hash: "rasd-sync-hash", // fingerprint of the data at the last successful push
  auto: "rasd-sync-auto",
};

const get = (k, s = globalThis.localStorage) => {
  try {
    return s.getItem(k) ?? "";
  } catch {
    return "";
  }
};
const set = (k, v, s = globalThis.localStorage) => {
  try {
    s.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export const getSyncConfig = (s) => ({
  url: get(K.url, s),
  token: get(K.token, s),
  id: get(K.id, s),
  version: Number(get(K.version, s)) || 0,
  auto: get(K.auto, s) === "1",
});

export function saveSyncConfig(cfg, s = globalThis.localStorage) {
  if (cfg.url !== undefined) set(K.url, cfg.url.trim().replace(/\/+$/, ""), s);
  if (cfg.token !== undefined) set(K.token, cfg.token.trim(), s);
  if (cfg.id !== undefined) set(K.id, cfg.id.trim(), s);
  if (cfg.auto !== undefined) set(K.auto, cfg.auto ? "1" : "0", s);
}

export const newWorkspaceId = () => `ws-${crypto.randomUUID().slice(0, 12)}`;

/** Cheap fingerprint of the RASD data (FNV-1a over keys + values) to know whether anything changed. */
export function dataFingerprint(storage = globalThis.localStorage) {
  let h = 0x811c9dc5;
  const mix = (str) => {
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  for (const k of localKeys(storage).sort()) {
    mix(k);
    mix(storage.getItem(k) ?? "");
  }
  return h.toString(16);
}

async function call(cfg, query, init = {}, fetchFn = globalThis.fetch) {
  if (!cfg.token) throw Object.assign(Error("أدخل رمز الدخول للمزامنة"), { status: 401 });
  let res;
  try {
    res = await fetchFn(`${cfg.url}/api/workspaces${query}`, {
      ...init,
      headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json", ...init.headers },
    });
  } catch {
    throw Object.assign(Error("تعذّر الاتصال بالخادم (تحقق من الشبكة)"), { status: 0 });
  }
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok)
    throw Object.assign(Error(body.error || `خطأ من الخادم (${res.status})`), {
      status: res.status,
      currentVersion: body.currentVersion,
    });
  return body;
}

export const listWorkspaces = (s, f) => call(getSyncConfig(s), "", {}, f).then((b) => b.workspaces ?? []);

/**
 * Pushes the current data. `force` overwrites a newer server copy (use after the user chose "keep mine").
 * Throws an error with status 409 when the server copy changed since this device last synced.
 */
export async function pushWorkspace({ name, force = false, storage = globalThis.localStorage, fetchFn } = {}) {
  const cfg = getSyncConfig(storage);
  if (!cfg.id) throw Error("اختر مساحة عمل أو أنشئ واحدة أولًا");
  const backup = await buildBackup(storage, "text"); // regulations text + metadata are mirrored; the original PDFs stay in the local backup file (too large to mirror)
  let baseVersion = cfg.version;
  const send = () =>
    call(
      cfg,
      `?id=${encodeURIComponent(cfg.id)}`,
      { method: "PUT", body: JSON.stringify({ name: name || cfg.id, payload: backup, baseVersion }) },
      fetchFn,
    );
  let r;
  try {
    r = await send();
  } catch (e) {
    if (e.status === 409 && force) {
      baseVersion = e.currentVersion ?? 0;
      r = await send();
    } else throw e;
  }
  set(K.version, String(r.version), storage);
  set(K.hash, dataFingerprint(storage), storage);
  return { version: r.version };
}

/** Replaces local RASD data with the server copy. Caller reloads the page afterwards. */
export async function pullWorkspace({ storage = globalThis.localStorage, fetchFn } = {}) {
  const cfg = getSyncConfig(storage);
  if (!cfg.id) throw Error("اختر مساحة عمل أولًا");
  const w = await call(cfg, `?id=${encodeURIComponent(cfg.id)}`, {}, fetchFn);
  const r = await applyBackup(w.payload, storage);
  set(K.version, String(w.version), storage);
  set(K.hash, dataFingerprint(storage), storage);
  return { ...r, version: w.version, name: w.name };
}

/**
 * Background sync: every `everyMs` pushes if the data changed since the last push. Conflicts and network errors are
 * reported through onStatus and retried later; nothing is ever overwritten automatically on a conflict.
 * Returns a stop() function.
 */
export function startAutoSync({ everyMs = 30_000, onStatus, storage = globalThis.localStorage, fetchFn } = {}) {
  let stopped = false;
  let running = false;
  const tick = async () => {
    const cfg = getSyncConfig(storage);
    if (stopped || running || !cfg.auto || !cfg.token || !cfg.id) return;
    if (dataFingerprint(storage) === get(K.hash, storage)) return;
    running = true;
    try {
      const r = await pushWorkspace({ storage, fetchFn });
      onStatus?.({ state: "ok", version: r.version, at: Date.now() });
    } catch (e) {
      onStatus?.({ state: e.status === 409 ? "conflict" : "error", message: e.message, at: Date.now() });
    } finally {
      running = false;
    }
  };
  const t = setInterval(tick, everyMs);
  return () => {
    stopped = true;
    clearInterval(t);
  };
}
