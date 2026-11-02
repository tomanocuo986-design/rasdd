// @ts-nocheck
/**
 * مطابقة تضارب المصالح بين طرفين (مورد/جهة محال عليها ↔ موظف أو عامل مياومة) مع درجة ثقة.
 * وحدة نقية بلا اعتماد على React كي تُختبر وحدها؛ ويقابلها python/conflict.py بالأوزان نفسها (conflict-config.json).
 *
 * المؤشرات: الرقم الوطني، الحساب البنكي، الهاتف، العنوان، الاسم الكامل.
 * الثقة = 1 − ∏(1 − وزن كل مؤشر متطابق). وإن كان للطرفين رقمان وطنيان مختلفان فهما شخصان مختلفان
 * على الأرجح، فتُخفَّض الثقة (conflicting_national_id_factor) بدل أن تبقى شبهة اسم أو هاتف كاملة.
 */
import CONFIG from "./conflict-config.json";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const txt = (v) => String(v ?? "").trim();
const latinDigits = (s) =>
  txt(s)
    .replace(/[٠-٩]/g, (c) => AR_DIGITS.indexOf(c))
    .replace(/[۰-۹]/g, (c) => PERSIAN_DIGITS.indexOf(c));

export const nameKey = (s) =>
  txt(s)
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .toLowerCase();
export const fullNameKey = (s) => {
  const a = nameKey(s);
  return a.split(" ").filter(Boolean).length >= 2 ? a : "";
};
export const phoneKey = (s) => {
  const d = latinDigits(s).replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-9) : "";
};
export const acctKey = (s) => {
  const a = txt(s).replace(/[\s-]/g, "").toUpperCase();
  return a.length >= 6 ? a : "";
};
export const addrKey = (s) => {
  const a = nameKey(s).replace(/[^\p{L}\p{N} ]/gu, "");
  return a.length >= 10 ? a : "";
};

/** الرقم الوطني بصيغته الموحدة: أرقام فقط بطول 8–12 (الأردني 10). أي نص فيه حروف (مثل E-100) ليس رقماً وطنياً. */
export const nationalIdKey = (s) => {
  const t = latinDigits(s).replace(/[\s-]/g, "");
  const { min_length: lo, max_length: hi } = CONFIG.national_id;
  return /^\d+$/.test(t) && t.length >= lo && t.length <= hi ? t : "";
};

const round2 = (x) => Math.round(x * 100) / 100;
export const levelOf = (confidence) =>
  confidence >= CONFIG.bands.high ? "high" : confidence >= CONFIG.bands.medium ? "medium" : "low";

/**
 * يقارن طرفين بمفاتيح موحدة { nid, acct, phone, addr, nm } ويُرجع null إن لم يتطابق شيء أو كانت الثقة أدنى من الحد.
 * النتيجة: { signals: ["nid"|"acct"|"phone"|"addr"|"name"], confidence (0..1), level, conflictingNid }
 */
export function scoreMatch(a, b) {
  const w = CONFIG.weights;
  const parts = [];
  if (a.nid && b.nid && a.nid === b.nid) {
    const standard = a.nid.length === CONFIG.national_id.standard_length;
    parts.push(["nid", w.national_id * (standard ? 1 : CONFIG.national_id.nonstandard_factor)]);
  }
  if (a.acct && a.acct === b.acct) parts.push(["acct", w.account]);
  if (a.phone && a.phone === b.phone) parts.push(["phone", w.phone]);
  if (a.addr && a.addr === b.addr) parts.push(["addr", w.address]);
  if (a.nm && a.nm === b.nm) parts.push(["name", w.name]);
  if (!parts.length) return null;

  let confidence = 1 - parts.reduce((p, [, x]) => p * (1 - x), 1);
  const conflictingNid = Boolean(a.nid && b.nid && a.nid !== b.nid);
  if (conflictingNid) confidence *= CONFIG.conflicting_national_id_factor;
  confidence = round2(Math.min(confidence, 0.99) + 1e-9); // +1e-9: نفس تقريب Python (conflict.py)
  if (confidence < CONFIG.min_report) return null;
  return { signals: parts.map(([s]) => s), confidence, level: levelOf(confidence), conflictingNid };
}

export const pct = (c) => `${Math.round(c * 100)}%`;
