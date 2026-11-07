// @ts-nocheck
/**
 * مقارنة دلالية محلية بالتقارير السابقة (مجانية، بلا إرسال أي نص لأي جهة، وبلا تنزيل نموذج).
 *
 * التشابه النصي القائم (compareObservation في auditor-draft.js) يقيس الكلمات المشتركة فقط، فيفوّت صياغتين لمعنى واحد
 * («تجزئة أوامر الشراء» و«تقسيم المشتريات لتفادي السقف»). هنا ثلاث طبقات تُدمج بوزن:
 *   1) المفاهيم الرقابية: معجم مرادفات المجال (تجزئة≈تقسيم≈تفتيت، ازدواج≈تكرار≈مرتين…) تُضاف كرموز مفهوم للنص.
 *   2) LSA (التحليل الدلالي الكامن): يتعلّم من ملاحظات التقارير السابقة نفسها أي الكلمات تأتي معًا (SVD بتكرار الفضاء الجزئي، حتمي).
 *   3) مقاطع حرفية ثلاثية على الجذوع: تتسامح مع الاشتقاق والإملاء.
 *
 * كل شيء قابل للتفسير: لكل مطابقة تُعاد المفاهيم المشتركة التي بُنيت عليها، ودرجة كل طبقة.
 * لا يعدّل الدرجة اللفظية القائمة بل يرفعها فقط (الدمج = الأكبر)، فلا يضيع ما كان يُلتقط من قبل.
 */

/* ------------------------------ تطبيع وجذوع (نسخة مطابقة لـ auditor-draft.js) ------------------------------ */

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
  "في من الى على عن مع هذا هذه ذلك تلك التي الذي الذين التى كان كانت يكون تكون ان انه انها او ثم قد لم لن لا ما هو هي هم بين حتى عند عندما كما كل بعض غير دون بدون ايضا فقط تم يتم تمت وقد وكان ولم ولا وان وفي ومن وعلى والى وعن ومع لدي لدى حيث اذا اذ اي بعد قبل خلال عليها عليه منها منه فيها فيه له لها لهم بها به وجود"
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

export function arTokens(text) {
  return normalizeArabic(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length >= 2);
}

/* ------------------------------ معجم المفاهيم الرقابية ------------------------------ */

/** المفهوم: [تسمية للعرض، كلمات]. تُجذَّع الكلمات بنفس المجذِّع فتطابق صيغ الاشتقاق والجمع. */
export const CONCEPTS = {
  split: ["تجزئة المشتريات", "تجزئة تجزيء تجزئه تجزأ مجزأ تقسيم تقسيط تفتيت مقسم تجزيئ متقارب متقاربة تفادي لتفادي"],
  duplicate: ["التكرار والازدواج", "تكرار مكرر مكررة ازدواج ازدواجية مزدوج مزدوجة مرتين تكرر مكرره دفعتين"],
  ceiling: ["سقف الصلاحية", "سقف سقوف صلاحية صلاحيات يتجاوز تجاوز متجاوز تخطي تخطى حد مسموح"],
  directPurchase: ["الشراء المباشر", "شراء مشتريات مباشر مباشرة توريد توريدات لوازم"],
  tender: ["العطاءات والتنافس", "عطاء عطاءات مناقصة مناقصات طرح تنافسي تنافسية عروض لجنه دعوه"],
  overtime: ["العمل الإضافي", "اضافي اضافيه الاضافي اضافية اضافيا ساعات بدل مكافاه"],
  fuel: ["المحروقات", "وقود محروقات بنزين ديزل تعبئه تعبئة لتر لترات محطه بطاقه"],
  vehicle: ["الآليات", "مركبه مركبات اليه آليه آليات سياره سيارات اسطول عداد سائق"],
  deposit: ["القبض والإيداع", "ايداع مودع ايداعات تحصيل قبض مقبوضات ايراد ايرادات نقديه نقدي نقد"],
  cheque: ["الشيكات", "شيك شيكات مرتجع مرتد رصيد"],
  advance: ["السلف والعُهد", "سلفه سلف عهده عهد ذمه ذمم مستحقات"],
  payroll: ["الرواتب والعاملون", "راتب رواتب اجور اجر مياومه عامل عمال موظف موظفين"],
  inventory: ["المستودعات والمخزون", "مستودع مستودعات مخزون مخازن جرد مواد اتلاف راكده"],
  conflict: ["تضارب المصالح", "تضارب تعارض مصالح قرابه صله اقارب"],
  delay: ["التأخير", "تاخير تاخر متاخر متاخره غرامه غرامات تقادم متقادم"],
  contract: ["العقود والتمديد", "تمديد تمديدات مده عقد عقود مقاول مقاولات تغيير"],
  segregation: ["فصل المهام", "فصل مهام اعتماد مدخل مستلم نفس الشخص تداخل"],
  documentation: ["التوثيق", "مستند مستندات توثيق موثق مرفقات وثائق مسوغ مسوغات سند"],
  license: ["الرخص", "رخصه رخص ترخيص مهن منتهيه"],
  outlier: ["قيم غير معتادة", "شاذ شاذه شاذة اعتيادي معتاد مبالغه مرتفع مرتفعه ضخم"],
};

