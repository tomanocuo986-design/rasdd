// طبقة النموذج لمراجعة المستندات (/api/doc-review): طلب واحد غير متدفق يعيد نص النموذج الخام.
// الموجّه وقائمة التحقق يُبنيان على الخادم (rasd/doc-review.js)، فلا يستطيع المتصفح تغيير التعليمات ولا إضافة بنود.
// التحقق من الاقتباسات والدمج يجريان في المتصفح (reviewDocument) على النص الأصلي الذي لا يغادر المتصفح إلا مقاطع.
import type { Provider } from "./llm.ts";

export const MAX_CHUNK_CHARS = 7000;
export const MAX_TOKENS = 1800;

export function completionBody(provider: Provider, system: string, user: string, maxTokens = MAX_TOKENS): string {
  if (provider.kind === "openai")
    return JSON.stringify({
      model: provider.model,
      stream: false,
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0 },
  });
}

/** نص رد النموذج من استجابة غير متدفقة؛ "" إن لم يوجد. */
export function completionText(kind: Provider["kind"], data: unknown): string {
  const d = data as any;
  if (kind === "openai") {
    const c = d?.choices?.[0]?.message?.content;
    return typeof c === "string" ? c : "";
  }
  return (d?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: unknown }) => (typeof p?.text === "string" ? p.text : ""))
    .join("");
}

/**
 * هل المزود خارج شبكة الجهة؟ gemini دائماً خارجي. المتوافق مع OpenAI يُعدّ محلياً فقط إن كان مضيفه localhost أو عنواناً
 * خاصاً (10.* / 172.16–31.* / 192.168.* / 127.*) أو اسماً بلا نقطة (خدمة docker مثل ollama) أو بلاحقة .local/.internal/.lan.
 * أي شيء آخر (مثل api.openai.com) يُعامل خارجياً. هذا تقدير من العنوان لا ضمان؛ المسؤول يقرر عبر DOC_REVIEW_ALLOW_EXTERNAL.
 */
export function isExternalProvider(provider: Provider): boolean {
  if (provider.kind === "gemini") return true;
  let host = "";
  try {
    host = new URL(provider.baseUrl).hostname.toLowerCase();
  } catch {
    return true;
  }
  host = host.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || !host.includes(".")) return false;
  if (/\.(local|internal|lan|svc|cluster\.local)$/.test(host)) return false;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return !(a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
  }
  return true;
}

/** مستندات العطاء قد تحوي بيانات حساسة: المزود الخارجي ممنوع ما لم يضبط المسؤول DOC_REVIEW_ALLOW_EXTERNAL=1. */
export function externalAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return (env["DOC_REVIEW_ALLOW_EXTERNAL"] ?? "").trim() === "1";
}
