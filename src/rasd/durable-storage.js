// التخزين المستدام: يبقى localStorage هو النسخة العاملة السريعة التي يقرأ منها التطبيق، وتعكس هذه الطبقة كل ما يُكتب في
// مفاتيح "rasd-*" إلى IndexedDB (نسخة ثانية مستقلة) ثم تستعيدها عند فتح الصفحة. الفائدة:
//   - لو مُسح localStorage أو أُخلي تلقائيًا أو فشلت الكتابة لامتلائه، تبقى نتائج التدقيق والتقارير في IndexedDB.
//   - طلب `navigator.storage.persist()` يقلل احتمال أن يمسح المتصفح البيانات عند ضيق المساحة.
// لا تغيّر هذه الطبقة شيئًا في بقية الشيفرة: تعترض setItem/removeItem على localStorage فقط.
//
// قاعدة التعارض: IndexedDB تُكتب مع كل عملية كتابة، فهي ليست أقدم من localStorage؛ لذلك إن اختلفت قيمة مفتاح بين
// الاثنين عند الإقلاع فالمعتمد قيمة IndexedDB. المفاتيح الموجودة في localStorage فقط (بيانات ما قبل التفعيل) تُنسخ إلى IndexedDB.
// مفاتيح "rasd-sync-*" (رمز الدخول للخادم) سرّ خاص بالجهاز ولا تُنسخ أبدًا، كما في النسخ الاحتياطي.

const DB_NAME = "rasd-durable";
const STORE = "kv";
const PREFIX = "rasd-";
const LOCAL_ONLY = "rasd-sync-";

export const isDurableKey = (k) => typeof k === "string" && k.startsWith(PREFIX) && !k.startsWith(LOCAL_ONLY);

const getIdb = () => (typeof indexedDB === "undefined" ? undefined : indexedDB);

function openDb(idb = getIdb()) {
  return new Promise((res, rej) => {
    if (!idb) return rej(new Error("IndexedDB غير متاحة"));
    const r = idb.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "key" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("فتح قاعدة التخزين محجوب"));
  });
}

/** Reads every mirrored record: [{ key, value, updatedAt }]. */
export async function readAll(idb) {
  const db = await openDb(idb);
  try {
    return await new Promise((res, rej) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      r.onsuccess = () => res(r.result ?? []);
      r.onerror = () => rej(r.error);
    });
  } finally {
    db.close();
  }
}

/** Writes [[key, value | null]] in a single transaction (null deletes). */
export async function writeBatch(entries, idb) {
  if (!entries.length) return;
  const db = await openDb(idb);
  try {
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      const os = tx.objectStore(STORE);
      const now = Date.now();
      for (const [key, value] of entries) {
        if (value === null) os.delete(key);
        else os.put({ key, value, updatedAt: now });
      }
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error ?? new Error("أُلغيت عملية الحفظ"));
    });
  } finally {
    db.close();
  }
}

const localDurableKeys = (storage) => {
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (isDurableKey(k)) keys.push(k);
  }
  return keys;
};

/**
 * يُستدعى مرة عند فتح الصفحة قبل عرض الواجهة: يستعيد من IndexedDB ما فُقد أو اختلف في localStorage،
 * وينسخ إلى IndexedDB ما لا يوجد فيها بعد. لا يرمي أخطاء: أي فشل يعني أن التطبيق يعمل بـ localStorage كما كان.
 */
export async function hydrate({ storage = globalThis.localStorage, idb } = {}) {
  const result = { restored: 0, seeded: 0, failed: [], total: 0, available: true };
  let records;
  try {
    records = await readAll(idb);
  } catch {
    return { ...result, available: false };
  }
  const mirrored = new Map(records.map((r) => [r.key, r.value]));
  for (const [key, value] of mirrored) {
    if (!isDurableKey(key) || typeof value !== "string") continue;
    let current = null;
    try {
      current = storage.getItem(key);
    } catch {
      /* unreadable: treat as missing */
    }
    if (current === value) continue;
    try {
      storage.setItem(key, value);
      result.restored++;
    } catch {
      // localStorage is full: the data stays safe in IndexedDB; the user should export a backup
      result.failed.push(key);
    }
  }
  const seed = [];
  for (const key of localDurableKeys(storage)) {
    if (!mirrored.has(key)) seed.push([key, storage.getItem(key) ?? ""]);
  }
  try {
    await writeBatch(seed, idb);
    result.seeded = seed.length;
  } catch {
    /* not critical */
  }
  result.total = new Set([...mirrored.keys(), ...seed.map(([k]) => k)]).size;
  return result;
}

