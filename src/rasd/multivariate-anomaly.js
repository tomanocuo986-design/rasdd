// @ts-nocheck
/**
 * شذوذ متعدد المتغيرات فوق الإحصاء القائم (statistical-tests.js)، محليًا ومجانًا:
 *   1) نموذج على مستوى السجل لكل جدول فيه 40 سجلًا فأكثر: السمات الرقمية + تكرار الأسماء النصية (مورد، مستفيد…).
 *   2) نموذج على مستوى المورد في المشتريات المباشرة: حجم، تركّز، قرب من السقف، تكرار مبالغ، فواصل زمنية، تركّز الموافِق…
 *
 * المحرك Isolation Forest (isolation-forest.js) يلتقط التراكيب غير المعتادة التي لا تظهر في أي سمة منفردة.
 * ولا نترك الدرجة وحدها صندوقًا أسود: كل ملاحظة تُرفق بالسمات التي حرّكتها (z متين بالوسيط وMAD) وقيمها الفعلية،
 * ولا تُصدر ملاحظة إلا إن تجاوزت الدرجة عتبة وانفصلت عن وسيط الدرجات (الغابة تُرتّب دائمًا، فلا نعدّ «الأعلى» شاذًا بحكم الترتيب).
 *
 * مؤشر يوجّه الفحص وليس دليل تلاعب. الشكل كبقية المحرك: { dataset, sector, row, severity, test, detail, amount? }.
 */
import { parseStamp } from "./advanced-queries.js";
import { fitIsolationForest, scoreIsolationForest, robustColumnStats, robustZ, median } from "./isolation-forest.js";

export const MV = "تحليل إحصائي: ";
export const MV_ROW_TEST = `${MV}شذوذ متعدد المتغيرات في سجل (Isolation Forest)`;
export const MV_SUPPLIER_TEST = `${MV}شذوذ متعدد المتغيرات في سلوك مورد (Isolation Forest)`;

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

const fmtNum = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : Number(v.toFixed(2)).toLocaleString("en-US"));
const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** الإعدادات الافتراضية (تُضبط من معاملات الفحص p.mv*). */
export function mvConfig(p = {}) {
  const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    enabled: !(p.multivariate === false || p.multivariate === 0 || p.mvEnabled === 0 || p.mvEnabled === false),
    minRows: n(p.mvMinRows, 40),
    minSuppliers: n(p.mvMinSuppliers, 12),
    threshold: n(p.mvScoreThreshold, 0.62),
    maxShare: n(p.mvMaxShare, 0.03),
    maxPerDataset: n(p.mvMaxPerDataset, 10),
    seed: Number(p.mvSeed) || 20260101,
    trees: n(p.mvTrees, 100),
  };
}

/* ------------------------------ تحويل السمات ------------------------------ */

/** لوغاريتم للأعمدة غير السالبة شديدة الالتواء (مبالغ)، حتى لا يطغى ذيل واحد على التقسيمات. */
function maybeLog(raw) {
  const vals = raw.filter((v) => v !== undefined);
  if (!vals.length || vals.some((v) => v < 0)) return { x: raw, logged: false };
  const med = median(vals);
  const max = Math.max(...vals);
  if (max > 8 * (med || 1) && max > 100) return { x: raw.map((v) => (v === undefined ? undefined : Math.log1p(v))), logged: true };
  return { x: raw, logged: false };
}

/**
 * يجمّع السمات في مصفوفة صالحة للنموذج. feature: { label, kind, raw[], x[], good: 'high'|'low'|'both', fmt(v), note? }
 * القيم الناقصة تُملأ بوسيط العمود (بعد استبعاد الصفوف التي أغلب سماتها ناقصة).
 */
function assemble(features, nRows) {
  const usable = [];
  for (let i = 0; i < nRows; i++) {
    const have = features.filter((f) => f.x[i] !== undefined).length;
    if (have >= Math.ceil(features.length / 2) && have >= 1) usable.push(i);
  }
  const medians = features.map((f) => median(usable.map((i) => f.x[i]).filter((v) => v !== undefined)));
  const X = usable.map((i) => features.map((f, j) => (f.x[i] === undefined ? medians[j] : f.x[i])));
  return { rows: usable, X };
}

