// @ts-nocheck
/**
 * مسودة المدقق: المدقق يكتب الملاحظة، والبرنامج:
 *   1) يقارنها بملاحظات التقارير السابقة (والتقرير الحالي) بتشابه نصي عربي موزون،
 *   2) يصنفها مرتفعة / متوسطة / منخفضة (كلمات دلالية + خطورة ما سبق + التكرار + الأثر المالي) مع بيان الأسباب،
 *   3) تُعرض على المدقق للاعتماد أو التعديل أو الحذف،
 *   4) عند الحذف: توجيه بإصدار مذكرة مراجعة بالملاحظة مع مسودة جاهزة،
 *   5) عند الاعتماد النهائي: تُدرج كملاحظة رقابية في التقارير.
 * كل شيء محلي في المتصفح؛ لا يُرسل نص الملاحظة لأي خدمة خارجية.
 */
import { calibrateSeverity, loadCalibration } from "./severity.js";
import { STATUS_LABEL } from "./history.js";
import { NO_BASIS_TEXT, ruleFor } from "./observations";
import { getManualObservations } from "./manual-observations";

const REPORTS_KEY = "rasd-audit-reports";
const CURRENT_KEY = "rasd-audit-current";

export const SEVERITY_WORD = { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" };
const RANK = { low: 1, medium: 2, high: 3 };

/* ------------------------------ تطبيع النص العربي ------------------------------ */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeArabic(s) {
  return String(s ?? "")
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  (
    "في من الى على عن مع هذا هذه ذلك تلك التي الذي الذين التى كان كانت يكون تكون ان انه انها او ثم قد لم لن لا ما هو هي هم بين حتى عند عندما كما كل بعض غير دون بدون ايضا فقط تم يتم تمت وقد وكان ولم ولا وان وفي ومن وعلى والى وعن ومع لدي لدى حيث اذا اذ اي بعد قبل خلال عليها عليه منها منه فيها فيه له لها لهم بها به وجود"
  )
    .split(" ")
    .map(normalizeArabic),
);

function stem(w) {
  let x = w;
  x = x.replace(/^(وال|فال|بال|كال|لل|ال)/, "");
  if (x.length > 4) x = x.replace(/^[وفبلك](?=.{4,})/, "");
  if (x.length > 4) x = x.replace(/(ات|ان|ون|ين|ها|هم|ما)$/, "");
  if (x.length > 3) x = x.replace(/[هي]$/, "");
  return x;
}

export function tokens(text) {
  return normalizeArabic(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length >= 2);
}

/* ------------------------------ مصدر المقارنة ------------------------------ */

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * يبني قائمة ما سبق من ملاحظات: ملاحظات التقارير المحفوظة، ونتائج الفحص التي لا تغطيها ملاحظة،
 * ثم ملاحظات التقرير الحالي (المسودة) والملاحظات اليدوية المعتمدة.
 */
export function buildCorpus(reports, currentObservations = [], manual = []) {
  const entries = [];
  const list = Array.isArray(reports) ? reports : [];
  for (const r of list) {
    const covered = new Set();
    for (const o of r.observations ?? []) {
      const title = String(o.test ?? "");
      covered.add(`${o.dataset}|${title.trim()}`);
      entries.push({
        id: `${r.id}|o|${o.id ?? title}`,
        report: r.name ?? "تقرير سابق",
        reportId: r.id ?? r.name,
        date: r.date ?? "",
        source: "observation",
        title,
        text: `${title} ${o.condition ?? ""}`,
        severity: o.risk?.rating ?? o.severity ?? "medium",
        recommendation: o.recommendation,
        legalBasis: o.legalBasis,
        count: o.count ?? 1,
      });
    }
    const byTest = new Map();
    for (const f of r.findings ?? []) {
      const k = `${f.dataset}|${String(f.test ?? "").trim()}`;
      if (covered.has(k)) continue;
      const e = byTest.get(k) ?? { f, count: 0, severity: f.severity };
      e.count += 1;
      if ((RANK[f.severity] ?? 0) > (RANK[e.severity] ?? 0)) e.severity = f.severity;
      byTest.set(k, e);
    }
    for (const [k, e] of byTest) {
      entries.push({
        id: `${r.id}|f|${k}`,
        report: r.name ?? "تقرير سابق",
        reportId: r.id ?? r.name,
        date: r.date ?? "",
        source: "finding",
        title: String(e.f.test ?? ""),
        text: `${e.f.test ?? ""} ${e.f.detail ?? ""}`,
        severity: e.severity ?? "medium",
        count: e.count,
      });
    }
  }
  for (const o of [...currentObservations, ...manual]) {
    entries.push({
      id: `current|${o.id}`,
      report: "التقرير الحالي (مسودة)",
      reportId: "current",
      date: "",
      source: "current",
      title: String(o.test ?? ""),
      text: `${o.test ?? ""} ${o.condition ?? ""}`,
      severity: o.risk?.rating ?? "medium",
      recommendation: o.recommendation,
      legalBasis: o.legalBasis,
      count: o.count ?? 1,
    });
  }
  return entries;
}

/** يقرأ المصدر من تخزين المتصفح (نفس مفاتيح التطبيق). */
export function loadCorpus() {
  const reports = readJson(REPORTS_KEY, []);
  const current = readJson(CURRENT_KEY, null);
  return buildCorpus(reports, current?.observations ?? [], getManualObservations());
}

/* ------------------------------ المقارنة ------------------------------ */

export const THRESHOLDS = { recurring: 0.6, pattern: 0.35 };

/**
 * يقارن نص الملاحظة بكل ما في المصدر. التشابه = تغطية موزونة (IDF) + جاكارد موزون،
 * فالكلمات النادرة (مثل «مزدوج» أو «محطة») تزن أكثر من الكلمات الشائعة.
 */
export function compareObservation(text, corpus, { limit = 5 } = {}) {
  const q = new Set(tokens(text));
  const reports = new Set(corpus.map((e) => e.reportId));
  if (!q.size || !corpus.length) return { matches: [], entries: corpus.length, reports: reports.size };

  const docs = corpus.map((e) => ({ e, set: new Set(tokens(e.text)) }));
  const df = new Map();
  for (const { set } of docs) for (const w of set) df.set(w, (df.get(w) ?? 0) + 1);
  const N = docs.length;
  const idf = (w) => Math.log(1 + N / (1 + (df.get(w) ?? 0)));
  const qWeight = [...q].reduce((a, w) => a + idf(w), 0);

  const scored = [];
  for (const { e, set } of docs) {
    let inter = 0;
    let shared = 0;
    for (const w of q)
      if (set.has(w)) {
        inter += idf(w);
        shared++;
      }
    if (!shared || (shared < 2 && q.size > 2)) continue;
    let union = qWeight;
    for (const w of set) if (!q.has(w)) union += idf(w);
    const cover = inter / qWeight;
    const jac = inter / union;
    let score = 0.65 * cover + 0.35 * jac;
    if (normalizeArabic(e.title) && normalizeArabic(text).includes(normalizeArabic(e.title))) score = Math.max(score, 0.85);
    scored.push({ ...e, score: Math.min(1, score) });
  }
  scored.sort((a, b) => b.score - a.score);
  return {
    matches: scored.filter((m) => m.score >= 0.2).slice(0, limit),
    entries: corpus.length,
    reports: reports.size,
    all: scored,
  };
}

/* ------------------------------ التصنيف ------------------------------ */

const terms = (s) => s.split("،").map((x) => normalizeArabic(x.trim())).filter(Boolean);

const HIGH_TERMS = terms(
  "اختلاس،تلاعب،احتيال،تزوير،تزييف،وهمي،وهمية،تضارب مصالح،تضارب في المصالح،تعارض مصالح،سرقة،رشوة،استيلاء،غسل اموال،هدر مال،اهدار،صرف مزدوج،دفع مزدوج،ازدواج في الصرف،صرف دون سند،صرف بدون سند،دون مستندات،بدون مستندات،دون اعتماد،بدون اعتماد،دون موافقة،بدون موافقة،دون عقد،بدون عقد،تجزئة،تجاوز الصلاحيات،تجاوز الصلاحية،عجز في النقدية،نقدية غير مودعة،مخالفة جسيمة،مخالفة صريحة،فقدان",
);
const MEDIUM_TERMS = terms(
  "تاخر،تاخير،ضعف،قصور،نقص،عدم تحديث،عدم مطابقة،فروقات،فرق،عدم تسوية،تسوية متاخرة،رخصة منتهية،انتهاء الرخصة،بوليصة منتهية،عدم توثيق،غير موثق،تكرار،عدم الالتزام،غياب الرقابة،عدم فصل،تداخل الصلاحيات،سلف متقادمة،تجاوز الحد،تجاوز السقف،عدم وجود سجل،عدم استكمال",
);
const LOW_TERMS = terms(
  "شكلي،شكلية،تنسيق،ترقيم،خطا املائي،اخطاء طباعية،ترتيب الملفات،تنظيمية،توصية تحسينية،تحسين،ختم،بسيط،بسيطة،ملاحظة ادارية بسيطة",
);

const found = (norm, list) => list.filter((t) => norm.includes(t));

const CUR = /(دينار|د\.\s?أ|JD|JOD|ريال|SAR|ر\.\s?س|دولار|\$)/i;

/** أكبر مبلغ مذكور في النص بجوار عملة (أرقام عربية أو هندية). */
export function extractAmount(text) {
  const t = String(text ?? "").replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[،٬]/g, ",").replace(/٫/g, ".");
  let max = 0;
  const num = String.raw`(\d[\d,]*(?:\.\d+)?)`;
  const patterns = [new RegExp(`${num}\\s*(?:ألف\\s*)?${CUR.source}`, "gi"), new RegExp(`${CUR.source}\\s*${num}`, "gi")];
  for (const re of patterns)
    for (const m of t.matchAll(re)) {
      const raw = m[1] && /\d/.test(m[1]) ? m[1] : m[2];
      let v = Number(String(raw).replace(/,/g, ""));
      if (/ألف/.test(m[0])) v *= 1000;
      if (Number.isFinite(v) && v > max) max = v;
    }
  return max;
}

