/**
 * محاكي ردود الجهة الخاضعة للرقابة.
 *
 * يقرأ رد إدارة الجهة على ملاحظة رقابية، ويقارنه بالملاحظة نفسها (الحالة والتوصية وعدد الحالات)،
 * ثم يقترح رأياً (تعقيب الديوان) مع الأسباب والفجوات. الرأي استشاري دائماً: لا يدخل التقرير
 * إلا بعد أن يعتمده المدقق أو يعدّله، ويبقى حكم المدقق هو النهائي.
 *
 * محلي بالكامل بالقواعد (بلا خدمة خارجية)، ويمكن للمدقق طلب رأي ثانٍ بالذكاء الاصطناعي عبر /api/chat
 * (يخضع لبوابة السرية والحجب نفسها). لا يُكتب أي رقم مادة أو اسم نظام من الذاكرة.
 */
import type { Observation } from "./observations";

/* ------------------------------ الأنواع ------------------------------ */

export type Stance = "accepts" | "partial" | "rejects" | "action_only" | "unclear";
export type Verdict = "accepted" | "partially_accepted" | "not_accepted" | "insufficient";

export const STANCE_LABELS: Record<Stance, string> = {
  accepts: "قبول الملاحظة",
  partial: "قبول جزئي",
  rejects: "رفض أو اعتراض",
  action_only: "إجراء دون إقرار صريح",
  unclear: "غير واضح",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  accepted: "الرد كافٍ مبدئياً (بانتظار التحقق من المستندات)",
  partially_accepted: "الرد كافٍ جزئياً",
  not_accepted: "الرد غير كافٍ",
  insufficient: "لا يكفي للحكم (يلزم تحقق أو مستند)",
};

export interface Commitments {
  /** موعد التنفيذ كما ورد في الرد (نص) */
  date?: string | undefined;
  /** الجهة أو الوحدة المسؤولة كما وردت في الرد */
  owner?: string | undefined;
  /** هل ذُكر مستند أو مرفق يسند الرد */
  hasEvidence: boolean;
  /** هل الإجراء منفَّذ فعلاً (ماضٍ) أم وعد مستقبلي */
  done: boolean;
  promised: boolean;
}

export interface ResponseAnalysis {
  stance: Stance;
  verdict: Verdict;
  /** رأي المحاكي: فقرة جاهزة للتعديل */
  opinion: string;
  /** صياغة مقترحة لـ«تعقيب الديوان» */
  followUp: string;
  /** لماذا وصل المحاكي إلى هذا الحكم */
  reasons: string[];
  /** ما لم يعالجه الرد */
  gaps: string[];
  /** نسبة تغطية الرد لعناصر التوصية (0–1) */
  coverage: number;
  commitments: Commitments;
  source: "rules" | "ai";
}

export type Decision = "pending" | "approved" | "edited" | "rejected";

/** ما يحفظه المدقق لكل ملاحظة (مفتاحه معرّف الملاحظة، فيبقى عند إعادة التحليل). */
export interface AuditeeRecord {
  response: string;
  receivedAt: string;
  analysis?: ResponseAnalysis | undefined;
  /** قرار المدقق في رأي المحاكي */
  decision: Decision;
  /** التعقيب المعتمد (رأي المحاكي كما هو أو بعد تعديل المدقق) */
  finalOpinion?: string | undefined;
  actionDate?: string | undefined;
  actionOwner?: string | undefined;
  decidedAt?: string | undefined;
  /** رد تجريبي للتجربة فقط: لا يدخل التقرير أبداً */
  demo?: boolean | undefined;
}

/** ما يصل إلى ملف التقرير (PDF وWord) */
export interface AuditeeReportBlock {
  response: string;
  /** التعقيب: لا يوجد إلا بعد اعتماد المدقق */
  opinion?: string | undefined;
  actionDate?: string | undefined;
  actionOwner?: string | undefined;
}

/* ------------------------------ تطبيع النص ------------------------------ */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** يوحّد الأحرف المتشابهة ويحذف التشكيل والكشيدة ويحوّل الأرقام الهندية. */
export function normalizeText(s: string): string {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "في من على الي عن مع هذا هذه ذلك تلك التي الذي الذين او و ثم قد كل بعد قبل عند حتي لا ما لم لن ان انه انها كما كان كانت يتم تم ذات بين هو هي هم له لها لهم به بها فيها فيه عليه عليها منه منها غير ضمن خلال حيث وفق وفقا بشكل".split(
    " ",
  ),
);

/** جذع الكلمة: بلا «ال» التعريف ولا سوابق ولواحق قصيرة. */
function stemOf(raw: string): string {
  let w = normalizeText(raw)
    .replace(/^(وال|بال|لل|فال|كال|ال)/, "")
    .replace(/^[وبلفك](?=.{4,})/, "");
  w = w.replace(/(ات|ون|ين|ان|ها|هم|ية|يه|ه)$/, (m) => (w.length - m.length >= 3 ? "" : m));
  return w;
}

