// البحث في «مكتبة الأنظمة» المرفوعة (RAG): يقطّع نص كل نظام إلى مقاطع، ثم يرتّبها بخوارزمية BM25 على جذور عربية مبسّطة.
// الهدف: أن يستشهد المساعد بنص النظام الفعلي الذي رفعه المدقق (اسم الوثيقة + رقم المادة كما ورد فيها حرفيًا)
// بدل الاعتماد على ذاكرة النموذج. لا يُولَّد هنا أي رقم مادة: يُستخرج فقط من بداية المقطع إن وُجد في النص.
import { isGarbled, repairArabic } from "./arabic-text.js";

const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
const STOP = new Set(
  "في من على الى إلى عن مع هذا هذه ذلك التي الذي التي او أو ثم قد كان كانت يكون تكون لا ما لم لن إن ان أن كل بعد قبل عند حتى هل ماذا كيف اي أي هو هي هم".split(" "),
);

/** يوحّد الأرقام الهندية والفارسية إلى لاتينية. */
export function asciiDigits(s) {
  return String(s ?? "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
}

/** تطبيع خفيف: إزالة التشكيل والتطويل وتوحيد الألف والياء والتاء المربوطة. */
export function normalizeToken(w) {
  return w
    .replace(DIACRITICS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

/** يزيل «ال» التعريف وحروف الجر الملتصقة الشائعة من أول الكلمة (جذر تقريبي يكفي للبحث). */
export function stem(w) {
  let t = w;
  if (t.length > 5 && /^(وال|بال|كال|فال|لل)/.test(t)) t = t.replace(/^(وال|بال|كال|فال)/, "").replace(/^لل/, "ل");
  else if (t.length > 4 && t.startsWith("ال")) t = t.slice(2);
  else if (t.length > 4 && /^[وفب]/.test(t) && !/^(وزاره|فاتوره|بلديه)/.test(t)) t = t.slice(1);
  return t;
}

export function tokenize(text) {
  const out = [];
  for (const raw of asciiDigits(String(text ?? "")).toLowerCase().match(/[\u0621-\u064Aa-z0-9]+/g) ?? []) {
    const n = normalizeToken(raw);
    if (n.length < 2 || STOP.has(raw) || STOP.has(n)) continue;
    out.push(stem(n));
  }
  return out;
}

const ARTICLE_AT_START = /^\s*(?:المادة|مادة)\s*[(\[]?\s*([0-9\u0660-\u0669]+(?:\s*\/\s*[أ-ي])?)\s*[)\]]?/;

/** رقم المادة كما ورد في بداية المقطع (إن وُجد)؛ وإلا "". لا يُستنتج ولا يُولَّد. */
export function articleOf(chunkText) {
  const m = ARTICLE_AT_START.exec(chunkText);
  return m ? asciiDigits(m[1]).replace(/\s+/g, "") : "";
}

/**
 * يقطّع نص نظام إلى مقاطع: حد المادة يبدأ مقطعًا جديدًا، والمقاطع الطويلة تُقسَّم على حدود الجمل مع تداخل بسيط.
 * المقاطع المشوّهة (OCR/كشيدة) تُستبعد كي لا يُستشهد بنص تالف.
 */
export function chunkText(text, { maxChars = 900, overlap = 120 } = {}) {
  const clean = repairArabic(text);
  const parts = clean.split(/(?=(?:^|\n|\s)(?:المادة|مادة)\s*[(\[]?\s*[0-9\u0660-\u0669]+)/);
  const chunks = [];
  for (const part of parts) {
    const p = part.replace(/\s+/g, " ").trim();
    if (p.length < 20) continue;
    if (p.length <= maxChars) {
      chunks.push(p);
      continue;
    }
    const article = articleOf(p);
    const sentences = p.split(/(?<=[.。؛:؟!])\s+/);
    let cur = "";
    for (const s of sentences) {
      if (cur && cur.length + s.length + 1 > maxChars) {
        chunks.push(cur.trim());
        const tail = cur.slice(-overlap);
        cur = (article ? `(تتمة المادة ${article}) ` : "") + tail + " " + s;
      } else cur = cur ? `${cur} ${s}` : s;
    }
    if (cur.trim().length >= 20) chunks.push(cur.trim());
  }
  return chunks.filter((c) => !isGarbled(c));
}

/** يبني فهرسًا من وثائق المكتبة ({id, name, text, effectiveDate?, sourceNote?}). */
export function buildIndex(docs) {
  const entries = [];
  for (const d of docs ?? []) {
    if (!d?.text || typeof d.text !== "string") continue;
    for (const text of chunkText(d.text)) {
      const toks = tokenize(text);
      if (!toks.length) continue;
      const tf = new Map();
      for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
      entries.push({
        docId: d.id,
        docName: d.name ?? "",
        effectiveDate: d.effectiveDate ?? "",
        sourceNote: d.sourceNote ?? "",
        article: articleOf(text),
        text,
        tf,
        len: toks.length,
      });
    }
  }
  const df = new Map();
  for (const e of entries) for (const t of e.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLen = entries.reduce((a, e) => a + e.len, 0) / (entries.length || 1);
  return { entries, df, avgLen, n: entries.length };
}

/** BM25. يعيد أعلى k مقاطع مرتبة، مع استبعاد ما دون الحد الأدنى للصلة. */
export function search(index, query, { k = 5, k1 = 1.5, b = 0.75, minScore = 1.0 } = {}) {
  const q = [...new Set(tokenize(query))];
  if (!q.length || !index.n) return [];
  const scored = [];
  for (const e of index.entries) {
    let score = 0;
    for (const t of q) {
      const f = e.tf.get(t);
      if (!f) continue;
      const n = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (index.n - n + 0.5) / (n + 0.5));
      score += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * e.len) / (index.avgLen || 1)));
    }
    if (score >= minScore) scored.push({ e, score });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, k).map(({ e, score }) => ({
    docId: e.docId,
    docName: e.docName,
    effectiveDate: e.effectiveDate,
    sourceNote: e.sourceNote,
    article: e.article,
    text: e.text,
    score: Math.round(score * 100) / 100,
  }));
}

// فهرس مخزّن مؤقتًا: يُعاد بناؤه فقط عند تغيّر الوثائق (المعرّف + طول النص + بيانات النسخة).
let cache = { sig: "", index: null };
const signature = (docs) =>
  (docs ?? []).map((d) => `${d.id}:${String(d.text ?? "").length}:${d.effectiveDate ?? ""}`).join("|");

export function retrievePassages(docs, query, opts = {}) {
  const sig = signature(docs);
  if (cache.sig !== sig || !cache.index) cache = { sig, index: buildIndex(docs) };
  return search(cache.index, query, opts);
}

/**
 * نص البحث: كلام المستخدم، وفي وضعي التحليل والمسودة نضيف اختبارات وتفاصيل أعلى الملاحظات
 * كي تُجلب المواد المتعلقة بما كشفه التدقيق فعلًا.
 */
export function buildQuery(userText, ctx, mode) {
  const base = String(userText ?? "");
  if (mode !== "analyze" && mode !== "report") return base;
  const top = ctx?.audit?.topFindings ?? [];
  const extra = top
    .slice(0, 8)
    .map((f) => `${f.test ?? ""} ${String(f.detail ?? "").slice(0, 120)}`)
    .join(" ");
  return `${base} ${extra}`.trim();
}

/** يقتطع المقاطع إلى الحجم المرسل للخادم (يتوافق مع حدود مسار /api/chat). */
export function toPayload(passages, { maxItems = 6, maxChars = 1000 } = {}) {
  return passages.slice(0, maxItems).map((p) => ({
    source: [p.docName, p.article ? `المادة ${p.article}` : "", p.effectiveDate ? `نفاذ ${p.effectiveDate}` : ""]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 200),
    text: p.text.slice(0, maxChars),
  }));
}
