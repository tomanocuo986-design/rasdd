const PREFIX = "rasdenc1:";
const META_KEY = "rasd-vault-meta";
const CHECK = "rasd-vault-ok";
const ITERATIONS = 600000;
const SKIP = /session|auth|token|csrf|^rasd-vault-|^rasd-agent-write$/i;
const enc = new TextEncoder();
const dec = new TextDecoder();

const state = {
  enabled: true,
  session: null,
  orig: null,
  wipers: new Set(),
  lockListeners: new Set(),
};

export class VaultError extends Error {
  constructor(code) {
    super(code);
    this.name = "VaultError";
    this.code = code;
  }
}

const safeLocal = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function configureVault(options) {
  if (options && typeof options.enabled === "boolean") state.enabled = options.enabled;
}

export const isVaultEnabled = () => state.enabled;

export const isSupported = () =>
  typeof globalThis.crypto?.subtle?.importKey === "function" &&
  typeof globalThis.Storage === "function" &&
  !!safeLocal();

export const isProtectedKey = (key) => typeof key === "string" && /^rasd[-_]/i.test(key) && !SKIP.test(key);

export const isUnlocked = () => !!state.session;

export const getKeys = () => state.session?.keys ?? null;

export const getCorrupted = () => (state.session ? [...state.session.corrupted] : []);

export const registerWiper = (fn) => {
  state.wipers.add(fn);
  return () => state.wipers.delete(fn);
};

export const onVaultLock = (fn) => {
  state.lockListeners.add(fn);
  return () => state.lockListeners.delete(fn);
};

export function b64e(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function b64d(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const canCompress = () =>
  typeof CompressionStream === "function" &&
  typeof DecompressionStream === "function" &&
  typeof Response === "function" &&
  typeof Blob === "function" &&
  typeof Blob.prototype.stream === "function";

async function through(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function sealBytes(keys, bytes, aad, compress = true) {
  let zip = compress && canCompress();
  let body = bytes;
  if (zip) {
    try {
      body = await through(bytes, new CompressionStream("gzip"));
    } catch {
      zip = false;
      body = bytes;
    }
  }
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
      keys.aes,
      body,
    ),
  );
  const out = new Uint8Array(13 + ct.length);
  out[0] = zip ? 2 : 1;
  out.set(iv, 1);
  out.set(ct, 13);
  return out;
}

export async function openBytes(keys, data, aad) {
  const flag = data[0];
  if (flag !== 1 && flag !== 2) throw new VaultError("format");
  const body = new Uint8Array(
    await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: data.slice(1, 13), additionalData: enc.encode(aad) },
      keys.aes,
      data.slice(13),
    ),
  );
  return flag === 2 ? through(body, new DecompressionStream("gzip")) : body;
}

export const sealText = async (keys, text, aad) => b64e(await sealBytes(keys, enc.encode(text), aad));

export const openText = async (keys, b64, aad) => dec.decode(await openBytes(keys, b64d(b64), aad));

export async function macSign(keys, bytes) {
  return b64e(new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", keys.mac, bytes)));
}

export async function macVerify(keys, bytes, mac) {
  try {
    return await globalThis.crypto.subtle.verify("HMAC", keys.mac, b64d(mac), bytes);
  } catch {
    return false;
  }
}

async function deriveKeys(password, salt, iterations) {
  const subtle = globalThis.crypto.subtle;
  const base = await subtle.importKey("raw", enc.encode(String(password).normalize("NFKC")), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, 256);
  const hkdf = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const aes = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("rasd-aes-gcm") },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const mac = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("rasd-hmac") },
    hkdf,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign", "verify"],
  );
  return { aes, mac };
}

const fns = () => {
  if (state.orig) return state.orig;
  const p = globalThis.Storage.prototype;
  return { get: p.getItem, set: p.setItem, remove: p.removeItem, clear: p.clear };
};

const readMeta = () => {
  try {
    const raw = fns().get.call(safeLocal(), META_KEY);
    const meta = raw ? JSON.parse(raw) : null;
    return meta && meta.salt && meta.check && meta.iter ? meta : null;
  } catch {
    return null;
  }
};

export const hasVault = () => isSupported() && !!readMeta();

const emit = (name, detail) => {
  try {
    if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent === "function")
      globalThis.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    return;
  }
};

async function runFlush(s) {
  const ls = safeLocal();
  const o = fns();
  while (s.pending.size) {
    const names = [...s.pending];
    s.pending.clear();
    for (const name of names) {
      if (!s.cache.has(name) || !s.keys) continue;
      try {
        const ct = await sealText(s.keys, s.cache.get(name), name);
        o.set.call(ls, name, PREFIX + ct);
      } catch (e) {
        s.errors.push(name);
        emit("rasd-vault-error", { key: name, message: String(e?.message ?? e) });
      }
    }
  }
}

function queueFlush(s) {
  s.chain = s.chain.then(() => runFlush(s));
  return s.chain;
}

function scheduleFlush(s) {
  if (s.scheduled) return;
  s.scheduled = true;
  queueMicrotask(() => {
    s.scheduled = false;
    if (state.session === s) queueFlush(s);
  });
}

export const flushVault = async () => {
  const s = state.session;
  if (s) await queueFlush(s);
};