/** كلمات مفتاحية للمقارنة مع الكلمة كما وردت في النص (للعرض). */
export function keywordPairs(s: string): Array<{ stem: string; word: string }> {
  const out = new Map<string, string>();
  for (const tok of String(s ?? "").split(/[^\u0621-\u064Aa-zA-Z0-9\u064B-\u065F]+/)) {
    const word = tok.replace(/[\u064B-\u065F\u0640]/g, "");
    const stem = stemOf(word);
    if (stem.length >= 3 && !STOP.has(stem) && !out.has(stem))
      out.set(stem, word.replace(/^و(?=.{4,})/, ""));
  }
  return [...out].map(([stem, word]) => ({ stem, word }));
}

/** كلمات مفتاحية للمقارنة: بلا أدوات ولا «ال» التعريف ولا لواحق قصيرة. */
export function keywords(s: string): string[] {
  return keywordPairs(s).map((p) => p.stem);
}

/** هيكل الكلمة (بلا سابقة ميمية ولا حروف علة) لمطابقة «مودعة» مع «إيداع». */
const skeleton = (w: string): string => w.replace(/^[متسا]/, "").replace(/[وايءؤئ]/g, "");

/** تطابق جذعين: تساوٍ، أو بداية مشتركة، أو هيكل واحد. */
export function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  const sa = skeleton(a);
  const sb = skeleton(b);
  return sa.length >= 2 && sa === sb;
}

const countHits = (needles: string[], hay: string[]): number =>
  needles.filter((k) => hay.some((h) => sameStem(k, h))).length;

const hasAny = (norm: string, patterns: RegExp[]): boolean => patterns.some((p) => p.test(norm));
const countAny = (norm: string, patterns: RegExp[]): number =>
  patterns.filter((p) => p.test(norm)).length;

/* ------------------------------ إشارات الرد ------------------------------ */

const BEFORE = "(?:^|[\\s.,،؛:()«»\"'\\-])";
const AFTER = "(?=$|[\\s.,،؛:()«»\"'\\-])";
/** كلمة كاملة (حدود \\b لا تعمل مع العربية) */
const word = (alts: string): RegExp => new RegExp(`${BEFORE}(?:${alts})${AFTER}`);

const REJECT = [
  /لا (نوافق|نقر|نتفق)/,
  /نرفض/,
  /نعترض/,
  /غير صحيح/,
  /لا صحه/,
  /لا يوجد (اي )?(مخالفه|خلل|تجاوز|قصور)/,
  /لا توجد (اي )?(مخالفه|ملاحظه)/,
  /غير دقيق/,
  /لا ينطبق/,
  /نختلف/,
  /ليس هناك (مخالفه|خلل)/,
  /الملاحظه (غير )?(في غير محلها|مردود عليها)/,
];
const ACCEPT = [
  /(?<!لا )نوافق/,
  /(?<!لا )نقر(?![ا-ي])/,
  /(?<!لا )نتفق/,
  /صحيح ما ورد/,
  /الملاحظه (في محلها|صحيحه)/,
  /نقبل (الملاحظه|التوصيه)/,
  /تم الاخذ/,
  /سيتم الاخذ/,
];
const DONE = [
  word(
    "تم|تمت|جري|جرت|اوقفنا|اوقفت|صوبنا|صوبت|استرددنا|استردت|فعلنا|فعلت|عدلنا|عدلت|انجزنا|انجزت|نفذنا|نفذت|تحصيل|حصلنا",
  ),
];
const PROMISE = [
  /سيتم/,
  word("سوف"),
  /سنقوم/,
  /سنعمل/,
  /نعمل على/,
  /نسعي/,
  /بصدد/,
  /قيد (الدراسه|التنفيذ|المعالجه)/,
  /سنباشر/,
  /ننظر في/,
  /ستقوم/,
  /سيقوم/,
  /سنلتزم/,
  /سنضمن/,
];
const JUSTIFY = [
  /نظرا ل/,
  /بسبب/,
  /لظروف/,
  /ظروف (استثنائيه|العمل|طارئه)/,
  /نقص (في )?(الكوادر|الموظفين|الكادر)/,
  /ضغط (العمل|الدوام)/,
  /ضروره (العمل|ملحه)/,
  /حاله طارئه/,
  /لم يكن (بالامكان|ممكنا)/,
  /لعدم توفر/,
];
const EVIDENCE = [
  /مرفق/,
  /كتاب رقم/,
  /قرار رقم/,
  /تعميم رقم/,
  /محضر/,
  /صوره عن/,
  /بموجب (الكتاب|القرار|التعميم|العقد|الوثيقه|المستند)/,
  /مستند(ات)? (داعم|مؤيد)/,
  /سند (قبض|صرف) رقم/,
];
const PARTIAL_MARK = [
  /جزئي/,
  /بعض (الحالات|الملاحظات|ما ورد)/,
  /باستثناء/,
  /الا ان/,
  /غير ان/,
  /ولكن/,
  /لكن/,
];

