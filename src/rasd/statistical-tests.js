// @ts-nocheck
/**
 * التحليل الإحصائي المحلي (مجاني، بلا خدمة خارجية ولا مفتاح):
 *   1) قانون بنفورد: توزيع الرقم الأول في المبالغ.
 *   2) تجمّع المبالغ تحت سقف الصلاحية أو تحت الأعداد المستديرة.
 *   3) تكرار مبلغ لنفس المورد (وأمر الشراء المكرر).
 *   4) درجة شذوذ مركّبة لكل مورد (مجموع مؤشرات مفسَّرة، لا صندوق أسود).
 *
 * هذه مؤشرات توجّه المدقق إلى ما يستحق الفحص، وليست دليل تلاعب. كل ملاحظة تذكر المؤشرات التي بُنيت عليها.
 * الشكل: { dataset, sector, row, severity, test, detail, amount? } كبقية المحرك.
 */
import { parseStamp } from "./advanced-queries.js";

export const STAT = "تحليل إحصائي: ";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const DAY = 864e5;
const txt = (v) => String(v ?? "").trim();
const num = (v) => {
  const s = txt(v)
    .replace(/[٠-٩]/g, (c) => AR_DIGITS.indexOf(c))
    .replaceAll(",", "")
    .replaceAll("٬", "");
  const x = Number(s);
  return s === "" || !Number.isFinite(x) ? undefined : x;
};
const norm = (s) =>
  txt(s)
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .toLowerCase();

const VALUE_KEYS = ["amount", "value", "net", "total", "awarded_value", "book_value", "variance_value", "closing", "approved", "cost", "invoices"];
export const valueKey = (ds) =>
  VALUE_KEYS.find((k) => ds.fields.some((f) => f.key === k && f.type === "number")) ?? ds.fields.find((f) => f.type === "number")?.key;

/* ------------------------------ 1) قانون بنفورد ------------------------------ */

export const BENFORD = Array.from({ length: 9 }, (_, i) => Math.log10(1 + 1 / (i + 1)));
const CHI_05 = 15.507; // df = 8, p = 0.05
const CHI_01 = 20.09; // df = 8, p = 0.01

export function firstDigit(v) {
  const x = Math.abs(v);
  if (!Number.isFinite(x) || x <= 0) return 0;
  const s = x.toExponential(); // "d.ddde+k"
  return Number(s[0]);
}

/** يحسب توزيع الرقم الأول مقابل بنفورد. يعيد null إن قلّ العدد عن الحد الأدنى (النتائج حينها غير موثوقة). */
export function benfordTest(values, minN = 100) {
  const vals = values.filter((v) => Number.isFinite(v) && Math.abs(v) >= 10); // أقل من 10 يخل بالرقم الأول
  const n = vals.length;
  if (n < minN) return null;
  const counts = Array(9).fill(0);
  vals.forEach((v) => counts[firstDigit(v) - 1]++);
  let chi2 = 0;
  let mad = 0;
  let worst = { d: 1, diff: 0 };
  counts.forEach((c, i) => {
    const exp = BENFORD[i] * n;
    chi2 += (c - exp) ** 2 / exp;
    const diff = c / n - BENFORD[i];
    mad += Math.abs(diff) / 9;
    if (Math.abs(diff) > Math.abs(worst.diff)) worst = { d: i + 1, diff };
  });
  return { n, counts, chi2, mad, worst };
}

export function benfordFindings(store, datasets, sectorOf, { minN = 100 } = {}) {
  const out = [];
  for (const ds of datasets) {
    const key = valueKey(ds);
    if (!key) continue;
    const t = benfordTest((store[ds.key] ?? []).map((r) => num(r[key])).filter((x) => x !== undefined), minN);
    if (!t) continue;
    let severity;
    if (t.chi2 > CHI_01 && t.mad > 0.015) severity = "high";
    else if (t.chi2 > CHI_05 && t.mad > 0.012) severity = "medium";
    if (!severity) continue;
    const label = ds.fields.find((f) => f.key === key)?.label ?? key;
    out.push({
      dataset: ds.key,
      sector: sectorOf(ds.key),
      row: 0,
      severity,
      test: `${STAT}اختلال توزيع الأرقام الأولى (قانون بنفورد)`,
      detail: `«${label}» في ${t.n} سجلًا: χ² = ${t.chi2.toFixed(1)} ومتوسط الانحراف المطلق ${(t.mad * 100).toFixed(2)}%؛ أكبر انحراف عند الرقم ${t.worst.d} (${t.worst.diff > 0 ? "زيادة" : "نقص"} ${(Math.abs(t.worst.diff) * 100).toFixed(1)} نقطة مئوية). مؤشر يستدعي فحص عينة، وليس دليل تلاعب.`,
    });
  }
  return out;
}

