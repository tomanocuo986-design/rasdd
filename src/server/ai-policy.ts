// سياسة الذكاء الاصطناعي لسرية بيانات التدقيق (ديوان المحاسبة): بوابة واحدة تمرّ بها كل مسارات النموذج (المحادثة، الوكيل).
//
// المبادئ:
//  1) النموذج المحلي داخل شبكة الجهة (LLM_BASE_URL → Ollama / vLLM …) هو الخيار الموصى به: لا تغادر البيانات الشبكة.
//  2) المزود الخارجي (Gemini أو أي عنوان عام) ممنوع افتراضياً؛ يُفعَّل بقرار إداري موثّق: AI_ALLOW_EXTERNAL=1
//     (أو DOC_REVIEW_ALLOW_EXTERNAL=1 للتوافق مع الإعداد السابق).
//  3) عند استعمال مزود خارجي يُحجب كل نص يُرسل إليه (رسائل + سياق + نتائج أدوات الوكيل) قبل مغادرة الخادم:
//     أرقام وطنية، هواتف، IBAN، بريد، أسماء بلقب، ومصطلحات المنظومة AI_REDACT_TERMS (أسماء جهات/موردين/موظفين).
//     AI_REDACT_ALWAYS=1 يطبّق الحجب على النموذج المحلي أيضاً.
//  4) السجل المسلسل يحفظ حدوث الاستخدام فقط (الوضع، نوع المزود، عدد المحجوب)، ولا يحفظ نصاً ولا بيانات.
//
// حدّ معروف: الحجب قواعد لا نموذج، فاسم بلا لقب ولا وارد في AI_REDACT_TERMS لا يُحجب. لذلك يبقى المحلي هو الأصل.
import type { Provider } from "./llm.ts";
import { providerFromEnv } from "./llm.ts";
import { isExternalProvider } from "./doc-review.ts";
import { redactDocument } from "../rasd/redact.js";

type Env = Record<string, string | undefined>;

export const BLOCKED_MESSAGE =
  "المزود الخارجي للذكاء الاصطناعي غير مسموح في هذه المنصة افتراضياً حفاظاً على سرية بيانات التدقيق. " +
  "استخدم نموذجاً محلياً داخل الشبكة (LLM_BASE_URL)، أو يفعّل مدير النظام AI_ALLOW_EXTERNAL=1 بقرار موثّق.";

export const externalAllowed = (env: Env = process.env): boolean =>
  env["AI_ALLOW_EXTERNAL"] === "1" || env["DOC_REVIEW_ALLOW_EXTERNAL"] === "1";

export type Gate = { ok: true; external: boolean } | { ok: false; status: 403; message: string; external: true };

export function gateProvider(provider: Provider, env: Env = process.env): Gate {
  const external = isExternalProvider(provider);
  if (external && !externalAllowed(env)) return { ok: false, status: 403, message: BLOCKED_MESSAGE, external: true };
  return { ok: true, external };
}

export const redactTerms = (env: Env = process.env): string[] =>
  (env["AI_REDACT_TERMS"] ?? "")
    .split(/[,،\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

const SEP = "\u0001§§\u0001"; // فاصل لا يطابقه أي نمط حجب، فتبقى الرموز متسقة بين الرسائل والسياق

export type Sanitized<M> = { messages: M[]; context: string | undefined; total: number; counts: Record<string, number> };

/** يحجب محتوى الرسائل والسياق دفعة واحدة (رمز واحد لكل قيمة عبر كل الأجزاء). المقاطع النظامية (القانونية) لا تُحجب. */
export function sanitizeForAI<M extends { content: string }>(
  messages: M[],
  context: string | undefined,
  { external, env = process.env }: { external: boolean; env?: Env },
): Sanitized<M> {
  const redact = external || env["AI_REDACT_ALWAYS"] === "1";
  if (!redact) return { messages, context, total: 0, counts: {} };
  const parts = [...messages.map((m) => m.content), context ?? ""];
  const r = redactDocument(parts.join(SEP), { extraTerms: redactTerms(env) });
  const out = String(r.text).split(SEP);
  return {
    messages: messages.map((m, i) => ({ ...m, content: out[i] ?? "" }) as M),
    context: context === undefined ? undefined : (out[messages.length] ?? ""),
    total: r.total,
    counts: r.counts,
  };
}

/** نص السجل: حدوث الاستخدام فقط، لا محتوى. */
export const aiLogDetail = (base: string, external: boolean, redacted: number) =>
  `${base} provider=${external ? "external" : "local"} redacted=${redacted}`;

/** حالة الذكاء الاصطناعي للعرض في الواجهة (بلا أسرار ولا عناوين). */
export type AiStatus = "off" | "local" | "external-blocked" | "external";
export function aiStatus(env: Env = process.env): AiStatus {
  const p = providerFromEnv(env);
  if (!p) return "off";
  if (!isExternalProvider(p)) return "local";
  return externalAllowed(env) ? "external" : "external-blocked";
}