/* ------------------------------ استخراج الالتزامات ------------------------------ */

const MONTHS =
  "يناير|فبراير|مارس|نيسان|ابريل|مايو|ايار|يونيو|حزيران|يوليو|تموز|اغسطس|اب|سبتمبر|ايلول|اكتوبر|تشرين الاول|نوفمبر|تشرين الثاني|ديسمبر|كانون الاول|كانون الثاني|شباط|اذار";

export function extractDate(raw: string): string | undefined {
  const n = normalizeText(raw);
  const patterns: RegExp[] = [
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/,
    /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/,
    new RegExp(
      `\\b(?:بتاريخ|حتى|قبل|بحلول|نهايه|مطلع)?\\s*(?:\\d{1,2}\\s*)?(?:${MONTHS})\\s*\\d{4}\\b`,
    ),
    /خلال\s+\d+\s*(يوم|ايام|اسبوع|اسابيع|شهر|اشهر|شهور|سنه)/,
    /خلال\s+(اسبوع|شهر|شهرين|اسبوعين|يومين|سنه|ثلاثه اشهر|ستو? اشهر)/,
    /(نهايه|بنهايه)\s+(الربع|الشهر|العام|السنه|الاسبوع)\s*(الاول|الثاني|الثالث|الرابع|الحالي|القادم)?/,
  ];
  for (const p of patterns) {
    const m = p.exec(n);
    if (m) return m[0].trim();
  }
  return undefined;
}

export function extractOwner(raw: string): string | undefined {
  const m =
    /(?:مدير(?:ه|يه)?|مديريه|دائره|وحده|قسم|شعبه|لجنه|امين عام|رئيس(?:ه)?|مدقق داخلي|الشؤون (?:الماليه|الاداريه|القانونيه)|المالي)\s*(?:ال)?[\u0621-\u064A]*(?:\s+[\u0621-\u064A]+){0,2}/.exec(
      normalizeText(raw),
    );
  return m ? m[0].trim() : undefined;
}

