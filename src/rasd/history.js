// @ts-nocheck
/**
 * طبقة المقارنة التاريخية: تقرأ تقارير التدقيق السابقة (المحفوظة أو المستوردة) وتصنف الملاحظات الحالية إلى
 *   - جديدة: لم ترد في أي تقرير سابق.
 *   - متكررة: وردت بعينها (نفس الجدول والاختبار والسجل) في تقرير سابق، أو ورد نمطها (نفس الاختبار بسجل مختلف).
 *   - معالجة: وردت في آخر تقرير ولم تعد ظاهرة الآن (ويُشترط أن يكون جدولها ما زال يحمل بيانات حتى لا يُعتبر الغياب معالجة).
 */
export const findingKey = (dataset, test, ref) => `${dataset}|${String(test).trim()}|${String(ref ?? "").trim()}`;
export const testKey = (dataset, test) => `${dataset}|${String(test).trim()}`;

export const STATUS_LABEL = { new: "جديدة", recurring: "متكررة", pattern: "نمط متكرر", resolved: "معالجة" };

const byDate = (a, b) => String(a.date ?? "").localeCompare(String(b.date ?? ""));

/** فهرس التقارير السابقة: عدد مرات ورود كل مخالفة وتقاريرها والتوصيات السابقة. */
export function buildHistoryIndex(reports = []) {
  const exact = new Map();
  const pattern = new Map();
  const recommendations = new Map();
  const sorted = [...reports].sort(byDate);
  for (const r of sorted) {
    const seenExact = new Set();
    const seenPattern = new Set();
    for (const f of r.findings ?? []) {
      const key = f.key ?? findingKey(f.dataset, f.test, f.ref);
      if (!seenExact.has(key)) {
        seenExact.add(key);
        const e = exact.get(key) ?? { count: 0, reports: [] };
        e.count += 1;
        e.reports.push({ name: r.name, date: r.date });
        exact.set(key, e);
      }
      const tk = testKey(f.dataset, f.test);
      if (!seenPattern.has(tk)) {
        seenPattern.add(tk);
        const p = pattern.get(tk) ?? { count: 0, reports: [] };
        p.count += 1;
        p.reports.push({ name: r.name, date: r.date });
        pattern.set(tk, p);
      }
    }
    for (const o of r.observations ?? []) {
      if (o.recommendation) recommendations.set(testKey(o.dataset, o.test), { text: o.recommendation, report: r.name, date: r.date });
    }
    for (const rec of r.recommendations ?? []) {
      if (rec.test && rec.text) {
        const k = rec.dataset ? testKey(rec.dataset, rec.test) : `*|${rec.test.trim()}`;
        recommendations.set(k, { text: rec.text, report: r.name, date: r.date });
      }
    }
  }
  return { exact, pattern, recommendations, last: sorted[sorted.length - 1], count: sorted.length };
}

/** يضيف لكل ملاحظة حالية حالتها التاريخية وعدد تكرارها والتوصية السابقة. */
export function classifyFindings(findings, index) {
  return findings.map((f) => {
    const ex = index.exact.get(f.key);
    const pt = index.pattern.get(testKey(f.dataset, f.test));
    const rec = index.recommendations.get(testKey(f.dataset, f.test)) ?? index.recommendations.get(`*|${String(f.test).trim()}`);
    const status = ex ? "recurring" : pt ? "pattern" : "new";
    return {
      ...f,
      history: {
        status,
        exactCount: ex?.count ?? 0,
        patternCount: pt?.count ?? 0,
        reports: (ex ?? pt)?.reports ?? [],
        previousRecommendation: rec,
      },
    };
  });
}

/**
 * الملاحظات المعالجة: وردت في آخر تقرير ولم تعد قائمة.
 * activeDatasets: مفاتيح الجداول التي تحمل بيانات الآن؛ ما عداها غير قابل للتحقق فلا يُعد معالجاً.
 */
export function resolvedFindings(index, currentKeys, activeDatasets) {
  const last = index.last;
  if (!last) return { resolved: [], unverifiable: [] };
  const resolved = [];
  const unverifiable = [];
  for (const f of last.findings ?? []) {
    const key = f.key ?? findingKey(f.dataset, f.test, f.ref);
    if (currentKeys.has(key)) continue;
    const entry = { ...f, key, report: last.name };
    if (f.dataset && activeDatasets.has(f.dataset)) resolved.push(entry);
    else unverifiable.push(entry);
  }
  return { resolved, unverifiable };
}

export function historySummary(classified, resolved) {
  const count = (s) => classified.filter((f) => f.history?.status === s).length;
  const recurring = count("recurring") + count("pattern");
  return { new: count("new"), recurring, resolved: resolved.length, total: classified.length };
}

/* ------------------------------ استيراد التقارير السابقة ------------------------------ */

const SEV = (s) => (/مرتفع|high/i.test(s) ? "high" : /متوسط|medium/i.test(s) ? "medium" : /منخفض|low/i.test(s) ? "low" : undefined);

/** صفوف ورقة «نتائج التدقيق» المصدّرة من النظام (Excel/CSV). */
export function findingsFromRows(rows) {
  const pick = (r, ...names) => {
    for (const n of names) if (r[n] !== undefined && String(r[n]).trim() !== "") return String(r[n]).trim();
    return "";
  };
  const out = [];
  for (const r of rows) {
    const dataset = pick(r, "رمز الجدول", "dataset");
    const test = pick(r, "الاختبار", "test");
    const severity = SEV(pick(r, "المخاطر النهائية", "المخاطر الأساسية", "severity"));
    if (!dataset || !test || !severity) continue;
    const ref = pick(r, "المعرّف", "ref");
    out.push({ key: findingKey(dataset, test, ref), dataset, test, ref, severity, detail: pick(r, "التفاصيل", "detail") });
  }
  return out;
}

/** تقرير محفوظ بصيغة JSON (نسخة احتياطية من النظام). */
export function reportFromJson(text, fallbackName) {
  const v = JSON.parse(text);
  const list = Array.isArray(v) ? v : [v];
  return list
    .filter((r) => r && Array.isArray(r.findings))
    .map((r) => ({
      id: r.id ?? (globalThis.crypto?.randomUUID?.() ?? `r${Date.now()}${Math.random()}`),
      name: r.name ?? fallbackName,
      date: r.date ?? new Date().toISOString().slice(0, 10),
      findings: r.findings.map((f) => ({ ...f, key: f.key ?? findingKey(f.dataset, f.test, f.ref) })),
      observations: r.observations,
      recommendations: r.recommendations,
      compliance: r.compliance,
    }));
}

/**
 * استخراج التوصيات من أسطر تقرير سابق: سطر «ملاحظة رقابية N: العنوان — مخاطر …» ثم سطر «التوصية: …».
 * lines: أسطر نص التقرير بعد تطبيع الاتجاه.
 */
export function extractRecommendations(lines) {
  const out = [];
  let test = "";
  for (const raw of lines) {
    const line = String(raw).trim();
    const head = /^ملاحظة رقابية\s*\d*\s*:?\s*(.+?)\s*[—-]\s*مخاطر/.exec(line);
    if (head) {
      test = head[1].trim();
      continue;
    }
    const rec = /^التوصية\s*:\s*(.+)$/.exec(line);
    if (rec && test) out.push({ test, text: rec[1].trim() });
  }
  return out;
}