/**
 * يصنف الملاحظة. الأسباب تُعرض للمدقق كاملة ليعرف لماذا صُنفت هكذا (شفافية)؛ والقرار النهائي له.
 */
export function classifyObservation(text, comparison, calibration = loadCalibration()) {
  const norm = normalizeArabic(text);
  const reasons = [];
  const high = found(norm, HIGH_TERMS);
  const medium = found(norm, MEDIUM_TERMS);
  const low = found(norm, LOW_TERMS);

  let base;
  if (high.length) {
    base = "high";
    reasons.push(`عبارات ذات دلالة عالية: «${high.slice(0, 3).join("، ")}»`);
  } else if (medium.length) {
    base = "medium";
    reasons.push(`عبارات ذات دلالة متوسطة: «${medium.slice(0, 3).join("، ")}»`);
  } else if (low.length) {
    base = "low";
    reasons.push(`عبارات تدل على ملاحظة شكلية/تنظيمية: «${low.slice(0, 3).join("، ")}»`);
  } else {
    base = "medium";
    reasons.push("لم تُرصد عبارات دلالية معروفة، فبدأ التقييم من «متوسطة» لتراجعها أنت.");
  }

  const matches = comparison?.matches ?? [];
  const best = matches[0];
  if (best && best.score >= THRESHOLDS.pattern && (RANK[best.severity] ?? 0) > RANK[base]) {
    base = best.severity;
    reasons.push(`وردت ملاحظة مشابهة في «${best.report}» بخطورة ${SEVERITY_WORD[best.severity]}`);
  }

  const all = comparison?.all ?? matches;
  const distinct = (min, max) =>
    new Set(all.filter((m) => m.score >= min && m.score < max && m.reportId !== "current").map((m) => m.reportId)).size;
  const exactCount = distinct(THRESHOLDS.recurring, 2);
  const patternCount = distinct(THRESHOLDS.pattern, THRESHOLDS.recurring);
  const amount = extractAmount(text);

  const cal = calibrateSeverity(base, { exactCount, patternCount, amount }, calibration);
  if (exactCount) reasons.push(`تكررت في ${exactCount} تقرير سابق (ترفع الخطورة)`);
  else if (patternCount) reasons.push(`تشبه نمطًا ورد في ${patternCount} تقرير سابق`);
  if (amount) reasons.push(`أثر مالي مذكور: ${amount.toLocaleString("en-US")}`);

  const status = exactCount ? "recurring" : patternCount ? "pattern" : "new";
  return {
    severity: cal.severity,
    score: cal.score,
    base,
    reasons,
    explain: cal.explain,
    amount,
    exactCount,
    patternCount,
    status,
    statusLabel: STATUS_LABEL[status],
  };
}