function install(s) {
  const p = globalThis.Storage.prototype;
  const ls = safeLocal();
  state.orig = { get: p.getItem, set: p.setItem, remove: p.removeItem, clear: p.clear };
  const o = state.orig;
  p.getItem = function (key) {
    if (state.session && this === ls && isProtectedKey(String(key))) {
      const v = state.session.cache.get(String(key));
      return v === undefined ? null : v;
    }
    return o.get.call(this, key);
  };
  p.setItem = function (key, value) {
    if (state.session && this === ls && isProtectedKey(String(key))) {
      const name = String(key);
      s.cache.set(name, String(value));
      s.pending.add(name);
      scheduleFlush(s);
      return;
    }
    return o.set.call(this, key, value);
  };
  p.removeItem = function (key) {
    if (state.session && this === ls && isProtectedKey(String(key))) {
      const name = String(key);
      s.cache.delete(name);
      s.pending.delete(name);
    }
    return o.remove.call(this, key);
  };
  p.clear = function () {
    if (state.session && this === ls) {
      const meta = o.get.call(ls, META_KEY);
      s.cache.clear();
      s.pending.clear();
      o.clear.call(ls);
      if (meta) o.set.call(ls, META_KEY, meta);
      return;
    }
    return o.clear.call(this);
  };
}

function uninstall() {
  if (!state.orig) return;
  const p = globalThis.Storage.prototype;
  p.getItem = state.orig.get;
  p.setItem = state.orig.set;
  p.removeItem = state.orig.remove;
  p.clear = state.orig.clear;
  state.orig = null;
}

function armIdle(s) {
  clearTimeout(s.timer);
  s.last = Date.now();
  if (s.idleMs > 0) s.timer = setTimeout(() => lockVault("idle"), s.idleMs);
}

function attachListeners(s) {
  const g = globalThis;
  if (typeof g.addEventListener !== "function") return;
  const activity = () => {
    if (Date.now() - s.last > 1000) armIdle(s);
  };
  const visible = () => {
    if (g.document?.visibilityState === "visible" && s.idleMs > 0 && Date.now() - s.last > s.idleMs) lockVault("idle");
  };
  const storage = (e) => {
    if (state.session !== s || e.storageArea !== safeLocal()) return;
    if (e.key === null) {
      s.cache.clear();
      return;
    }
    if (!isProtectedKey(e.key)) return;
    if (e.newValue === null) {
      s.cache.delete(e.key);
      return;
    }
    if (e.newValue.startsWith(PREFIX))
      openText(s.keys, e.newValue.slice(PREFIX.length), e.key)
        .then((v) => {
          if (state.session === s) s.cache.set(e.key, v);
        })
        .catch(() => {});
  };
  const events = ["pointerdown", "keydown", "wheel", "touchstart"];
  events.forEach((n) => g.addEventListener(n, activity, { passive: true }));
  g.addEventListener("storage", storage);
  g.document?.addEventListener?.("visibilitychange", visible);
  s.detach = () => {
    events.forEach((n) => g.removeEventListener(n, activity));
    g.removeEventListener("storage", storage);
    g.document?.removeEventListener?.("visibilitychange", visible);
  };
}

async function start(keys, options = {}) {
  const idleMin = options.idleMinutes ?? 15;
  const s = {
    keys,
    cache: new Map(),
    pending: new Set(),
    corrupted: [],
    errors: [],
    chain: Promise.resolve(),
    scheduled: false,
    timer: null,
    last: Date.now(),
    idleMs: idleMin > 0 ? idleMin * 60000 : 0,
    detach: null,
  };
  const ls = safeLocal();
  const o = fns();
  const names = [];
  for (let i = 0; i < ls.length; i++) names.push(ls.key(i));
  for (const name of names) {
    if (!isProtectedKey(name)) continue;
    const v = o.get.call(ls, name);
    if (v == null) continue;
    if (v.startsWith(PREFIX)) {
      try {
        s.cache.set(name, await openText(keys, v.slice(PREFIX.length), name));
      } catch {
        s.corrupted.push(name);
      }
    } else {
      s.cache.set(name, v);
      s.pending.add(name);
    }
  }
  state.session = s;
  install(s);
  await queueFlush(s);
  attachListeners(s);
  armIdle(s);
}

export async function createVault(password, options = {}) {
  if (!isSupported()) throw new VaultError("unsupported");
  if (readMeta()) throw new VaultError("exists");
  if (typeof password !== "string" || password.length < 8) throw new VaultError("weak_password");
  const iter = Math.max(1000, options.iterations ?? ITERATIONS);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const keys = await deriveKeys(password, salt, iter);
  const check = await sealText(keys, CHECK, "meta");
  fns().set.call(safeLocal(), META_KEY, JSON.stringify({ v: 1, iter, salt: b64e(salt), check }));
  await start(keys, options);
}

export async function unlockVault(password, options = {}) {
  if (!isSupported()) throw new VaultError("unsupported");
  if (state.session) return;
  const meta = readMeta();
  if (!meta) throw new VaultError("no_vault");
  const keys = await deriveKeys(password, b64d(meta.salt), meta.iter);
  let ok = false;
  try {
    ok = (await openText(keys, meta.check, "meta")) === CHECK;
  } catch {
    ok = false;
  }
  if (!ok) throw new VaultError("wrong_password");
  await start(keys, options);
}

export async function lockVault(reason = "manual") {
  const s = state.session;
  if (!s) return;
  clearTimeout(s.timer);
  await queueFlush(s);
  for (const fn of [...state.lockListeners]) {
    try {
      fn(reason);
    } catch {
      continue;
    }
  }
  await queueFlush(s);
  state.session = null;
  s.detach?.();
  uninstall();
  s.cache.clear();
  s.pending.clear();
  s.keys = null;
}

export async function resetVault() {
  if (state.session) await lockVault("reset");
  for (const wipe of [...state.wipers]) {
    try {
      await wipe();
    } catch {
      continue;
    }
  }
  const ls = safeLocal();
  if (!ls) return;
  const o = fns();
  const names = [];
  for (let i = 0; i < ls.length; i++) names.push(ls.key(i));
  for (const name of names) if (name === META_KEY || isProtectedKey(name)) o.remove.call(ls, name);
}