/* ------------------------------ 2) تجمّع تحت السقف ------------------------------ */

const ROUND_LEVELS = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

/** مبالغ داخل 5% دون السقف المحدد. */
export function belowThreshold(values, T, pct = 0.05) {
  return values.map((v, i) => ({ v, i })).filter(({ v }) => v !== undefined && v >= T * (1 - pct) && v < T);
}

/** يبحث عن عدد مستدير تتكدس تحته القيم أكثر منه بوضوح (3 أضعاف على الأقل وبحد أدنى 3 قيم). */
export function roundNumberBunching(values, { minN = 30 } = {}) {
  const vals = values.filter((v) => v !== undefined && v > 0);
  if (vals.length < minN) return null;
  let best = null;
  for (const R of ROUND_LEVELS) {
    const below = vals.filter((v) => v >= R * 0.95 && v < R).length;
    const above = vals.filter((v) => v >= R && v < R * 1.05).length;
    if (below >= 3 && below >= 3 * Math.max(above, 1) && (!best || below > best.below)) best = { R, below, above };
  }
  return best;
}

export function thresholdFindings(store, datasets, sectorOf, p = {}) {
  const out = [];
  const ceiling = Number(p.directPurchaseCeiling) || 0;
  if (ceiling > 0) {
    const rows = store.Direct_Purchases_Orders ?? [];
    const hits = belowThreshold(rows.map((r) => num(r.value)), ceiling);
    const bySupplier = new Map();
    hits.forEach((h) => {
      const k = norm(rows[h.i].supplier);
      bySupplier.set(k, (bySupplier.get(k) ?? 0) + 1);
    });
    hits.forEach(({ v, i }) => {
      const k = norm(rows[i].supplier);
      const repeated = k && bySupplier.get(k) >= 2;
      out.push({
        dataset: "Direct_Purchases_Orders",
        sector: sectorOf("Direct_Purchases_Orders"),
        row: i,
        severity: repeated ? "high" : "medium",
        test: `${STAT}تجمّع مبالغ تحت سقف الصلاحية`,
        detail: `${txt(rows[i].supplier) || "مورد غير مسمّى"} — ${v.toLocaleString("en-US")} (أقل من السقف ${ceiling.toLocaleString("en-US")} بأقل من 5%)${repeated ? ` — تكرر ${bySupplier.get(k)} مرات لنفس المورد` : ""}`,
        amount: v,
      });
    });
  }
  for (const ds of datasets) {
    const key = valueKey(ds);
    if (!key) continue;
    const b = roundNumberBunching((store[ds.key] ?? []).map((r) => num(r[key])));
    if (!b) continue;
    out.push({
      dataset: ds.key,
      sector: sectorOf(ds.key),
      row: 0,
      severity: "medium",
      test: `${STAT}تجمّع مبالغ تحت سقف الصلاحية`,
      detail: `${b.below} قيمة بين ${(b.R * 0.95).toLocaleString("en-US")} و${b.R.toLocaleString("en-US")} مقابل ${b.above} قيمة فوق الحد مباشرة (حتى ${(b.R * 1.05).toLocaleString("en-US")}): تكدّس غير طبيعي تحت عدد مستدير قد يدل على تفادٍ لسقف صلاحية.`,
    });
  }
  return out;
}

/* ------------------------------ 3) تكرار المبلغ ------------------------------ */

