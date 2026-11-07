// @ts-nocheck
/**
 * حجب البيانات الشخصية من نص المستند قبل أن يغادر المتصفح (يُستخدم مع مراجعة المستندات بالذكاء الاصطناعي).
 *
 * ما يحجبه حتمياً (قواعد، لا نموذج):
 *   - أرقام وطنية (8–12 خانة)، أرقام هواتف أردنية، أرقام IBAN، عناوين بريد.
 *   - أسماء أشخاص مسبوقة بلقب (السيد، المهندس، الدكتور، م.، د. …) حتى 3 كلمات بعده.
 *   - أي مصطلحات يضيفها المدقق (اسم مورد، موظف، شركة…).
 * ما لا يحجبه: اسم شخص بلا لقب ولا ورد في قائمة المدقق، وأي بيانات حساسة لا تطابق هذه الأنماط. هذا حدّ معروف،
 * فلا يُعدّ الحجب ضماناً كاملاً؛ ولذلك يظهر ملخصه للمدقق، ويُفضَّل نموذج محلي.
 * المبالغ والتواريخ وأرقام العطاءات والمواد وأسماء الجهات العامة تبقى كما هي لأن البنود تحتاجها.
 *
 * الاستبدال ثابت (النص نفسه ← الرمز نفسه) والمعكوس محفوظ في المتصفح فقط، فيُستعاد الأصل عند عرض الاقتباسات.
 */

const AR_DIGIT = "٠١٢٣٤٥٦٧٨٩";
const D = "[0-9٠-٩]";
const toLatin = (s) => s.replace(/[٠-٩]/g, (c) => String(AR_DIGIT.indexOf(c)));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const KINDS = {
  term: "مصطلح",
  iban: "حساب",
  email: "بريد",
  phone: "هاتف",
  nid: "رقم_وطني",
  name: "اسم",
};

const TITLES = "(?:السيد|السيدة|الآنسة|الأنسة|المهندس|المهندسة|الدكتور|الدكتورة|الأستاذ|الاستاذ|الأستاذة|المحامي|المحامية|الحاج|الحاجة|الشيخ|م\\.|د\\.|أ\\.)";
const NAME_WORD = "[\\u0621-\\u064A\\u064B-\\u0652]+";
// كلمات توقف التقاط الاسم: حروف جر وروابط وأفعال شائعة وألقاب (كي لا يبتلع اسمٌ لقباً واسماً لاحقين)
const STOP = new Set([
  "في", "من", "على", "إلى", "الى", "عن", "مع", "الذي", "التي", "الذين", "هو", "هي", "قام", "قامت", "بتاريخ", "وقد", "حيث", "لدى",
  "رئيس", "مدير", "مديرة", "ثم", "أو", "بعد", "قبل", "خلال", "بصفته", "بصفتها", "وذلك", "لكن", "كما", "إذ",
  "السيد", "السيدة", "الآنسة", "الأنسة", "المهندس", "المهندسة", "الدكتور", "الدكتورة", "الأستاذ", "الاستاذ", "الأستاذة", "المحامي", "المحامية", "الحاج", "الحاجة", "الشيخ",
]);
const NAME_RE = new RegExp(`(?<![\\u0621-\\u064A])${TITLES}\\s+(${NAME_WORD}(?:\\s+${NAME_WORD}){0,3})`, "g");

/**
 * @param {string} text
 * @param {{extraTerms?: string[]}} opts
 * @returns {{text:string, map:Map<string,string>, counts:Record<string,number>, total:number}}
 */
export function redactDocument(text, { extraTerms = [] } = {}) {
  let out = String(text ?? "");
  const map = new Map(); // رمز → أصل
  const reverse = new Map(); // `${kind}|${أصل}` → رمز
  const counts = {};
  const seq = {};
  const token = (kind, original) => {
    const key = `${kind}|${original}`;
    let t = reverse.get(key);
    if (!t) {
      seq[kind] = (seq[kind] ?? 0) + 1;
      t = `[${KINDS[kind]}_${seq[kind]}]`;
      reverse.set(key, t);
      map.set(t, original);
    }
    counts[kind] = (counts[kind] ?? 0) + 1;
    return t;
  };

  // 1) مصطلحات المدقق (الأطول أولاً كي لا يُقطع مصطلح داخل آخر)
  const terms = [...new Set(extraTerms.map((t) => String(t ?? "").trim()).filter((t) => t.length >= 2))].sort((a, b) => b.length - a.length);
  for (const term of terms) out = out.replace(new RegExp(esc(term), "gi"), (m) => token("term", m));

  // 2) أنماط حتمية (الأخص أولاً)
  out = out.replace(/\bJO\d{2}[A-Z]{4}\d{22}\b/gi, (m) => token("iban", m));
  out = out.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => token("email", m));
  const Z = "[0٠]", N7 = "[7٧]", N789 = "[7-9٧-٩]";
  out = out.replace(new RegExp(`(?<!${D})(?:(?:\\+|${Z}${Z})[9٩][6٦][2٢][\\s-]?|${Z})${N7}${N789}[\\s-]?${D}{7}(?!${D})`, "g"), (m) => token("phone", m));
  out = out.replace(new RegExp(`(?<![\\d٠-٩./,-])${D}{8,12}(?![\\d٠-٩./,-])`, "g"), (m) => token("nid", m));

  // 3) أسماء بألقاب
  out = out.replace(NAME_RE, (whole, rest) => {
    const words = rest.split(/\s+/);
    const keep = [];
    for (const w of words) {
      if (STOP.has(w)) break;
      keep.push(w);
    }
    if (!keep.length) return whole;
    const title = whole.slice(0, whole.length - rest.length).trimEnd();
    const nameText = keep.join(" ");
    const tail = words.slice(keep.length).join(" ");
    return `${title} ${token("name", nameText)}${tail ? " " + tail : ""}`;
  });

  return { text: out, map, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

/** يعيد الأصل مكان الرموز (للعرض في المتصفح فقط). */
export function restoreText(text, map) {
  let out = String(text ?? "");
  for (const [t, original] of map) out = out.split(t).join(original);
  return out;
}

export const COUNT_LABEL = { term: "مصطلح من قائمتك", iban: "حساب بنكي", email: "بريد", phone: "هاتف", nid: "رقم وطني", name: "اسم بلقب" };

export function redactionSummary(counts) {
  const parts = Object.entries(counts).map(([k, n]) => `${n} ${COUNT_LABEL[k] ?? k}`);
  return parts.length ? `حُجب: ${parts.join("، ")}` : "لم يُحجب شيء (لم تُطابق أي نمط)";
}