const CONCEPT_OF = new Map(); // جذع -> مفاهيم
const CONCEPT_LABEL = {};
for (const [id, [label, words]] of Object.entries(CONCEPTS)) {
  CONCEPT_LABEL[id] = label;
  for (const t of arTokens(words)) {
    const set = CONCEPT_OF.get(t) ?? new Set();
    set.add(id);
    CONCEPT_OF.set(t, set);
  }
}

/** مفاهيم نص: مجموعة معرّفات. */
export function conceptsOf(text) {
  const out = new Set();
  for (const t of arTokens(text)) for (const c of CONCEPT_OF.get(t) ?? []) out.add(c);
  return out;
}
export const conceptLabel = (id) => CONCEPT_LABEL[id] ?? id;

/* ------------------------------ متجهات متفرقة ------------------------------ */

function grams(tokensList) {
  const out = [];
  for (const t of tokensList) {
    if (t.length < 4) continue;
    const w = `#${t}#`;
    for (let i = 0; i + 3 <= w.length; i++) out.push(`g:${w.slice(i, i + 3)}`);
  }
  return out;
}

const tf = (items) => {
  const m = new Map();
  for (const x of items) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, v] of a) {
    na += v * v;
    const w = b.get(k);
    if (w) dot += v * w;
  }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function weigh(counts, idf) {
  const out = new Map();
  for (const [k, c] of counts) out.set(k, (1 + Math.log(c)) * (idf.get(k) ?? 1));
  return out;
}

