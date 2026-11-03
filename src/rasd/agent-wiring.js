// يربط أدوات الوكيل بالتطبيق الفعلي: بيانات localStorage، محرك التدقيق، مكتبة الأنظمة، وسجل المراجعة.
// ملف التوصيل منفصل عن agent-tools.js كي تُختبر الأدوات بتبعيات وهمية.
import { allDatasets, auditSectors, runAudit } from "./workspace.jsx";
import { createToolbox } from "./agent-tools.js";
import { summarizeAudit } from "./assistant-context.js";
import { retrievePassages, toPayload } from "./legal-retrieval.js";
import { listRegulations } from "./regulations-db.js";
import { draftObservations, loadIds, saveIds } from "./observations";
import { basisStatus } from "./legal-status";
import { loadReviewLog, saveReviewLog } from "./review-log.js";
import { trackEvent } from "./audit-trail.js";

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};

const sectorLabel = (k) => auditSectors.find((s) => s.key === k)?.label ?? k;
const datasetLabel = (k) =>
  k === "manual" ? "ملاحظة مدقق (يدوية)" : (auditSectors.flatMap((s) => s.datasets).find((d) => d.key === k)?.label ?? k);

// الواجهة تحتفظ بنسخة من السجل في حالتها؛ نُعلمها بعد كل كتابة من الوكيل لتعيد القراءة
const notify = () => {
  try {
    globalThis.dispatchEvent?.(new Event("rasd-agent-write"));
  } catch {}
};

export function makeToolbox() {
  return createToolbox({
    getStore: () => readJson("rasd-audit-store", {}),
    runAudit: (store) => runAudit(store, Date.now(), readJson("rasd-audit-params", {})),
    group: (findings, store) =>
      auditSectors.flatMap((s) =>
        draftObservations(
          findings.filter((f) => f.sector === s.key),
          {
            datasetLabel,
            totalRecords: s.datasets.reduce((a, x) => a + (store[x.key]?.length ?? 0), 0),
          },
        ),
      ),
    summarize: (store, findings) => summarizeAudit(store, findings, allDatasets, sectorLabel),
    sectorLabel,
    listDocs: listRegulations,
    retrieve: retrievePassages,
    toPayload,
    loadLog: () => loadReviewLog(),
    saveLog: (log) => (saveReviewLog(log), notify()),
    loadDeleted: () => loadIds("deleted"),
    saveDeleted: (ids) => (saveIds("deleted", ids), notify()),
    basisOf: basisStatus,
    track: trackEvent,
  });
}
