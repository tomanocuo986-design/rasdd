// @ts-nocheck
/**
 * صياغة ملاحظة رقابية من خانة «اسأل المساعد».
 *
 * إذا وصف المدقق ملاحظة ولم ترد في التقارير السابقة، يعيد البرنامج صياغتها بعناصر قالب الديوان:
 *   الحالة، السبب، السند القانوني، الأثر، التوصية + تصنيفها (مرتفعة / متوسطة / منخفضة)،
 * وتنتظر قرار المدقق: اعتماد أو تعديل أو حذف. لا تدخل التقرير الرقابي ولا ملف Word/PDF قبل الاعتماد.
 *
 * السند القانوني يؤخذ من مكتبة الأنظمة التي رفعها المدقق فقط (نص المقطع ورقم المادة كما ورد فيه)،
 * ولا يُولَّد من ذاكرة نموذج. إن لم يوجد مقطع مطابق يبقى «بلا سند» ويطلب البرنامج تأكيدًا صريحًا عند الاعتماد.
 * كل المعالجة محلية في المتصفح.
 */
import {
  THRESHOLDS,
  buildObservation,
  classifyObservation,
  compareObservationSemantic,
  loadCorpus,
  reviewMemo,
} from "./auditor-draft.js";
import { retrievePassages } from "./legal-retrieval.js";
import { listRegulations } from "./regulations-db.js";
import { addManualObservation } from "./manual-observations";
import {
  DEFAULT_CAUSE,
  DEFAULT_EFFECT,
  DEFAULT_REC,
  NO_BASIS_TEXT,
  contextualCause,
  contextualEffect,
  loadIds,
  ruleFor,
  saveIds,
} from "./observations";
import { loadOverrides, needsConfirmation, recordOverrides } from "./legal-status";
import { DECISIONS, loadReviewLog, recordDecision, saveReviewLog } from "./review-log.js";
import { trackEvent } from "./audit-trail.js";

const DIACRITICS = /[\u064B-\u0652\u0640]/g;
const strip = (s) => String(s ?? "").replace(DIACRITICS, "");

/* ------------------------- هل الرسالة وصف لملاحظة؟ ------------------------- */

// افتتاحيات الملاحظات الرقابية، وأوامر الصياغة الصريحة. الأسئلة العادية لا تُعامل كملاحظة.
const OPENERS =
  /^\s*(?:لوحظ(?:ت)?|تبين|ثبت|رصدنا|رصدت|رصد|وجدنا|وجد|صغ|اصغ|أعد صياغة|اعد صياغة|صياغة ملاحظة|اكتب ملاحظة|سجل ملاحظة|ملاحظة\s*[:：])/;

export function isObservationText(text) {
  const t = strip(text);
  if (t.trim().length < 15) return false;
  return OPENERS.test(t);
}

/** يزيل أمر الصياغة («صغ لي ملاحظة:») ويُبقي وصف الملاحظة نفسه. */
export function extractObservationText(text) {
  let t = String(text ?? "").trim();
  t = t.replace(
    /^\s*(?:صغ|اصغ|صُغ|اكتب|سجّل|سجل|أعد صياغة|اعد صياغة|صياغة)(?:\s+لي)?\s+(?:هذه\s+)?(?:الملاحظة|ملاحظة)(?:\s+الرقابية)?\s*[:：\-–]?\s*/u,
    "",
  );
  t = t.replace(/^\s*ملاحظة\s*[:：]\s*/u, "");
  return t.trim();
}

const FORMAL_OPENER = /^\s*(?:لوحظ|تبين|تبيّن|ثبت|رصدنا|رُصد|رصد|وجدنا)/u;

/** «الحالة» بصياغة رسمية: تبدأ بـ«لوحظ» إن لم يبدأها المدقق بعبارة رقابية، وتنتهي بنقطة. */
export function formalCondition(text) {
  let t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (!FORMAL_OPENER.test(strip(t))) t = `لوحظ ${t}`;
  return /[.!؟?]$/.test(t) ? t : `${t}.`;
}

const OPENER_STRIP = /^\s*(?:لوحظ(?:ت)?(?:\s+أن)?|تبين(?:\s+أن)?|تبيّن(?:\s+أن)?|ثبت(?:\s+أن)?|رصدنا|رصدت|رصد|وجدنا|وجد)\s+/u;
/** عنوان قصير للملاحظة من أول جملة فيها (بلا افتتاحية «لوحظ»). */
export function titleOf(text) {
  const t = String(text ?? "").trim();
  const clause = (t.replace(OPENER_STRIP, "") || t).split(/[\n.؛;:۔]/)[0].trim();
  if (clause.length <= 70) return clause;
  // القطع عند حد كلمة كاملة (لا في منتصفها) وقبل حرف جر معلّق
  const words = clause.slice(0, 70).split(" ").slice(0, -1);
  while (words.length > 4 && /^(?:ل|ب|ك|و|في|من|على|إلى|الى|عن|مع|لتفادي)$/u.test(words[words.length - 1])) words.pop();
  return `${words.join(" ")}…`;
}

/* ------------------------- السند القانوني من المكتبة ------------------------- */

const NO_BASIS = { source: "default", text: NO_BASIS_TEXT, needsVerification: false };

function cut(text, max = 420) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  return `${head.slice(0, head.lastIndexOf(" ") > 200 ? head.lastIndexOf(" ") : max)}…`;
}

/** مقطع من المكتبة -> سند: اسم الوثيقة، رقم المادة كما ورد في المقطع (إن وُجد)، ثم النص. */
const LEADING_ARTICLE = /^\s*(?:المادة|مادة)\s*[(\[]?\s*[0-9\u0660-\u0669]+(?:\s*\/\s*[أ-ي])?\s*[)\]]?\s*[:\-–—]?\s*/u;

