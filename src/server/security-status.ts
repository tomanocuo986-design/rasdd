import { externalAllowed, redactTerms } from "./ai-policy.ts";
import { isExternalProvider } from "./doc-review.ts";
import net from "node:net";
import {
  DEFAULT_ALLOWED_HOSTS,
  allowedHosts,
  isPrivateAddress,
  legalFetchEnabled,
} from "./legal-fetch.ts";
import { loadCatalog, libraryEnabled } from "./legal-library.ts";
import { providerFromEnv } from "./llm.ts";

type Env = Record<string, string | undefined>;

export type Note = { level: "warn" | "info"; text: string };
export type SecurityStatus = {
  verdict: "ok" | "review";
  ai: {
    provider: "none" | "local" | "external";
    host?: string;
    externalAllowed: boolean;
    redactAlways: boolean;
    redactTermsCount: number;
  };
  legalLibrary: { enabled: boolean; hosts: string[]; extraHosts: string[]; items: number };
  notes: Note[];
};

const hostOf = (raw: string): string | undefined => {
  try {
    return new URL(raw).hostname;
  } catch {
    return undefined;
  }
};

/**
 * ملخص إعدادات السرية للمدير. يقرأ إعدادات التطبيق فقط ولا يعرض مفاتيح ولا نصوصاً:
 * اسم مضيف النموذج وأعداد وقيم منطقية وأسماء نطاقات عامة.
 * لا يثبت أن الشبكة مغلقة فعلاً؛ هذا يفحصه scripts/verify-egress.mjs من مضيف الخادم.
 */
export function securityStatus(env: Env = process.env): SecurityStatus {
  const provider = providerFromEnv(env);
  const kind: SecurityStatus["ai"]["provider"] = !provider
    ? "none"
    : isExternalProvider(provider)
      ? "external"
      : "local";
  const host = !provider
    ? undefined
    : provider.kind === "gemini"
      ? "generativelanguage.googleapis.com"
      : hostOf(provider.baseUrl);
  const allowExternal = externalAllowed(env);
  const redactAlways = env["AI_REDACT_ALWAYS"] === "1";
  const terms = redactTerms(env).length;
  const libOn = libraryEnabled(env) && legalFetchEnabled(env);
  const hosts = libOn ? allowedHosts(env) : [];
  const extraHosts = hosts.filter((h) => !DEFAULT_ALLOWED_HOSTS.includes(h));

  const notes: Note[] = [];
  const warn = (text: string) => notes.push({ level: "warn", text });
  const info = (text: string) => notes.push({ level: "info", text });

  if (kind === "none") info("لا يوجد مزود ذكاء اصطناعي مضبوط، فالمساعد ومراجعة المستندات معطّلان.");
  if (kind === "external" && allowExternal)
    warn("مزود الذكاء الاصطناعي خارجي ومسموح: نصوص التدقيق (بعد الحجب) تغادر الجهة.");
  if (kind === "external" && !allowExternal)
    info(
      "المزود المضبوط خارجي ومحجوب بسياسة المنصة، فلن يعمل المساعد حتى تضبط نموذجاً محلياً (LLM_BASE_URL).",
    );
  if (kind === "local" && allowExternal)
    warn("AI_ALLOW_EXTERNAL مفعّل مع أن النموذج محلي. أزله ما لم تكن تحتاجه.");
  if ((kind === "external" && allowExternal) || redactAlways) {
    if (terms === 0)
      warn("AI_REDACT_TERMS فارغ: أسماء الجهات والموردين والموظفين بلا لقب لن تُحجب.");
  }
  if (kind === "local" && !redactAlways)
    info("AI_REDACT_ALWAYS غير مفعّل: لا يُحجب النص عند النموذج المحلي. مقبول إن كان داخل شبكتك.");
  const instances = Math.max(Number(env["WEB_CONCURRENCY"]) || 1, Number(env["RASD_INSTANCES"]) || 1);
  if (instances > 1)
    warn(
      `أكثر من نسخة خادم (${instances}): حدود الطلبات والمكتبة الرسمية والجلسات المؤقتة تعيش في ذاكرة كل نسخة على حدة. شغّل نسخة واحدة أو انقلها إلى مخزن مشترك.`,
    );
  // قالب deploy/secure.env.example كان يضع أسماء مثالاً؛ تُحسب مصطلحات فعلية فيبدو الحجب مضبوطاً وهو غير ذلك.
  if (/اسم\s+(?:جهة|مورد|موظف)/.test(env["AI_REDACT_TERMS"] ?? ""))
    warn(
      "AI_REDACT_TERMS ما زال يحوي أمثلة القالب (اسم جهة/اسم مورد/اسم موظف): ضع الأسماء الحقيقية وإلا فلا يُحجب شيء فعلياً.",
    );
  const model = (env["LLM_MODEL"] ?? "").trim();
  if ((env["LLM_BASE_URL"] ?? "").trim() && (!model || model.startsWith("<")))
    warn("LLM_MODEL غير مضبوط أو ما زال نص القالب: اكتب اسم النموذج كما يظهر في خادمك.");
  if (provider && "baseUrl" in provider) {
    let u: URL | undefined;
    try {
      u = new URL(provider.baseUrl);
    } catch {
      u = undefined;
    }
    const bare = u ? u.hostname.replace(/^\[|\]$/g, "") : ""; // IPv6 يأتي بين أقواس: [::1]
    if (u && u.protocol === "http:" && net.isIP(bare) && !isPrivateAddress(bare))
      warn(
        `عنوان النموذج http إلى عنوان عام (${bare}): الاتصال غير مشفّر ويخرج من شبكتك. استعمل https أو عنواناً داخلياً.`,
      );
  }
  if (kind === "external" && allowExternal && provider?.kind === "gemini")
    warn(
      "تأكد أن مفتاح Gemini من مشروع بفوترة مفعّلة (الطبقة المدفوعة): توثيق Google ينص على أن بيانات المدفوعة لا تُستعمل لتحسين منتجاتها ولا ينص على ذلك للمجانية. الأسلم نموذج محلي.",
    );
  if (libOn) info(`المكتبة الرسمية مفعّلة: يخرج الخادم إلى هذه النطاقات فقط: ${hosts.join("، ")}.`);
  else info("المكتبة الرسمية معطّلة: لا خروج للإنترنت من مسار جلب الأنظمة.");
  if (extraHosts.length)
    warn(
      `نطاقات إضافية مسموحة عبر LEGAL_FETCH_EXTRA_HOSTS: ${extraHosts.join("، ")}. تأكد أنها مقصودة.`,
    );
  info(
    "هذا الملخص يقرأ إعدادات التطبيق ولا يثبت إغلاق الشبكة. شغّل scripts/verify-egress.mjs من مضيف الخادم.",
  );

  return {
    verdict: notes.some((n) => n.level === "warn") ? "review" : "ok",
    ai: {
      provider: kind,
      ...(host ? { host } : {}),
      externalAllowed: allowExternal,
      redactAlways,
      redactTermsCount: terms,
    },
    legalLibrary: { enabled: libOn, hosts, extraHosts, items: libOn ? loadCatalog(env).length : 0 },
    notes,
  };
}