/** أعداد الحالات التي يذكرها الرد صراحة («3 حالات»). */
export function extractCaseCounts(raw: string): number[] {
  const out: number[] = [];
  for (const m of normalizeText(raw).matchAll(
    /(\d{1,5})\s*(?:حاله|حالات|مخالفه|مخالفات|سجل|سجلات|قيد|قيود|موظف|موظفين|معامله|معاملات)/g,
  )) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/* ------------------------------ التحليل المحلي ------------------------------ */

const MIN_LEN = 20;

function classifyStance(n: string): Stance {
  const reject = countAny(n, REJECT);
  const accept = countAny(n, ACCEPT);
  const partial = hasAny(n, PARTIAL_MARK);
  const acts = hasAny(n, DONE) || hasAny(n, PROMISE);
  if (reject && accept) return "partial";
  if (reject) return partial && acts ? "partial" : "rejects";
  if (accept) return partial ? "partial" : "accepts";
  if (acts) return "action_only";
  return "unclear";
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** يقارن رد الجهة بالملاحظة ويقترح رأياً. دالة نقية: نفس المدخل ينتج نفس المخرج. */
export function analyzeResponse(
  o: Pick<Observation, "test" | "condition" | "recommendation" | "count" | "cause">,
  response: string,
): ResponseAnalysis {
  const text = String(response ?? "").trim();
  const n = normalizeText(text);
  const reasons: string[] = [];
  const gaps: string[] = [];

  const commitments: Commitments = {
    date: extractDate(text),
    owner: extractOwner(text),
    hasEvidence: hasAny(n, EVIDENCE),
    done: hasAny(n, DONE),
    promised: hasAny(n, PROMISE),
  };

  if (n.length < MIN_LEN) {
    return {
      stance: "unclear",
      verdict: "insufficient",
      opinion:
        "الرد قصير أو فارغ ولا يمكن مقارنته بالملاحظة. يُطلب من الجهة رد مفصّل يتناول الحالة المرصودة والتوصية.",
      followUp: `يُطلب من الجهة تقديم رد مفصّل على ملاحظة «${o.test}» يوضح موقفها من الحالة المرصودة والإجراء المتخذ أو المزمع اتخاذه مع المستندات الداعمة.`,
      reasons: ["نص الرد أقصر من أن يُقارَن بالملاحظة"],
      gaps: ["لم يتناول الرد الحالة ولا التوصية"],
      coverage: 0,
      commitments,
      source: "rules",
    };
  }

  const stance = classifyStance(n);

  // تغطية التوصية: نسبة كلماتها المفتاحية الواردة في الرد
  const recPairs = keywordPairs(o.recommendation);
  const respKw = keywords(text);
  const coverage = recPairs.length
    ? countHits(
        recPairs.map((p) => p.stem),
        respKw,
      ) / recPairs.length
    : 0;
  // صلة الرد بموضوع الملاحظة (العنوان والحالة)
  // الصلة تُقاس بالعنوان وحده (دقيق) وبالعنوان مع الحالة (أوسع)، ويؤخذ الأعلى: الحالة الطويلة لا تخفف صلة رد دقيق
  const titleKw = keywords(o.test);
  const topicKw = keywords(`${o.test} ${o.condition}`);
  const topical = Math.max(
    titleKw.length ? countHits(titleKw, respKw) / titleKw.length : 0,
    topicKw.length ? countHits(topicKw, respKw) / topicKw.length : 0,
  );

  // مقارنة عدد الحالات
  const counts = extractCaseCounts(text);
  const mismatched = counts.filter((c) => o.count > 0 && c !== o.count);
  if (mismatched.length && !counts.includes(o.count)) {
    reasons.push(`يذكر الرد ${mismatched.join(" و")} حالة بينما رصدت الملاحظة ${o.count} حالة`);
    gaps.push("عدد الحالات الوارد في الرد لا يطابق ما رُصد: تلزم مطابقته بالكشوفات");
  }

  if (topical < 0.12 && coverage < 0.12 && stance !== "rejects") {
    reasons.push("الرد لا يتناول موضوع الملاحظة ولا عناصر التوصية");
    gaps.push("لم يرد في الرد ما يعالج الحالة المرصودة أو يقابل التوصية");
  }

  // ما لم يعالجه الرد من عناصر التوصية
  const missing = recPairs.filter((p) => !respKw.some((h) => sameStem(p.stem, h))).slice(0, 6);
  if (recPairs.length && coverage < 0.5)
    gaps.push(`لم يقابل الرد عناصر من التوصية، منها: ${missing.map((p) => p.word).join("، ")}`);

  const justifyOnly =
    hasAny(n, JUSTIFY) && !commitments.done && !commitments.promised && stance !== "accepts";
  const noPlan = commitments.promised && !commitments.date && !commitments.owner;

  let verdict: Verdict;
  switch (stance) {
    case "rejects":
      if (commitments.hasEvidence) {
        verdict = "insufficient";
        reasons.push("تعترض الجهة وتستند إلى مستند: لا يُحسم الاعتراض إلا بفحص المستند");
        gaps.push("فحص المستند المذكور ومطابقته بالحالات المرصودة");
      } else {
        verdict = "not_accepted";
        reasons.push("اعتراض دون مستند أو دليل مرفق يدحض الحالة المرصودة");
        gaps.push("لم تُرفق الجهة ما يثبت صحة موقفها");
      }
      break;
    case "accepts":
    case "action_only": {
      if (justifyOnly) {
        verdict = "not_accepted";
        reasons.push("الرد تبريري ولا يتضمن إجراءً تصحيحياً");
      } else if (commitments.done && commitments.hasEvidence && coverage >= 0.35) {
        verdict = "accepted";
        reasons.push("إجراء منفَّذ ومسنَد بمستند ويقابل أغلب عناصر التوصية");
      } else if (commitments.done && !commitments.hasEvidence) {
        verdict = "partially_accepted";
        reasons.push("إجراء منفَّذ لكن دون مستند يثبته");
        gaps.push("لم يُرفق ما يثبت تنفيذ الإجراء");
      } else if (noPlan || (commitments.promised && !commitments.done)) {
        verdict = "partially_accepted";
        reasons.push(
          noPlan ? "وعد بالمعالجة دون موعد ولا طرف مسؤول" : "وعد بالمعالجة لم يُنفَّذ بعد",
        );
        if (!commitments.date) gaps.push("لم يُحدَّد موعد تنفيذ");
        if (!commitments.owner) gaps.push("لم يُحدَّد الطرف المسؤول");
      } else {
        verdict = coverage >= 0.35 ? "partially_accepted" : "insufficient";
        reasons.push("إقرار أو إجراء لا يتضح منه تنفيذ فعلي كامل");
      }
      if (stance === "action_only") reasons.push("لم تُقرّ الجهة صراحةً بالملاحظة");
      break;
    }
    case "partial":
      verdict = "partially_accepted";
      reasons.push("قبلت الجهة جزءاً من الملاحظة واعترضت أو استثنت جزءاً");
      gaps.push("يلزم تحديد الجزء المعترَض عليه ومستنده");
      break;
    default:
      verdict = justifyOnly ? "not_accepted" : "insufficient";
      reasons.push(justifyOnly ? "الرد تبريري ولا يتضمن إجراءً" : "لم يتضح موقف الجهة من الملاحظة");
  }
  if (!reasons.length) reasons.push("لم تظهر في الرد إشارات كافية");
  if (coverage > 0) reasons.push(`تغطية الرد لعناصر التوصية: ${pct(coverage)}`);

  // رد لا علاقة له بالملاحظة لا يُقبل ولو ورد فيه وعد
  if (topical < 0.12 && coverage < 0.12 && verdict !== "not_accepted" && stance !== "rejects")
    verdict = "insufficient";
  // تعارض في عدد الحالات يمنع وصف الرد بالكافي
  if (verdict === "accepted" && gaps.length) verdict = "partially_accepted";

  const { opinion, followUp } = compose(o, verdict, stance, commitments, gaps);
  return {
    stance,
    verdict,
    opinion,
    followUp,
    reasons,
    gaps,
    coverage,
    commitments,
    source: "rules",
  };
}

function compose(
  o: Pick<Observation, "test" | "count">,
  verdict: Verdict,
  stance: Stance,
  c: Commitments,
  gaps: string[],
): { opinion: string; followUp: string } {
  const gapText = gaps.length ? ` ويؤخذ عليه: ${gaps.join("؛ ")}.` : "";
  const planText = [
    c.date ? `الموعد المذكور: ${c.date}` : "",
    c.owner ? `الطرف المسؤول: ${c.owner}` : "",
  ]
    .filter(Boolean)
    .join("، ");
  switch (verdict) {
    case "accepted":
      return {
        opinion: `أقرّت الجهة بالملاحظة وأوردت إجراءً منفَّذاً مسنَداً بمستند، ويقابل الرد أغلب عناصر التوصية. يُقترح قبول الرد مبدئياً مع التحقق ميدانياً من المستندات المرفقة وإبقاء الملاحظة قيد المتابعة حتى التثبت من التنفيذ.`,
        followUp: `اطّلع الديوان على رد الجهة بشأن «${o.test}» ويُثمّن الإجراء المتخذ، وسيتحقق من المستندات المرفقة وتبقى الملاحظة قيد المتابعة حتى التثبت من التنفيذ الفعلي.`,
      };
    case "partially_accepted":
      return {
        opinion: `يتضمن الرد ${stance === "partial" ? "قبولاً جزئياً للملاحظة" : "إقراراً أو إجراءً"} لكنه لا يعالجها كاملةً.${gapText}${planText ? ` (${planText})` : ""} يُقترح اعتبار الرد كافياً جزئياً ومطالبة الجهة باستكمال ما نقص.`,
        followUp: `يأخذ الديوان علماً بما ورد في رد الجهة بشأن «${o.test}»، ويرى أنه لا يعالج الملاحظة كاملةً${gaps.length ? ` (${gaps.join("؛ ")})` : ""}. يُطلب من الجهة استكمال المعالجة وتحديد موعد تنفيذ وطرف مسؤول ورفع ما يثبت التنفيذ، وتبقى الملاحظة قائمة.`,
      };
    case "not_accepted":
      return {
        opinion: `الرد ${stance === "rejects" ? "اعتراض دون مستند يدحض الحالة المرصودة" : "تبريري ولا يتضمن إجراءً تصحيحياً"}.${gapText} يُقترح عدم قبول الرد وبقاء الملاحظة قائمة.`,
        followUp: `لم يقدّم رد الجهة ما يعالج الملاحظة «${o.test}»${stance === "rejects" ? " ولم يرفق ما يثبت صحة اعتراضها" : ""}؛ لذا يبقى الديوان على ملاحظته ويُطلب من الجهة تصويب الحالات المرصودة (${o.count}) وتقديم خطة عمل بموعد وطرف مسؤول.`,
      };
    default:
      return {
        opinion: `لا يكفي نص الرد للحكم عليه.${gapText} يُقترح التحقق من المستندات والحالات المشار إليها قبل إبداء الرأي النهائي.`,
        followUp: `يتحقق الديوان مما ورد في رد الجهة بشأن «${o.test}» ومن مستنداته، وسيُعدَّ التعقيب النهائي بعد ذلك.`,
      };
  }
}

/* ------------------------------ فصل ردود مجمّعة ------------------------------ */

export interface BulkMatch {
  id: string;
  /** رقم الملاحظة كما ورد في الملف، إن وُجد */
  number?: number | undefined;
  response: string;
  /** كيف طُوبق الرد بالملاحظة */
  by: "title" | "number";
}

/**
 * يفصل ملف ردود واحد (رد على عدة ملاحظات) إلى ردود لكل ملاحظة.
 * الفصل بالترقيم في أول السطر («1.» أو «1-» أو «1)») ثم المطابقة بتشابه العنوان أولاً وبالرقم ثانياً.
 * نتيجة المطابقة تُعرض للمدقق ليصحّحها قبل الحفظ.
 */
export function splitBulkResponses(
  text: string,
  list: ReadonlyArray<Pick<Observation, "id" | "test">>,
): BulkMatch[] {
  const lines = String(text ?? "")
    .replace(/\r/g, "")
    .split("\n");
  const chunks: { number: number; lines: string[] }[] = [];
  for (const line of lines) {
    const m = /^\s*(?:ملاحظه|ملاحظة)?\s*(\d{1,3}|[٠-٩]{1,3})\s*[.)\-–:ـ]\s*(.*)$/.exec(
      line.normalize("NFKC"),
    );
    if (m) {
      chunks.push({ number: Number(normalizeText(m[1] ?? "")), lines: [m[2] ?? ""] });
    } else if (chunks.length) {
      chunks[chunks.length - 1]?.lines.push(line);
    }
  }
  const used = new Set<string>();
  const out: BulkMatch[] = [];
  for (const ch of chunks) {
    const body = ch.lines.join("\n").trim();
    if (body.length < 3) continue;
    // 1) تشابه العنوان مع أول سطر
    const head = keywords(ch.lines[0] ?? "");
    let best: { id: string; s: number } | undefined;
    for (const o of list) {
      if (used.has(o.id)) continue;
      const t = keywords(o.test);
      if (!t.length || !head.length) continue;
      const s = t.filter((k) => head.includes(k)).length / t.length;
      if (s >= 0.6 && (!best || s > best.s)) best = { id: o.id, s };
    }
    if (best) {
      used.add(best.id);
      out.push({ id: best.id, number: ch.number, response: body, by: "title" });
      continue;
    }
    // 2) الرقم
    const byNum = list[ch.number - 1];
    if (byNum && !used.has(byNum.id)) {
      used.add(byNum.id);
      out.push({ id: byNum.id, number: ch.number, response: body, by: "number" });
    }
  }
  return out;
}

/* ------------------------------ التخزين ------------------------------ */

export const RESPONSES_KEY = "rasd-auditee-responses";
export const RESPONSES_EVENT = "rasd-auditee-changed";

export type RecordMap = Record<string, AuditeeRecord>;

const isRecord = (v: unknown): v is AuditeeRecord =>
  !!v &&
  typeof v === "object" &&
  typeof (v as AuditeeRecord).response === "string" &&
  typeof (v as AuditeeRecord).decision === "string";

export function loadResponses(): RecordMap {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RESPONSES_KEY) ?? "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: RecordMap = {};
    for (const [k, r] of Object.entries(v as Record<string, unknown>)) if (isRecord(r)) out[k] = r;
    return out;
  } catch {
    return {};
  }
}