/** أعمدة السمات لجدول عام: الحقول الرقمية + تكرار الحقول النصية ذات التصنيف الفعلي (لا المعرّفات ولا النص الحر). */
function datasetFeatures(ds, data) {
  const feats = [];
  for (const f of ds.fields) {
    if (f.type !== "number") continue;
    const raw = data.map((r) => num(r[f.key]));
    const have = raw.filter((v) => v !== undefined);
    if (have.length < data.length * 0.6 || new Set(have).size < 2) continue;
    const { x, logged } = maybeLog(raw);
    feats.push({ label: f.label || f.key, kind: "num", raw, x, logged, fmt: fmtNum });
  }
  const textCols = [];
  for (const f of ds.fields) {
    if (f.type === "number" || f.type === "date") continue;
    const vals = data.map((r) => norm(r[f.key]));
    const have = vals.filter(Boolean);
    if (have.length < data.length * 0.6) continue;
    const distinct = new Set(have).size;
    const ratio = distinct / have.length;
    // أقل من 8 تصنيفات تتصرف كرمز فئة (موافِق من 4 أشخاص مثلًا): فروق أعدادها ليست شذوذًا. وفوق 0.6 معرّف أو نص حر.
    if (distinct < 8 || ratio > 0.6) continue;
    textCols.push({ f, vals, ratio });
  }
  textCols.sort((a, b) => a.ratio - b.ratio);
  for (const { f, vals } of textCols.slice(0, 2)) {
    const counts = new Map();
    vals.forEach((v) => v && counts.set(v, (counts.get(v) ?? 0) + 1));
    const raw = vals.map((v) => (v ? counts.get(v) : undefined));
    feats.push({
      label: `تكرار «${f.label || f.key}»`,
      kind: "freq",
      fieldKey: f.key,
      raw,
      x: raw.map((v) => (v === undefined ? undefined : Math.log1p(v))),
      fmt: (v) => `${v} مرة`,
    });
  }
  return feats;
}

/** الوصف الذي يُعرّف السجل للمدقق: أول حقل نصي غير فارغ. */
function labelOf(ds, row) {
  for (const f of ds.fields) {
    if (f.type === "number" || f.type === "date") continue;
    const v = txt(row[f.key]);
    if (v) return v.length > 40 ? `${v.slice(0, 40)}…` : v;
  }
  return "";
}

/* ------------------------------ اختيار الشواذ وتفسيرها ------------------------------ */

/**
 * يشغّل الغابة ويعيد الشواذ المختارة مرتبةً: { i (فهرس في rows)، score، reasons: [{ j, z }] }.
 * الشروط: الدرجة ≥ العتبة، وتفصلها عن وسيط الدرجات 0.12 على الأقل، وبحد أقصى maxShare من السجلات.
 */
/**
 * z وحده يضلّل حين يكون MAD صغيرًا جدًا (أعمدة شبه ثابتة)، فنشترط مع z فرقًا عمليًا في القيمة الفعلية:
 *   رقمي: انحراف عن الوسيط ≥ 25% منه (أو أي فرق إن كان الوسيط صفرًا)؛ تكرار: سجل نادر (≤ 2 مرة) وسط أسماء متكررة (وسيط ≥ 6).
 */
export function practicallyDifferent(feat, idx) {
  const v = feat.raw[idx];
  if (v === undefined) return false;
  const typical = median(feat.raw.filter((x) => x !== undefined));
  if (feat.kind === "freq") return v <= 2 && typical >= 6;
  if (!typical) return v !== 0;
  return Math.abs(v - typical) >= 0.25 * Math.abs(typical);
}

export function selectAnomalies(X, cfg, seed, reasonZ = Z_REASON, feats = null, rowsMap = null) {
  if (X.length < 2 || !X[0]?.length) return { picks: [], scores: [], stats: [] };
  const model = fitIsolationForest(X, { trees: cfg.trees, sampleSize: 256, seed });
  const scores = scoreIsolationForest(model, X);
  const stats = robustColumnStats(X);
  const med = median(scores);
  const limit = Math.min(cfg.maxPerDataset ?? 10, Math.max(3, Math.floor(cfg.maxShare * X.length)));
  const picks = scores
    .map((score, i) => ({ i, score }))
    .filter((s) => s.score >= cfg.threshold && s.score >= med + 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      ...s,
      reasons: X[s.i]
        .map((v, j) => ({ j, z: robustZ(v, stats[j]) }))
        .filter((r) => Math.abs(r.z) >= reasonZ && (!feats || practicallyDifferent(feats[r.j], rowsMap ? rowsMap[s.i] : s.i)))
        .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
        .slice(0, 3),
    }));
  return { picks, scores, stats };
}

