import { legalFrameworkOf } from "./legal-framework.js";

// مخزن صغير يشاركه التطبيق مع المساعد الذكي: أقسام (entries / audit) كل قسم ملخص لما يراه المستخدم.
const sections = {};
let merged = null;
const listeners = new Set();

export function publishAssistantContext(section, data) {
  if (data == null) delete sections[section];
  else sections[section] = data;
  merged = Object.keys(sections).length ? { ...sections } : null;
  listeners.forEach((fn) => fn());
}

export function getAssistantContext() {
  return merged;
}

export function subscribeAssistantContext(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// يحوّل الملخص إلى نص مضغوط يُرسل للنموذج (بحد أقصى للحجم).
export function serializeAssistantContext(ctx, maxChars = 13500) {
  if (!ctx) return "";
  let text;
  try {
    text = JSON.stringify(ctx);
  } catch {
    return "";
  }
  return text.length > maxChars ? text.slice(0, maxChars) + "…(مقتطع)" : text;
}

// يبني ملخص التدقيق المرسل للمساعد من المخزن والملاحظات (يستعمله Workspace وAssistantChat).
function legalOf(f) {
  if (f.regulation) return `${f.regulation.doc}: ${String(f.regulation.excerpt ?? "").slice(0, 160)}`;
  const fw = f.legal ?? legalFrameworkOf(f);
  if (!fw) return undefined;
  return `${fw.instruments.join(" ؛ ")} — ${fw.article}${fw.needsVerification ? " (يحتاج تحقق)" : ""}`;
}

export function summarizeAudit(store, findings, datasets, sectorLabel) {
  const counts = Object.fromEntries(
    datasets.map((d) => [d.key, (store[d.key] ?? []).length]).filter(([, c]) => c > 0),
  );
  if (!Object.keys(counts).length) return null;
  const tally = (arr, fn) =>
    arr.reduce((m, x) => ((m[fn(x)] = (m[fn(x)] ?? 0) + 1), m), {});
  const sev = (f) => f.finalSeverity ?? f.severity;
  const rank = { high: 0, medium: 1, low: 2 };
  const top = [...findings].sort((a, b) => (rank[sev(a)] ?? 3) - (rank[sev(b)] ?? 3));
  return {
    rowsPerDataset: counts,
    findingsTotal: findings.length,
    bySeverity: tally(findings, sev),
    bySector: tally(findings, (f) => sectorLabel(f.sector)),
    byTest: tally(findings, (f) => f.test),
    totalImpact: findings.reduce((a, f) => a + (Number(f.impact) || 0), 0),
    repeatedFromPastReports: findings.filter((f) => f.repeat).length,
    topFindings: top.slice(0, 30).map((f, i) => ({
      sector: sectorLabel(f.sector),
      dataset: f.dataset,
      test: f.test,
      severity: sev(f),
      detail: f.detail,
      ref: f.ref,
      impact: f.impact,
      repeat: f.repeat ? true : undefined,
      // السند القانوني لأعلى الملاحظات فقط (لتبقى الحمولة ضمن الحد)؛ يستعمله وضع «مسودة التقرير»
      legal: i < 10 ? legalOf(f) : undefined,
    })),
  };
}