export function saveResponses(map: RecordMap): void {
  try {
    localStorage.setItem(RESPONSES_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(RESPONSES_EVENT));
  } catch {
    /* storage unavailable */
  }
}

export function clearResponses(): void {
  try {
    localStorage.removeItem(RESPONSES_KEY);
    window.dispatchEvent(new Event(RESPONSES_EVENT));
  } catch {
    /* storage unavailable */
  }
}

/** يحفظ نص الرد؛ إن تغيّر النص يسقط التحليل والقرار السابقان (رأي على نص قديم لا يبقى معتمداً). */
export function setResponseText(
  map: RecordMap,
  id: string,
  response: string,
  now = new Date(),
): RecordMap {
  const text = response.trim();
  const next = { ...map };
  const prev = next[id];
  if (!text) {
    delete next[id];
    return next;
  }
  if (prev && prev.response === text) return map;
  next[id] = { response: text, receivedAt: now.toISOString(), decision: "pending" };
  return next;
}

export function withAnalysis(map: RecordMap, id: string, analysis: ResponseAnalysis): RecordMap {
  const prev = map[id];
  if (!prev) return map;
  return {
    ...map,
    [id]: {
      ...prev,
      analysis,
      decision: "pending",
      finalOpinion: undefined,
      decidedAt: undefined,
      actionDate: prev.actionDate ?? analysis.commitments.date,
      actionOwner: prev.actionOwner ?? analysis.commitments.owner,
    },
  };
}