/* ------------------------------ LSA بتكرار الفضاء الجزئي ------------------------------ */

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** يبني فضاء LSA من متجهات tf-idf المتفرقة للوثائق. يعيد null إن كان المصدر أصغر من أن يتعلم منه. */
function buildLsa(docVecs, { k = 24, seed = 11, iters = 8 } = {}) {
  const df = new Map();
  for (const v of docVecs) for (const t of v.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  // الرموز التي وردت في وثيقة واحدة لا تحمل معلومة تلازم
  const vocab = [...df].filter(([, c]) => c >= 2).map(([t]) => t);
  const V = vocab.length;
  const kk = Math.min(k, docVecs.length - 1, V - 1);
  if (docVecs.length < 8 || kk < 3) return null;
  const index = new Map(vocab.map((t, i) => [t, i]));
  // وثائق بصفوف متفرقة مطبَّعة
  const X = docVecs.map((v) => {
    const row = [];
    let n2 = 0;
    for (const [t, w] of v) {
      const i = index.get(t);
      if (i !== undefined) {
        row.push([i, w]);
        n2 += w * w;
      }
    }
    const n = Math.sqrt(n2) || 1;
    return row.map(([i, w]) => [i, w / n]);
  });
  const rnd = rngFrom(seed);
  let Q = Array.from({ length: V }, () => Float64Array.from({ length: kk }, () => rnd() - 0.5));
  const orthonormalize = (M) => {
    for (let c = 0; c < kk; c++) {
      for (let p = 0; p < c; p++) {
        let dot = 0;
        for (let i = 0; i < V; i++) dot += M[i][c] * M[i][p];
        for (let i = 0; i < V; i++) M[i][c] -= dot * M[i][p];
      }
      let nrm = 0;
      for (let i = 0; i < V; i++) nrm += M[i][c] ** 2;
      nrm = Math.sqrt(nrm) || 1;
      for (let i = 0; i < V; i++) M[i][c] /= nrm;
    }
    return M;
  };
  Q = orthonormalize(Q);
  for (let it = 0; it < iters; it++) {
    const Y = Array.from({ length: V }, () => new Float64Array(kk));
    for (const row of X) {
      const z = new Float64Array(kk);
      for (const [i, w] of row) for (let c = 0; c < kk; c++) z[c] += w * Q[i][c];
      for (const [i, w] of row) for (let c = 0; c < kk; c++) Y[i][c] += w * z[c];
    }
    Q = orthonormalize(Y);
  }
  const project = (vec) => {
    const z = new Float64Array(kk);
    let n2 = 0;
    const row = [];
    for (const [t, w] of vec) {
      const i = index.get(t);
      if (i !== undefined) {
        row.push([i, w]);
        n2 += w * w;
      }
    }
    const n = Math.sqrt(n2);
    if (!n) return null;
    for (const [i, w] of row) for (let c = 0; c < kk; c++) z[c] += (w / n) * Q[i][c];
    return z;
  };
  return { project, k: kk, vocab: V };
}

const cosArr = (a, b) => {
  if (!a || !b) return 0;
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
};

/* ------------------------------ الفهرس والتقييم ------------------------------ */

/**
 * معايرة الدرجة الخام إلى مقياس عتبات البرنامج (THRESHOLDS في auditor-draft.js: نمط 0.35 ومتكررة 0.60).
 * مرتكزة على قياس (docs/ML_LOCAL.ar.md): غير المرتبط يبلغ ≤ 0.36 خامًا (باستثناء قرين موضوعي صادق)، والمتطابق الصحيح يبدأ من ≈ 0.48.
 *   خام ≤ 0.36 ← يبقى تحت عتبة النمط، 0.36 ← 0.35، 0.48 ← 0.60، وبعدها ميل ≈ 2.1 حتى 1.
 */
export const CAL = { lowEdge: 0.36, pattern: 0.35, mid: 0.48, recurring: 0.6, slope: (0.6 - 0.35) / (0.48 - 0.36) };
export function calibrate(base) {
  const x = Math.max(0, base);
  if (x <= CAL.lowEdge) return x * (CAL.pattern / CAL.lowEdge);
  return Math.min(1, CAL.pattern + (x - CAL.lowEdge) * CAL.slope);
}
export const WEIGHTS = { withLsa: { concept: 0.45, lsa: 0.3, gram: 0.25 }, noLsa: { concept: 0.65, lsa: 0, gram: 0.35 } };

/**
 * يبني فهرسًا للمصدر (قائمة مداخل لكل منها `text`). التكلفة صغيرة (مئات المداخل في أجزاء من الثانية).
 * أي إدخال بلا نص يُترك بدرجة صفر.
 */
export function buildSemanticIndex(corpus, opts = {}) {
  const docs = corpus.map((e) => {
    const toks = arTokens(e.text);
    const cons = [...conceptsOf(e.text)];
    return { toks, cons };
  });
  const N = docs.length;
  const dfA = new Map();
  const dfG = new Map();
  const bagA = (d) => [...d.toks, ...d.cons.map((c) => `§${c}`)];
  const bagG = (d) => grams(d.toks);
  const addDf = (map, items) => new Set(items).forEach((t) => map.set(t, (map.get(t) ?? 0) + 1));
  docs.forEach((d) => {
    addDf(dfA, bagA(d));
    addDf(dfG, bagG(d));
  });
  const idfOf = (df, boost = 0) => {
    const m = new Map();
    for (const [t, c] of df) m.set(t, Math.log(1 + (N + 1) / (1 + c)) + (t.startsWith("§") ? boost : 0));
    return m;
  };
  const idfA = idfOf(dfA, 0.8); // المفاهيم أثقل: هي سبب بناء المعجم
  const idfG = idfOf(dfG);
  const vecA = docs.map((d) => weigh(tf(bagA(d)), idfA));
  const vecG = docs.map((d) => weigh(tf(bagG(d)), idfG));
  const lsa = N >= 8 ? buildLsa(vecA, opts) : null;
  const lsaDocs = lsa ? vecA.map((v) => lsa.project(v)) : [];
  return { corpus, docs, idfA, idfG, vecA, vecG, lsa, lsaDocs, N };
}

/** درجة الدلالة بين نص وكل مدخل في الفهرس. */
export function semanticScores(index, text) {
  const toks = arTokens(text);
  const cons = [...conceptsOf(text)];
  const qd = { toks, cons };
  const qA = weigh(tf([...qd.toks, ...qd.cons.map((c) => `§${c}`)]), index.idfA);
  const qG = weigh(tf(grams(qd.toks)), index.idfG);
  const qL = index.lsa ? index.lsa.project(qA) : null;
  const w = index.lsa ? WEIGHTS.withLsa : WEIGHTS.noLsa;
  return index.docs.map((d, i) => {
    const concept = cosine(qA, index.vecA[i]);
    const gram = cosine(qG, index.vecG[i]);
    const lsa = qL && index.lsaDocs[i] ? Math.max(0, cosArr(qL, index.lsaDocs[i])) : 0;
    const shared = qd.cons.filter((c) => d.cons.includes(c));
    const base = w.concept * concept + w.lsa * lsa + w.gram * gram;
    return { i, concept, gram, lsa, base, sem: calibrate(base), shared };
  });
}

/**
 * يدمج النتيجة اللفظية القائمة (lexical = ناتج compareObservation) مع الدلالية بنفس شكل النتيجة.
 * الدرجة النهائية = max(اللفظية، مزيج مُعايَر)، فلا تنخفض درجة كانت تُلتقط، ويُفسَّر كل رفع بالمفاهيم المشتركة.
 * يشترط للرفع الدلالي مفهومًا مشتركًا واحدًا على الأقل أو تقاطعًا لفظيًا، حتى لا ترفع الطبقتان الإحصائيتان وحدهما تشابهًا وهميًا.
 */
/** حد أدنى لرفع الدرجة دلاليًا: ما دونه لا يُرفع (يبقى لفظيًا). يمنع «أنماطًا» وهمية من تشابه موضوعي عام. */
export const SEM_FLOOR = 0.42;

export function blendWithLexical(text, corpus, lexical, { limit = 5, index } = {}) {
  const idx = index ?? buildSemanticIndex(corpus);
  const sem = semanticScores(idx, text);
  const lexById = new Map((lexical.all ?? lexical.matches ?? []).map((m) => [m.id, m]));
  const merged = [];
  corpus.forEach((e, i) => {
    const s = sem[i];
    const lex = lexById.get(e.id)?.score ?? 0;
    const lifted = (s.shared.length || lex > 0) && s.sem >= SEM_FLOOR ? s.sem : 0;
    const score = Math.max(lex, lifted);
    if (score <= 0) return;
    merged.push({
      ...e,
      score,
      lexScore: lex,
      semScore: s.sem,
      semantic: { concept: s.concept, lsa: s.lsa, gram: s.gram, shared: s.shared.map(conceptLabel), lifted: lifted > lex },
    });
  });
  merged.sort((a, b) => b.score - a.score);
  return {
    matches: merged.filter((m) => m.score >= 0.2).slice(0, limit),
    entries: corpus.length,
    reports: lexical.reports ?? new Set(corpus.map((e) => e.reportId)).size,
    all: merged,
    semantic: { lsa: !!idx.lsa, k: idx.lsa?.k ?? 0 },
  };
}