/** التحليل الكامل في خطوة واحدة (يستعمله الاختبار والواجهة). */
export function analyzeObservation(text, corpus = loadCorpus(), calibration = loadCalibration()) {
  const comparison = compareObservation(text, corpus);
  return { comparison, ...classifyObservation(text, comparison, calibration) };
}

/* ------------------------------ البناء والاعتماد ------------------------------ */

export function deriveTitle(text) {
  const first = String(text ?? "").trim().split(/[\n.؛;:۔]/)[0].trim();
  return first.length > 80 ? `${first.slice(0, 77)}…` : first;
}

const SCORE = { high: 6, medium: 3, low: 1 };
const LEVEL = { high: 3, medium: 2, low: 1 };

/** يحوّل المسودة المعتمدة إلى ملاحظة رقابية بنفس بنية ملاحظات المحرك. */
export function buildObservation({ title, text, sector = "", severity, cause, effect, recommendation, analysis }) {
  const t = (title || deriveTitle(text)).trim();
  const rule = ruleFor(t || text);
  const best = analysis?.comparison?.matches?.[0];
  const repeated = (analysis?.exactCount ?? 0) + (analysis?.patternCount ?? 0) > 0 ? 1 : 0;
  const prevBasis = best?.legalBasis?.text && best.legalBasis.source !== "default" ? best.legalBasis : undefined;
  const sev = severity ?? analysis?.severity ?? "medium";
  return {
    id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    dataset: "manual",
    sector,
    test: t,
    count: 1,
    refs: [],
    repeated,
    risk: {
      impact: LEVEL[sev],
      likelihood: repeated ? 2 : 1,
      score: SCORE[sev] + repeated,
      rating: sev,
      rationale: `اعتمدها المدقق بخطورة ${SEVERITY_WORD[sev]}${analysis?.reasons?.length ? ` — ${analysis.reasons.join("؛ ")}` : ""}.`,
    },
    condition: String(text).trim(),
    cause: cause?.trim() || rule.cause,
    effect: effect?.trim() || rule.effect,
    legalBasis: prevBasis
      ? { source: prevBasis.source, text: prevBasis.text, needsVerification: !!prevBasis.needsVerification }
      : { source: "default", text: NO_BASIS_TEXT, needsVerification: false },
    recommendation: recommendation?.trim() || best?.recommendation || rule.recommendation,
    status: "approved",
    manual: true,
  };
}

