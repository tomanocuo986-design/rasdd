/**
 * تحليل السبب الجذري بالذكاء الاصطناعي (اختياري، بزر يضغطه المدقق).
 * يمر عبر /api/chat فيخضع لبوابة السرية والحجب وصلاحية المساعد ولحدّ الطلبات كبقية استعمالات النموذج.
 * أي فشل (لا مزود مفعّل، جلسة منتهية، رد غير مفهوم) يرمي خطأً برسالة عربية ويبقى الاقتراح المحلي كما هو.
 */
import {
  CONFIDENCE_LABELS,
  ROOT_CAUSE_LABELS,
  isRootCauseCategory,
  type Confidence,
  type RootCause,
  type RootCauseInput,
} from "./root-cause";

const CATEGORY_KEYS = Object.keys(ROOT_CAUSE_LABELS).filter((k) => k !== "undetermined");

export function buildRootCausePrompt(input: RootCauseInput, local: RootCause): string {
  const condition = (input.condition ?? "").trim().slice(0, 1500);
  return [
    "حلّل السبب الجذري للملاحظة الرقابية التالية. المطلوب سبب جذري يفسّر لماذا حدثت الحالة، لا وصفاً لها ولا توصية.",
    "",
    `عنوان الملاحظة: ${input.test.trim().slice(0, 200)}`,
    condition ? `وصف الحالة: ${condition}` : "",
    `عدد الحالات: ${input.count ?? 1}`,
    `وردت في تقارير سابقة: ${(input.repeated ?? 0) > 0 ? "نعم" : "لا"}`,
    `التصنيف المحلي المقترح (للمقارنة فقط): ${local.category} — ${local.label}`,
    "",
    `اختر category من هذه القيم فقط: ${CATEGORY_KEYS.join(" | ")} (أو undetermined إن لم تكفِ المعطيات).`,
    "لا تفترض وقائع غير واردة في النص، ولا تنسب تحايلاً لشخص أو جهة؛ المؤشرات تُصاغ على أنها تستوجب التحقق.",
    "أجب بكائن JSON واحد فقط بلا أي نص قبله أو بعده، بالشكل:",
    '{"category":"...","confidence":"high|medium|low","statement":"جملة أو جملتان بالعربية للسبب الجذري","whys":["لماذا 1","لماذا 2","لماذا 3"],"fix":"المعالجة التي تزيل السبب"}',
  ]
    .filter(Boolean)
    .join("\n");
}

const isConfidence = (v: unknown): v is Confidence => v === "high" || v === "medium" || v === "low";
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** يستخرج أول كائن JSON من رد النموذج ويتحقق منه؛ يعيد undefined إن لم يصلح. */
export function parseAiRootCause(raw: string, local: RootCause): RootCause | undefined {
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
  const o = data as { category?: unknown; confidence?: unknown; statement?: unknown; whys?: unknown; fix?: unknown };
  const category = o.category;
  if (!isRootCauseCategory(category)) return undefined;
  const statement = str(o.statement, 700);
  if (statement.length < 12) return undefined;
  const whys = Array.isArray(o.whys) ? o.whys.map((w) => str(w, 300)).filter(Boolean).slice(0, 5) : [];
  const confidence: Confidence = isConfidence(o.confidence) ? o.confidence : "medium";
  return {
    category,
    label: ROOT_CAUSE_LABELS[category],
    // النموذج لا يرفع الثقة فوق «متوسطة»: الحكم النهائي للمدقق
    confidence: confidence === "high" ? "medium" : confidence,
    statement,
    whys: whys.length ? whys : local.whys,
    fix: str(o.fix, 500) || local.fix,
    evidence: [
      `استنتجه النموذج الذكي من نص الملاحظة (${CONFIDENCE_LABELS[confidence]} بحسب النموذج) ويلزم مراجعته`,
      ...(category === local.category ? ["يوافق التصنيف المحلي بالقواعد"] : [`يخالف التصنيف المحلي (${local.label})`]),
    ],
    source: "ai",
  };
}

export interface AiOptions {
  signal?: AbortSignal | undefined;
  fetchImpl?: typeof fetch | undefined;
}

export async function requestAiRootCause(input: RootCauseInput, local: RootCause, opts: AiOptions = {}): Promise<RootCause> {
  const f = opts.fetchImpl ?? fetch;
  const res = await f("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(opts.signal ? { signal: opts.signal } : {}),
    body: JSON.stringify({ messages: [{ role: "user", content: buildRootCausePrompt(input, local) }], mode: "analyze" }),
  });
  if (!res.ok) {
    let msg = "تعذّر الحصول على تحليل الذكاء الاصطناعي.";
    try {
      const j: unknown = await res.json();
      if (j && typeof j === "object" && typeof (j as { error?: unknown }).error === "string") msg = (j as { error: string }).error;
    } catch {
      /* body is not JSON */
    }
    throw new Error(msg);
  }
  const parsed = parseAiRootCause(await res.text(), local);
  if (!parsed) throw new Error("رد الذكاء الاصطناعي غير مفهوم. أعد المحاولة أو اعتمد الاقتراح المحلي.");
  return parsed;
}