/** قرار المدقق: اعتماد الرأي كما هو، أو تعديله، أو رفضه (لا يدخل التقرير). */
export function decide(
  map: RecordMap,
  id: string,
  decision: Exclude<Decision, "pending">,
  patch: { opinion?: string; actionDate?: string; actionOwner?: string } = {},
  now = new Date(),
): RecordMap {
  const prev = map[id];
  if (!prev?.analysis) return map;
  const opinion = (patch.opinion ?? prev.analysis.followUp).trim();
  const approvedLike = decision === "approved" || decision === "edited";
  if (approvedLike && !opinion) return map;
  const edited = approvedLike && opinion !== prev.analysis.followUp.trim();
  return {
    ...map,
    [id]: {
      ...prev,
      decision: approvedLike ? (edited ? "edited" : "approved") : "rejected",
      finalOpinion: approvedLike ? opinion : undefined,
      actionDate: (patch.actionDate ?? prev.actionDate)?.trim() || undefined,
      actionOwner: (patch.actionOwner ?? prev.actionOwner)?.trim() || undefined,
      decidedAt: now.toISOString(),
    },
  };
}

/* ------------------------------ ربط بالتقرير ------------------------------ */

/** ما يُدرج في التقرير: نص رد الجهة متى سُجّل، والتعقيب وخطة العمل بعد اعتماد المدقق فقط. */
export function reportBlock(r: AuditeeRecord | undefined): AuditeeReportBlock | undefined {
  if (!r || r.demo || !r.response.trim()) return undefined;
  const approved = r.decision === "approved" || r.decision === "edited";
  return {
    response: r.response.trim(),
    opinion: approved ? r.finalOpinion : undefined,
    actionDate: approved ? r.actionDate : undefined,
    actionOwner: approved ? r.actionOwner : undefined,
  };
}