/**
 * يعترض setItem/removeItem على localStorage ويعكس مفاتيح rasd-* إلى IndexedDB (دفعة واحدة لكل دورة أحداث).
 * الاعتراض يتم قبل الكتابة الفعلية، فحتى لو فشلت الكتابة لامتلاء localStorage تُحفظ القيمة في IndexedDB.
 * يعيد دالة لإلغاء الاعتراض (تُستعمل في الاختبارات).
 */
export function installMirror({ storage = globalThis.localStorage, idb, onError } = {}) {
  const proto = Object.getPrototypeOf(storage);
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  let pending = new Map();
  let scheduled = false;
  let last = { at: 0, error: null };

  const flush = async () => {
    scheduled = false;
    const batch = [...pending];
    pending = new Map();
    if (!batch.length) return;
    try {
      await writeBatch(batch, idb);
      last = { at: Date.now(), error: null };
    } catch (e) {
      last = { at: last.at, error: e };
      onError?.(e);
    }
  };
  const queue = (key, value) => {
    pending.set(key, value);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  };

  proto.setItem = function (key, value) {
    if (this === storage && isDurableKey(key)) queue(key, String(value));
    return origSet.call(this, key, value);
  };
  proto.removeItem = function (key) {
    if (this === storage && isDurableKey(key)) queue(key, null);
    return origRemove.call(this, key);
  };

  const onHide = () => void flush();
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && onHide());
  }
  const stop = () => {
    proto.setItem = origSet;
    proto.removeItem = origRemove;
    if (typeof window !== "undefined") window.removeEventListener("pagehide", onHide);
  };
  stop.flush = flush;
  stop.status = () => last;
  return stop;
}

/** Best effort: asks the browser not to evict RASD's storage under pressure. Resolves to true/false/undefined. */
export async function requestPersistence() {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return undefined;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return undefined;
  }
}

/** For the status line in the backup panel. */
export async function durableStats({ idb } = {}) {
  try {
    const records = await readAll(idb);
    const bytes = records.reduce((a, r) => a + (r.key.length + String(r.value).length) * 2, 0);
    const updatedAt = records.reduce((a, r) => Math.max(a, r.updatedAt ?? 0), 0);
    let persisted;
    try {
      persisted = await navigator.storage?.persisted?.();
    } catch {
      /* unsupported */
    }
    return { available: true, keys: records.length, bytes, updatedAt: updatedAt || undefined, persisted };
  } catch {
    return { available: false, keys: 0, bytes: 0 };
  }
}

let started;
/**
 * نقطة الدخول للواجهة: استعادة ثم تركيب الاعتراض ثم طلب الثبات. تُنفَّذ مرة واحدة وتعيد نتيجة الاستعادة.
 * مهلة الأمان (3 ثوانٍ) تضمن ألا تتعطل الواجهة إن تعطلت IndexedDB في متصفح مقيّد.
 */
export function initDurableStorage({ timeoutMs = 3000 } = {}) {
  if (started) return started;
  if (typeof window === "undefined") return Promise.resolve({ restored: 0, seeded: 0, failed: [], total: 0, available: false });
  const run = (async () => {
    const result = await hydrate();
    if (result.available) {
      installMirror();
      void requestPersistence();
    }
    return result;
  })();
  const timeout = new Promise((res) =>
    setTimeout(() => res({ restored: 0, seeded: 0, failed: [], total: 0, available: false, timedOut: true }), timeoutMs),
  );
  started = Promise.race([run, timeout]);
  return started;
}