/* ------------------------------ مذكرة المراجعة عند الحذف ------------------------------ */

export const DELETE_GUIDANCE =
  "قبل حذف الملاحظة نوصيك بتوجيه «مذكرة مراجعة» بالملاحظة إلى الجهة المعنية (أو رئيس فريق التدقيق) لتوثيق سبب الاستبعاد، والتأكد من عدم وجود مستندات أو مبررات تستدعي إبقاءها. هذه مسودة المذكرة جاهزة للنسخ والتعديل.";

export function reviewMemo({ title, text, severity, sector, reason, matches = [] }, date = new Date().toISOString().slice(0, 10)) {
  const lines = [
    "مذكرة مراجعة ملاحظة",
    `التاريخ: ${date}`,
    sector ? `النشاط: ${sector}` : "",
    `عنوان الملاحظة: ${title || deriveTitle(text)}`,
    `نص الملاحظة: ${String(text).trim()}`,
    `الخطورة المقترحة: ${SEVERITY_WORD[severity] ?? "—"}`,
    `سبب الاستبعاد المقترح: ${reason?.trim() || "(يُستكمل من المدقق)"}`,
  ].filter(Boolean);
  if (matches.length)
    lines.push(
      "ملاحظات سابقة مشابهة للاطلاع:",
      ...matches.slice(0, 3).map((m) => `- ${m.title} (${m.report}${m.date ? `، ${m.date}` : ""})`),
    );
  lines.push(
    "المطلوب: مراجعة الملاحظة مع الجهة المعنية والإفادة بما يؤكد سبب الاستبعاد، أو إرفاق ما يستوجب إعادة إدراجها في التقرير.",
    "المدقق: ____________________",
  );
  return lines.join("\n");
}