/** يُلحق ردود الجهة بالملاحظات (لا يغيّر شيئاً لملاحظة لا رد لها). */
export function attachResponses<T extends Observation>(
  list: T[],
  map: RecordMap = loadResponses(),
): T[] {
  return list.map((o) => {
    const block = reportBlock(map[o.id]);
    return block ? { ...o, auditee: block } : o;
  });
}

export interface ResponsesSummary {
  total: number;
  withResponse: number;
  analyzed: number;
  approved: number;
  pending: number;
}

export function summarizeResponses(
  list: ReadonlyArray<Pick<Observation, "id">>,
  map: RecordMap,
): ResponsesSummary {
  const recs = list.map((o) => map[o.id]).filter((r): r is AuditeeRecord => !!r);
  return {
    total: list.length,
    withResponse: recs.length,
    analyzed: recs.filter((r) => r.analysis).length,
    approved: recs.filter((r) => r.decision === "approved" || r.decision === "edited").length,
    pending: recs.filter((r) => r.analysis && r.decision === "pending").length,
  };
}

/* ------------------------------ رأي ثانٍ بالذكاء الاصطناعي ------------------------------ */

const VERDICT_KEYS = Object.keys(VERDICT_LABELS);
const isVerdict = (v: unknown): v is Verdict => typeof v === "string" && VERDICT_KEYS.includes(v);
const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export function buildAiPrompt(
  o: Pick<Observation, "test" | "condition" | "recommendation" | "count">,
  response: string,
  local: ResponseAnalysis,
): string {
  return [
    "أنت مساعد لمدقق رقابي. قارن رد الجهة بالملاحظة الرقابية وأبدِ رأياً مهنياً موجزاً. الرأي استشاري يراجعه المدقق.",
    "",
    `عنوان الملاحظة: ${o.test.slice(0, 200)}`,
    `الحالة المرصودة: ${o.condition.slice(0, 1200)}`,
    `عدد الحالات: ${o.count}`,
    `التوصية: ${o.recommendation.slice(0, 600)}`,
    `رد إدارة الجهة: ${response.slice(0, 3000)}`,
    `الحكم المحلي بالقواعد (للمقارنة فقط): ${local.verdict}`,
    "",
    "قواعد: لا تخترع وقائع ولا مستندات غير واردة في النص، ولا تذكر رقم مادة أو اسم نظام لم يرد في المدخلات.",
    "اعتراض الجهة بمستند لا يُحسم إلا بفحص المستند (insufficient). لا تقبل وعداً مجرداً بلا موعد ومسؤول.",
    `verdict من هذه القيم فقط: ${VERDICT_KEYS.join(" | ")}`,
    "أجب بكائن JSON واحد فقط بلا أي نص قبله أو بعده:",
    '{"verdict":"...","opinion":"رأي المحاكي في فقرة","followUp":"تعقيب الديوان المقترح","gaps":["ما لم يعالجه الرد"]}',
  ].join("\n");
}

const RANK: Record<Verdict, number> = {
  not_accepted: 0,
  insufficient: 1,
  partially_accepted: 2,
  accepted: 3,
};

