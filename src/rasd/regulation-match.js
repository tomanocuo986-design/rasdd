// @ts-nocheck
import { repairArabic, isGarbled } from "./arabic-text.js";

var norm = (s) =>
  s
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
// كلمات الإيقاف تُطبَّع بالدالة نفسها التي تُطبَّع بها رموز البحث؛ وإلا لا يطابق «على» (تصير «علي») ولا «مقارنة» (تصير «مقارنه»).
var stop = /* @__PURE__ */ new Set([
  "غير",
  "دون",
  "بدون",
  "على",
  "إلى",
  "الى",
  "من",
  "في",
  "مع",
  "عن",
  "أو",
  "لا",
  "ما",
  "قبل",
  "بعد",
  "بلا",
  "مقارنة",
].map((w) => norm(w)));
var tokens = (s) =>
  norm(s)
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.replace(/^(ال|وال|بال|لل)/, ""))
    .filter((w) => w.length >= 3 && !stop.has(w));
/** طول البادئة المشتركة بين كلمتين. */
var commonPrefix = (a, b) => {
  var n = Math.min(a.length, b.length), i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
};
/**
 * قوة تطابق كلمة بحث مع كلمة في النص: 1 تطابق تام، 0.5 اشتقاق قريب (5 أحرف مشتركة على الأقل و80% من الأقصر: مشتريات/مشتريه)،
 * 0 لا شيء. كان يكفي سابقاً تطابق أول 4 أحرف فيُنسب «مشترك» إلى «مشتريات».
 */
export var tokenMatch = (w, t) => {
  if (w === t) return 1;
  var n = Math.min(w.length, t.length);
  if (n < 4) return 0;
  return commonPrefix(w, t) >= Math.max(5, Math.ceil(n * 0.8)) ? 0.5 : 0;
};
/**
 * أفضل مقطع قانوني مقترح لملاحظة. النتيجة اقتراح آلي لا سند نهائي: تحمل `confidence` (high/medium/low) و`matched/of`
 * ليراجعها المدقق. يُشترط تطابق تام لكلمة واحدة على الأقل، ومجموع التطابق لا يقل عن min(2، عدد كلمات الاختبار).
 */
export function matchRegulation(test, docs) {
  const q = [...new Set(tokens(test))];
  if (!q.length) return;
  const need = Math.min(2, q.length);
  let best;
  for (const d of docs)
    for (const seg of d.segments) {
      // مصفوفة الرموز تُبنى مرة واحدة لكل مقطع.
      const arr = seg.arr ?? (seg.arr = [...seg.toks]);
      let score = 0, exact = 0, matched = 0;
      for (const w of q) {
        let m = seg.toks.has(w) ? 1 : 0;
        if (!m) for (const t of arr) { const v = tokenMatch(w, t); if (v > m) m = v; if (m === 1) break; }
        if (m) { score += m; matched++; if (m === 1) exact++; }
      }
      if (exact >= 1 && score >= need && (!best || score > best.score)) {
        const coverage = score / q.length;
        best = {
          doc: d.name,
          docId: d.id,
          excerpt: seg.text.slice(0, 260),
          score,
          matched,
          of: q.length,
          confidence: coverage >= 0.8 ? "high" : coverage >= 0.5 ? "medium" : "low",
        };
      }
    }
  return best;
}
export function segmentDoc(text) {
  // يُصلح النص أولًا (يشمل مستندات خُزّنت بحروف مشوّهة قبل هذا الإصدار) ثم تُستبعد المقاطع التي بقي فيها تلف،
  // فلا يظهر نص مشوّه في خانة «السند القانوني» أبدًا.
  return repairArabic(text)
    .split(/(?<=[.。؛:])\s+|\n+|(?=\s(?:المادة|مادة)\s)/)
    .map((t) => t.trim())
    .filter((t) => t.length > 15 && !isGarbled(t))
    .map((t) => ({
      text: t,
      toks: new Set(tokens(t)),
    }));
}
