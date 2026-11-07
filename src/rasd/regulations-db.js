// IndexedDB store for the uploaded regulations library (extracted from workspace.jsx).
const DB = "rasd-audit-library";

function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("regulations", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const r = fn(d.transaction("regulations", mode).objectStore("regulations"));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export const listRegulations = () => tx("readonly", (s) => s.getAll());
export const saveRegulation = (d) => tx("readwrite", (s) => s.put(d));
export const deleteRegulation = (id) => tx("readwrite", (s) => s.delete(id));

export const getRegulation = (id) => tx("readonly", (s) => s.get(id));

/** يحدّث بيانات النسخة (تاريخ النفاذ والمصدر) دون المساس بالنص أو الملف المرفوع. */
export async function updateRegulationMeta(id, patch) {
  const allowed = {};
  if (typeof patch?.effectiveDate === "string") allowed.effectiveDate = patch.effectiveDate;
  if (typeof patch?.sourceNote === "string") allowed.sourceNote = patch.sourceNote;
  const d = await db();
  return new Promise((res, rej) => {
    const store = d.transaction("regulations", "readwrite").objectStore("regulations");
    const g = store.get(id);
    g.onsuccess = () => {
      if (!g.result) return res(false);
      const w = store.put({ ...g.result, ...allowed });
      w.onsuccess = () => res(true);
      w.onerror = () => rej(w.error);
    };
    g.onerror = () => rej(g.error);
  });
}