/**
 * عتبات الأدلة (معايرة بمحاكاة، انظر docs/ML_LOCAL.ar.md): درجة العزل وحدها لا تفصل الشاذ عن أقصى ذيل طبيعي لأن الغابة ترتّب دائمًا،
 * فنشترط أدلة في السمات: سمتان بـ |z| ≥ 4 معًا، أو سمة واحدة بـ |z| ≥ 6. وما لا يُفسَّر بسمة لا نصدره (لا صندوق أسود).
 */
export const Z_REASON = 4;
export const Z_SOLO = 6;
export const qualifies = (reasons) => reasons.length >= 2 || (reasons.length === 1 && Math.abs(reasons[0].z) >= Z_SOLO);

export function severityOf(score, reasons) {
  if (!qualifies(reasons)) return null;
  const zs = reasons.map((r) => Math.abs(r.z));
  const maxz = Math.max(...zs);
  if (zs.filter((z) => z >= Z_SOLO).length >= 2 && score >= 0.72 && maxz >= 10) return "high";
  if (score >= 0.65 && (reasons.length >= 2 || maxz >= 8)) return "medium";
  return "low";
}

const scoreWord = (s) => s.toFixed(2);

/* ------------------------------ 1) مستوى السجل ------------------------------ */

export function rowAnomalyFindings(store, datasets, sectorOf, p = {}, { exclude = new Set() } = {}) {
  const cfg = mvConfig(p);
  if (!cfg.enabled) return [];
  const out = [];
  for (const ds of datasets) {
    const data = store[ds.key] ?? [];
    if (data.length < cfg.minRows) continue;
    const feats = datasetFeatures(ds, data);
    if (feats.length < 2 || feats.filter((f) => f.kind === "num").length < 1) continue;
    const { rows, X } = assemble(feats, data.length);
    if (rows.length < cfg.minRows) continue;
    const { picks } = selectAnomalies(X, cfg, cfg.seed ^ hashStr(ds.key), Z_REASON, feats, rows);
    for (const pk of picks) {
      const idx = rows[pk.i];
      if (exclude.has(`${ds.key}|${idx}`)) continue;
      const severity = severityOf(pk.score, pk.reasons);
      if (!severity) continue;
      const why = pk.reasons.map(({ j, z }) => {
        const f = feats[j];
        const v = f.raw[idx];
        const typical = median(f.raw.filter((x) => x !== undefined));
        const dir = z > 0 ? "أعلى" : "أدنى";
        return f.kind === "freq"
          ? `${f.label}: ${f.fmt(v)} فقط مقابل وسيط ${f.fmt(Math.round(typical))} (اسم نادر بين أسماء متكررة)`
          : `«${f.label}» ${f.fmt(v)} مقابل وسيط ${f.fmt(typical)} (z = ${Math.abs(z).toFixed(1)} ${dir})`;
      });
      const who = labelOf(ds, data[idx]);
      const amountCol = feats.find((f) => f.kind === "num" && f.raw[idx] !== undefined && /amount|value|net|total|المبلغ|القيمة|الصافي|الإجمالي/i.test(f.label));
      out.push({
        dataset: ds.key,
        sector: sectorOf(ds.key),
        row: idx,
        severity,
        test: MV_ROW_TEST,
        detail: `${who ? `${who} — ` : ""}درجة العزل ${scoreWord(pk.score)} بين ${rows.length} سجلًا (0.5 = عادي، وكلما اقتربت من 1 زاد الشذوذ). السمات التي حرّكتها: ${why.join("؛ ")}. مؤشر يوجّه الفحص وليس دليل تلاعب.`,
        ...(amountCol ? { amount: amountCol.raw[idx] } : {}),
      });
    }
  }
  return out;
}

