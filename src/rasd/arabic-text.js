// إصلاح النص العربي المستخرج من ملفات PDF (الأنظمة والتعليمات المرفوعة).
//
// المشاكل التي تعالجها:
//  1) أشكال العرض الطباعية (ﻟﻤﺸﺘﺮﻳﺎﺕ) تُحوَّل إلى الحروف العادية (NFKC) كي يعمل البحث والمطابقة.
//  2) النصوص المضبوطة بالعرض في بعض الملفات تُمطَّط بالكشيدة، وبعض الخطوط لا تربط شكل الكشيدة برمزها فيقرؤها المستخرج
//     حرفًا عاديًا (غالبًا «ه») فتظهر «تجزئههههة» بدل «تجزئة». العربية لا تحوي ثلاثة أحرف متطابقة متتالية، فهذه علامة قاطعة.
//  3) ملفات تُستخرج بترتيب بصري معكوس (الكلمة تُقرأ من آخرها).
//  4) رموز اتجاه خفية تفسد العرض.
// ما لا يمكن إصلاحه بالقواعد يُكشف بـ isGarbled ليُستبعد من خانة «السند القانوني» بدل عرض نص مشوّه.

const BIDI_AND_ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const AR_RUN = /([\u0621-\u064A])\1{2,}/g; // ثلاثة أحرف عربية متطابقة فأكثر
const AR_LETTER = /[\u0621-\u064A]/g;

/** NFKC يحوّل أشكال العرض (FB50–FDFF, FE70–FEFF) إلى حروفها الأصلية، ويحذف رموز الاتجاه الخفية. */
export function normalizeArabic(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(BIDI_AND_ZERO_WIDTH, "")
    .replace(/[ \t\u00A0]+/g, " ");
}

/** نسبة الحروف العربية الواقعة داخل تكرارات مستحيلة لغويًا (0 = سليم). */
export function garbleRatio(text) {
  const s = String(text ?? "");
  const letters = (s.match(AR_LETTER) ?? []).length;
  if (letters < 12) return 0;
  let bad = 0;
  for (const m of s.matchAll(AR_RUN)) bad += m[0].length;
  return bad / letters;
}

/** هل النص تالف بما يمنع عرضه؟ العتبة منخفضة عمدًا: كلمة واحدة مشوّهة في مقطع قصير تكفي لإخفائه. */
export function isGarbled(text, threshold = 0.04) {
  return garbleRatio(text) >= threshold;
}

/**
 * يصلح تكرارات الكشيدة المقروءة حروفًا. الطول الأكثر شيوعًا لتكرار الحرف في الملف هو طول الكشيدة K
 * (التمطيط ثابت غالبًا): تكرار بطول K يُحذف كله، وتكرار أطول من K يعني حرفًا حقيقيًا مع الكشيدة فيُبقى منه الزائد.
 * مثال (K=4): «تجزئههههة» ← «تجزئة»، «تسهههههيل» ← «تسهيل».
 * إصلاح تقريبي؛ الأدق إعادة قراءة الصفحة بـ OCR (pdf-text.js يفعل ذلك عند توفر الإنترنت).
 */
export function repairKashida(text) {
  const s = String(text ?? "");
  const lengths = new Map(); // حرف -> (طول التكرار -> عدد مرات)
  for (const m of s.matchAll(AR_RUN)) {
    const byLen = lengths.get(m[1]) ?? new Map();
    byLen.set(m[0].length, (byLen.get(m[0].length) ?? 0) + 1);
    lengths.set(m[1], byLen);
  }
  if (!lengths.size) return s;
  // الطول الأشيع عبر كل الحروف (الكشيدة تُقرأ بحرف واحد في الملف الواحد غالبًا)
  const global = new Map();
  for (const byLen of lengths.values()) for (const [len, n] of byLen) global.set(len, (global.get(len) ?? 0) + n);
  const K = [...global].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  return s.replace(AR_RUN, (run, ch) => (run.length <= K ? "" : ch.repeat(run.length - K)));
}

const startsAl = /(^|\s)ال/g; // «ال» التعريف في بداية الكلمة
const endsLa = /لا(?=\s|$)/g; // «ال» معكوسة في نهاية الكلمة

/** هل النص مستخرج بترتيب بصري معكوس؟ (كلمات تنتهي بـ «لا» بكثرة وقلّ ما تبدأ بـ «ال») */
export function looksReversed(text) {
  const s = String(text ?? "");
  const fwd = (s.match(startsAl) ?? []).length;
  const rev = (s.match(endsLa) ?? []).length;
  return rev >= 6 && rev > fwd * 2;
}

/** يعكس سلسلة عربية معكوسة مع إبقاء الأرقام والحروف اللاتينية بترتيبها الصحيح. */
export function unreverse(str) {
  return [...String(str)]
    .reverse()
    .join("")
    .replace(/[A-Za-z0-9][A-Za-z0-9.,:/\-_%]*/g, (m) => [...m].reverse().join(""));
}

/**
 * الإصلاح الكامل لنص صفحة أو مستند: تطبيع ثم عكس الاتجاه إن لزم ثم إصلاح الكشيدة.
 * idempotent: تطبيقه مرتين لا يغيّر النتيجة، فيصلح أيضًا مستندات خُزّنت قبل هذا الإصدار.
 */
export function repairArabic(text) {
  let s = normalizeArabic(text);
  if (looksReversed(s)) s = s.split("\n").map(unreverse).join("\n");
  return repairKashida(s);
}