export function duplicateFindings(store, sectorOf, { windowDays = 30 } = {}) {
  const rows = store.Direct_Purchases_Orders ?? [];
  const groups = new Map();
  rows.forEach((r, i) => {
    const sup = norm(r.supplier);
    const v = num(r.value);
    if (!sup || v === undefined || v <= 0) return;
    const k = `${sup}|${v}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const out = [];
  const push = (i, severity, detail, amount) =>
    out.push({ dataset: "Direct_Purchases_Orders", sector: sectorOf("Direct_Purchases_Orders"), row: i, severity, test: `${STAT}تكرار مبلغ لنفس المورد`, detail, amount });
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const first = rows[idxs[0]];
    const v = num(first.value);
    const nos = idxs.map((i) => norm(rows[i].po_no)).filter(Boolean);
    const sameNo = new Set(nos).size < nos.length;
    const stamps = idxs.map((i) => parseStamp(rows[i].date)?.t).filter((t) => typeof t === "number").sort((a, b) => a - b);
    const close = stamps.length >= 2 && stamps[stamps.length - 1] - stamps[0] <= windowDays * DAY;
    const severity = sameNo || close ? "high" : "medium";
    const why = sameNo ? "نفس رقم أمر الشراء مكرر" : close ? `خلال ${windowDays} يومًا` : "في تواريخ مختلفة";
    idxs.slice(1).forEach((i) =>
      push(i, severity, `${txt(first.supplier)} — ${v.toLocaleString("en-US")} تكرر ${idxs.length} مرات (${why})؛ يلزم التحقق من عدم ازدواج الصرف.`, v),
    );
  }
  return out;
}

/* ------------------------------ 4) درجة شذوذ المورد ------------------------------ */

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * درجة من 0 إلى 100 لكل مورد في المشتريات المباشرة، مجموع خمسة مؤشرات معلنة:
 *   حجم الإجمالي مقابل بقية الموردين (z المتين بـ MAD) 30 · حصته من المشتريات 25 · قربه من السقف 20 · تكرار المبالغ 15 · كثرة المبالغ المستديرة 10.
 * تُعرض مع أسبابها ليحكم المدقق، ولا تُحجب المؤشرات خلف رقم واحد.
 */
export function supplierRiskScores(store, p = {}) {
  const rows = store.Direct_Purchases_Orders ?? [];
  const ceiling = Number(p.directPurchaseCeiling) || 0;
  const by = new Map();
  rows.forEach((r, i) => {
    const k = norm(r.supplier);
    const v = num(r.value);
    if (!k || v === undefined || v <= 0) return;
    const e = by.get(k) ?? { name: txt(r.supplier), rows: [], vals: [] };
    e.rows.push(i);
    e.vals.push(v);
    by.set(k, e);
  });
  const sups = [...by.values()];
  const totals = sups.map((s) => s.vals.reduce((a, b) => a + b, 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const med = totals.length ? median(totals) : 0;
  const mad = totals.length ? median(totals.map((t) => Math.abs(t - med))) : 0;
  return sups.map((s, k) => {
    const total = totals[k];
    const reasons = [];
    let score = 0;
    if (sups.length >= 5 && mad > 0) {
      const z = (0.6745 * (total - med)) / mad;
      if (z > 0) {
        score += Math.min(z / 6, 1) * 30;
        if (z >= 3) reasons.push(`إجمالي أعلى من نمط بقية الموردين (z = ${z.toFixed(1)})`);
      }
    }
    const share = grand ? (total / grand) * 100 : 0;
    score += Math.min(share / 50, 1) * 25;
    if (share >= 25) reasons.push(`${share.toFixed(0)}% من إجمالي المشتريات المباشرة`);
    const near = ceiling > 0 ? s.vals.filter((v) => v >= ceiling * 0.95 && v < ceiling).length : 0;
    score += Math.min(near / 3, 1) * 20;
    if (near) reasons.push(`${near} أمر تحت السقف مباشرة`);
    const dup = s.vals.length - new Set(s.vals).size;
    score += Math.min(dup / 2, 1) * 15;
    if (dup) reasons.push(`${dup} مبلغ مكرر`);
    const roundShare = s.vals.filter((v) => v >= 1000 && v % 1000 === 0).length / s.vals.length;
    score += roundShare * 10;
    if (s.vals.length >= 3 && roundShare >= 0.6) reasons.push(`${Math.round(roundShare * 100)}% من المبالغ أعداد مستديرة`);
    return { supplier: s.name, orders: s.vals.length, total, score: Math.round(score), reasons, firstRow: s.rows[0] };
  });
}

export function supplierScoreFindings(store, sectorOf, p = {}) {
  return supplierRiskScores(store, p)
    .filter((s) => s.orders >= 3 && s.score >= 40 && s.reasons.length >= 2)
    .map((s) => ({
      dataset: "Direct_Purchases_Orders",
      sector: sectorOf("Direct_Purchases_Orders"),
      row: s.firstRow,
      severity: s.score >= 60 ? "high" : "medium",
      test: `${STAT}درجة شذوذ مرتفعة لمورد`,
      detail: `${s.supplier} — الدرجة ${s.score}/100 (${s.orders} أوامر، ${s.total.toLocaleString("en-US")}): ${s.reasons.join("؛ ")}`,
      amount: s.total,
    }));
}

/* ------------------------------ التجميع ------------------------------ */

export function statisticalFindings(store, datasets, sectorOf, p = {}) {
  const out = [];
  for (const fn of [
    () => benfordFindings(store, datasets, sectorOf, { minN: Number(p.benfordMinN) || 100 }),
    () => thresholdFindings(store, datasets, sectorOf, p),
    () => duplicateFindings(store, sectorOf),
    () => supplierScoreFindings(store, sectorOf, p),
  ]) {
    try {
      out.push(...fn());
    } catch {
      /* بيانات مشوهة في جدول لا توقف بقية التحليل */
    }
  }
  return out;
}