/* ------------------------------ 2) مستوى المورد ------------------------------ */

/** سمات سلوك كل مورد في المشتريات المباشرة. تُعاد مع الأعمدة ليستعملها الاختبار والعرض. */
export function supplierBehaviour(store, p = {}) {
  const rows = store.Direct_Purchases_Orders ?? [];
  const ceiling = Number(p.directPurchaseCeiling) || 0;
  const window = (Number(p.splitWindowDays) || 7) * DAY;
  const by = new Map();
  rows.forEach((r, i) => {
    const k = norm(r.supplier);
    const v = num(r.value);
    if (!k || v === undefined || v <= 0) return;
    const e = by.get(k) ?? { name: txt(r.supplier), idx: [], vals: [], stamps: [], approvers: [], same: 0, weekend: 0, dated: 0 };
    e.idx.push(i);
    e.vals.push(v);
    const st = parseStamp(r.date);
    if (st) {
      e.stamps.push(st.t);
      e.dated += 1;
      if (st.day === 5 || st.day === 6) e.weekend += 1;
    }
    const ap = norm(r.approver);
    if (ap) e.approvers.push(ap);
    if (norm(r.entered_by) && norm(r.entered_by) === norm(r.received_by)) e.same += 1;
    by.set(k, e);
  });
  const sups = [...by.values()];
  const grand = sups.reduce((a, s) => a + s.vals.reduce((x, y) => x + y, 0), 0);
  return sups.map((s) => {
    const n = s.vals.length;
    const total = s.vals.reduce((a, b) => a + b, 0);
    const mean = total / n;
    const sd = Math.sqrt(s.vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const sorted = [...s.stamps].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((t, i) => (t - sorted[i]) / DAY);
    let burst = sorted.length ? 1 : 0;
    for (let a = 0, b = 0; b < sorted.length; b++) {
      while (sorted[b] - sorted[a] > window) a++;
      burst = Math.max(burst, b - a + 1);
    }
    const apCounts = new Map();
    s.approvers.forEach((a) => apCounts.set(a, (apCounts.get(a) ?? 0) + 1));
    const topAp = s.approvers.length ? Math.max(...apCounts.values()) / s.approvers.length : undefined;
    return {
      supplier: s.name,
      firstRow: s.idx[0],
      idx: s.idx,
      orders: n,
      total,
      m: {
        orders: n,
        total,
        mean,
        max: Math.max(...s.vals),
        cv: mean ? sd / mean : 0,
        share: grand ? (total / grand) * 100 : 0,
        near: ceiling > 0 ? s.vals.filter((v) => v >= ceiling * 0.95 && v < ceiling).length : undefined,
        dup: n - new Set(s.vals).size,
        round: s.vals.filter((v) => v >= 1000 && v % 1000 === 0).length / n,
        gap: gaps.length ? median(gaps) : undefined,
        burst: sorted.length ? burst : undefined,
        weekend: s.dated ? s.weekend / s.dated : undefined,
        approver: n >= 3 ? topAp : undefined,
        selfReceive: s.same / n,
      },
    };
  });
}

// risk: الاتجاه الذي يُعدّ مشبوهًا ('high' = القيمة الأعلى، 'low' = الأدنى)
const SUP_FEATURES = [
  { key: "orders", label: "عدد الأوامر", risk: "high", log: true, fmt: (v) => `${Math.round(v)} أمرًا` },
  { key: "total", label: "إجمالي المشتريات", risk: "high", log: true, fmt: fmtNum },
  { key: "mean", label: "متوسط الأمر", risk: "both", log: true, fmt: fmtNum },
  { key: "share", label: "حصته من المشتريات المباشرة", risk: "high", fmt: (v) => `${v.toFixed(0)}%` },
  { key: "near", label: "أوامر تحت السقف مباشرة", risk: "high", fmt: (v) => `${Math.round(v)}` },
  { key: "dup", label: "مبالغ مكررة", risk: "high", fmt: (v) => `${Math.round(v)}` },
  { key: "round", label: "نسبة المبالغ المستديرة", risk: "high", fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "gap", label: "الفاصل الزمني الوسيط بين أوامره (يوم)", risk: "low", log: true, fmt: (v) => `${v.toFixed(0)}` },
  { key: "burst", label: "أقصى أوامر في نافذة التجزئة", risk: "high", fmt: (v) => `${Math.round(v)}` },
  { key: "approver", label: "تركّز الموافقة على موافِق واحد", risk: "high", fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "selfReceive", label: "أوامر أدخلها مستلمها نفسه", risk: "high", fmt: (v) => `${Math.round(v * 100)}%` },
];

export function supplierAnomalyFindings(store, sectorOf, p = {}, { exclude = new Set(), flagged = null } = {}) {
  const cfg = mvConfig(p);
  if (!cfg.enabled) return [];
  const sups = supplierBehaviour(store, p);
  if (sups.length < cfg.minSuppliers) return [];
  // نحتفظ بالسمات التي لها قيم وتباين فعلي
  const feats = SUP_FEATURES.filter((f) => {
    const vals = sups.map((s) => s.m[f.key]).filter((v) => v !== undefined);
    return vals.length >= sups.length * 0.6 && new Set(vals).size >= 2;
  }).map((f) => {
    const raw = sups.map((s) => s.m[f.key]);
    return { ...f, kind: "num", raw, x: f.log ? raw.map((v) => (v === undefined ? undefined : Math.log1p(v))) : raw };
  });
  if (feats.length < 3) return [];
  const { rows, X } = assemble(feats, sups.length);
  if (rows.length < cfg.minSuppliers) return [];
  const { picks } = selectAnomalies(X, cfg, cfg.seed ^ hashStr("supplier"), Z_REASON, feats, rows);
  const out = [];
  for (const pk of picks) {
    const s = sups[rows[pk.i]];
    if (exclude.has(`Direct_Purchases_Orders|${s.firstRow}`)) continue;
    // لا نذكر إلا السمات التي تتجه في الاتجاه المشبوه
    const reasons = pk.reasons.filter(({ j, z }) => feats[j].risk === "both" || (feats[j].risk === "high" ? z > 0 : z < 0));
    const severity = severityOf(pk.score, reasons);
    if (!severity) continue;
    const why = reasons.map(({ j, z }) => {
      const f = feats[j];
      const typical = median(f.raw.filter((v) => v !== undefined));
      return `«${f.label}» ${f.fmt(f.raw[rows[pk.i]])} مقابل وسيط الموردين ${f.fmt(typical)} (z = ${Math.abs(z).toFixed(1)})`;
    });
    s.idx.forEach((i) => flagged?.add(`Direct_Purchases_Orders|${i}`));
    out.push({
      dataset: "Direct_Purchases_Orders",
      sector: sectorOf("Direct_Purchases_Orders"),
      row: s.firstRow,
      severity,
      test: MV_SUPPLIER_TEST,
      detail: `${s.supplier} — درجة العزل ${scoreWord(pk.score)} بين ${rows.length} موردًا (${s.orders} أوامر، ${fmtNum(s.total)}). السمات التي حرّكتها: ${why.join("؛ ")}. مؤشر يوجّه الفحص وليس دليل تلاعب.`,
      amount: s.total,
    });
  }
  return out;
}

/* ------------------------------ التجميع ------------------------------ */

/**
 * existing: ملاحظات سبق إنتاجها (للتقليل من التكرار: لا نكرر مورداً سبق أن رُفعت عليه «درجة شذوذ مرتفعة»).
 */
export function multivariateFindings(store, datasets, sectorOf, p = {}, existing = []) {
  const exclude = new Set(existing.filter((f) => /درجة شذوذ مرتفعة لمورد/.test(f.test)).map((f) => `${f.dataset}|${f.row}`));
  const flagged = new Set(); // أوامر مورد رُفع عليه نموذج المورد: لا نكررها كسجلات منفردة
  const out = [];
  const steps = [
    () => supplierAnomalyFindings(store, sectorOf, p, { exclude, flagged }),
    () => rowAnomalyFindings(store, datasets, sectorOf, p, { exclude: flagged }),
  ];
  for (const fn of steps) {
    try {
      out.push(...fn());
    } catch {
      /* جدول مشوّه لا يوقف بقية التحليل */
    }
  }
  return out;
}