/** يتحقق من رد النموذج؛ لا يرفع الحكم فوق الحكم المحلي بأكثر من درجة (الحكم النهائي للمدقق). */
export function parseAiAnalysis(
  raw: string,
  local: ResponseAnalysis,
): ResponseAnalysis | undefined {
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(a, b + 1));
  } catch {
    return undefined;
  }
  if (!data || typeof data !== "object") return undefined;
  const d = data as { verdict?: unknown; opinion?: unknown; followUp?: unknown; gaps?: unknown };
  if (!isVerdict(d.verdict)) return undefined;
  const opinion = str(d.opinion, 1200);
  const followUp = str(d.followUp, 900);
  if (opinion.length < 15 || followUp.length < 15) return undefined;
  const verdict =
    RANK[d.verdict] > RANK[local.verdict] + 1
      ? (Object.keys(RANK).find((k) => RANK[k as Verdict] === RANK[local.verdict] + 1) as Verdict)
      : d.verdict;
  const gaps = Array.isArray(d.gaps)
    ? d.gaps
        .map((g) => str(g, 300))
        .filter(Boolean)
        .slice(0, 6)
    : local.gaps;
  return {
    ...local,
    verdict,
    opinion,
    followUp,
    gaps: gaps.length ? gaps : local.gaps,
    reasons: [
      `رأي ثانٍ من النموذج الذكي ${d.verdict === local.verdict ? "يوافق" : "يخالف"} الحكم المحلي (${VERDICT_LABELS[local.verdict]}) ويلزم مراجعته`,
      ...local.reasons,
    ],
    source: "ai",
  };
}

export interface AiOptions {
  signal?: AbortSignal | undefined;
  fetchImpl?: typeof fetch | undefined;
}

export async function requestAiAnalysis(
  o: Pick<Observation, "test" | "condition" | "recommendation" | "count">,
  response: string,
  local: ResponseAnalysis,
  opts: AiOptions = {},
): Promise<ResponseAnalysis> {
  const f = opts.fetchImpl ?? fetch;
  const res = await f("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(opts.signal ? { signal: opts.signal } : {}),
    body: JSON.stringify({
      messages: [{ role: "user", content: buildAiPrompt(o, response, local) }],
      mode: "analyze",
    }),
  });
  if (!res.ok) {
    let msg = "تعذّر الحصول على رأي الذكاء الاصطناعي.";
    try {
      const j: unknown = await res.json();
      const e = (j as { error?: unknown } | null)?.error;
      if (typeof e === "string" && e) msg = e;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const raw = await res.text();
  // الخادم قد يرد نصاً مباشراً أو كائناً فيه حقل نص
  let content = raw;
  try {
    const j: unknown = JSON.parse(raw);
    const c = j as { content?: unknown; text?: unknown; reply?: unknown } | null;
    const t = c?.content ?? c?.text ?? c?.reply;
    if (typeof t === "string") content = t;
  } catch {
    /* plain text */
  }
  const parsed = parseAiAnalysis(content, local);
  if (!parsed) throw new Error("رد النموذج غير مفهوم؛ بقي الرأي المحلي كما هو.");
  return parsed;
}

/* ------------------------------ ردود تجريبية ------------------------------ */

/** رد تجريبي يتنوع بين القبول المسنَد والوعد والاعتراض والتبرير، لتجربة المحاكي. */
export function sampleResponse(
  o: Pick<Observation, "test" | "recommendation">,
  index: number,
): string {
  switch (index % 4) {
    case 0:
      return `نوافق على الملاحظة بشأن «${o.test}». تم تنفيذ التوصية: ${o.recommendation} وذلك بموجب القرار رقم 15 المرفق.`;
    case 1:
      return `نوافق على الملاحظة بشأن «${o.test}» وسيتم تنفيذ التوصية قريباً.`;
    case 2:
      return `لا نوافق على الملاحظة، فلا يوجد مخالفة في «${o.test}» لدى الجهة.`;
    default:
      return `حدث ذلك بسبب نقص الكوادر وضغط العمل، ونعمل على المعالجة.`;
  }
}

/** يضيف رداً تجريبياً لكل ملاحظة لا رد لها (ولا يمس ردوداً حقيقية). */
export function addSampleResponses(
  map: RecordMap,
  list: ReadonlyArray<Pick<Observation, "id" | "test" | "recommendation">>,
  now = new Date(),
): RecordMap {
  const next = { ...map };
  list.forEach((o, i) => {
    if (next[o.id]) return;
    next[o.id] = {
      response: sampleResponse(o, i),
      receivedAt: now.toISOString(),
      decision: "pending",
      demo: true,
    };
  });
  return next;
}

export function clearSampleResponses(map: RecordMap): RecordMap {
  return Object.fromEntries(Object.entries(map).filter(([, r]) => !r.demo));
}