export function basisFromPassage(p) {
  const art = p.article ? `المادة (${p.article})` : "";
  const head = [p.docName, art].filter(Boolean).join(" — ");
  // رقم المادة صار في الترويسة، فلا نكرره في أول النص
  const body = p.article ? String(p.text).replace(LEADING_ARTICLE, "") : p.text;
  return {
    source: "library",
    text: `${head ? `${head}: ` : ""}${cut(body)}`,
    needsVerification: false,
  };
}

/**
 * أفضل مقاطع المكتبة لوصف الملاحظة. تعيد السند المقترح (الأعلى صلة) وبدائل يختار منها المدقق.
 * `docs` اختياري (للاختبار)؛ وإلا تُقرأ المكتبة من المتصفح.
 */
export async function findLegalBasis(query, docs) {
  let library = docs;
  if (!library) {
    try {
      library = await listRegulations();
    } catch {
      library = [];
    }
  }
  if (!library?.length) return { basis: NO_BASIS, candidates: [], hasLibrary: false };
  const passages = retrievePassages(library, query, { k: 4 });
  if (!passages.length) return { basis: NO_BASIS, candidates: [], hasLibrary: true };
  const candidates = passages.map((p) => ({
    label: [p.docName, p.article ? `المادة ${p.article}` : ""].filter(Boolean).join(" — ") || "مقطع من المكتبة",
    basis: basisFromPassage(p),
  }));
  return { basis: candidates[0].basis, candidates, hasLibrary: true };
}

/* ------------------------- المسودة ------------------------- */

/**
 * يحلل وصف المدقق:
 *  - إن وردت ملاحظة مطابقة في تقرير سابق (تشابه ≥ عتبة «المتكررة») يُرجع { exists: true, matches } ولا يصيغ شيئًا،
 *    ما لم يطلب المدقق صراحة `force`.
 *  - وإلا يصوغها بالعناصر الخمسة ويصنفها.
 */
export async function makeChatDraft(rawText, { force = false, corpus, docs } = {}) {
  const text = extractObservationText(rawText);
  const source = corpus ?? loadCorpus();
  const comparison = compareObservationSemantic(text, source);
  const analysis = { comparison, ...classifyObservation(text, comparison) };

  const prior = comparison.matches.filter((m) => m.reportId !== "current" && m.score >= THRESHOLDS.recurring);
  if (prior.length && !force) return { exists: true, text, matches: prior.slice(0, 3), analysis };

  const title = titleOf(text);
  const rule = ruleFor(`${title} ${text}`);
  // لا نقحم عنوانًا طويلًا أو مبتورًا داخل السبب والأثر: نستعمل الصياغة العامة ويعدّلها المدقق
  const quotable = title.length <= 60 && !title.endsWith("…");
  const noRule = rule.cause === DEFAULT_CAUSE;
  const generic = noRule && quotable;
  const best = comparison.matches[0];
  const { basis, candidates, hasLibrary } = await findLegalBasis(`${title} ${text}`, docs);

  return {
    exists: false,
    text,
    title,
    severity: analysis.severity,
    analysis,
    statusLabel: analysis.statusLabel,
    matches: comparison.matches.slice(0, 3),
    condition: formalCondition(text),
    cause: generic ? contextualCause(title, "العملية محل الفحص") : rule.cause,
    effect: generic ? contextualEffect(title, 1) : rule.effect,
    recommendation: best?.recommendation || rule.recommendation,
    legalBasis: basis,
    candidates,
    hasLibrary,
  };
}

export const hasDefaultWording = (d) =>
  d.cause === DEFAULT_CAUSE || d.effect === DEFAULT_EFFECT || d.recommendation === DEFAULT_REC;

/* ------------------------- قرار المدقق ------------------------- */

export function buildFromDraft(d, sector) {
  return buildObservation({
    title: d.title,
    text: d.condition,
    sector,
    severity: d.severity,
    cause: d.cause,
    effect: d.effect,
    recommendation: d.recommendation,
    analysis: d.analysis,
    legalBasis: d.legalBasis,
    // «جديدة» = لم يرد ما يشبهها في أي تقرير سابق
    isNew: d.analysis?.status === "new",
  });
}

/**
 * الاعتماد النهائي: يدرج الملاحظة في «التقرير الرقابي» ثم في قالب التقرير وملف Word/PDF.
 * إن لم يكن السند من المكتبة أو من المدقق يلزم `confirmedNoBasis` (نفس بوابة السند في بقية البرنامج).
 */
export function approveChatDraft(d, sector, { confirmedNoBasis = false } = {}) {
  const o = buildFromDraft(d, sector);
  if (needsConfirmation(o, loadOverrides())) {
    if (!confirmedNoBasis) return { ok: false, needsConfirm: true };
    recordOverrides([o], "approve");
  }
  saveIds("approved", new Set([...loadIds("approved"), o.id]));
  addManualObservation(o);
  saveReviewLog(recordDecision(loadReviewLog(), { dataset: "manual", test: o.test, decision: DECISIONS.confirmed }));
  trackEvent("ui.draft.approve", o.id, o.test);
  return { ok: true, observation: o };
}

/** الحذف: يوثَّق القرار ومعه مسودة مذكرة المراجعة؛ لا تدخل الملاحظة أي تقرير. */
export function discardChatDraft(d, reason = "") {
  saveReviewLog(
    recordDecision(loadReviewLog(), { dataset: "manual", test: d.title, decision: DECISIONS.falsePositive, note: reason }),
  );
  trackEvent("ui.draft.delete", "", d.title);
}

export const memoFor = (d, sectorLabel, reason) =>
  reviewMemo({ title: d.title, text: d.condition, severity: d.severity, sector: sectorLabel, reason, matches: d.matches });
