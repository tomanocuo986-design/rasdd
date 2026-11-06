import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { currentUser } from "../server/auth.ts";
import { logEvent } from "../server/audit-log.ts";
import { can } from "../server/roles.ts";
import { aiLogDetail, gateProvider, sanitizeForAI } from "../server/ai-policy.ts";
import { createLimiter } from "../server/rate-limit.ts";

import {
  geminiBody,
  maxTokensFor,
  openaiBody,
  providerFromEnv,
  sseToText,
  systemFor,
} from "../server/llm.ts";

const MAX_TURNS = 20;
// حدّ لكل مستخدم مسجَّل (الرقم الوظيفي)، لا لكل عنوان: العنوان يزوّره العميل، والمستخدم لا يستطيع تغيير هويته
const limited = createLimiter({ max: 20, windowMs: 60_000 }); // طلبات لكل دقيقة لكل مستخدم

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(MAX_TURNS),
  context: z.string().max(14000).optional(),
  // مقاطع من مكتبة الأنظمة التي اختارها المتصفح (RAG)؛ تُعامل كبيانات للاستشهاد فقط
  passages: z
    .array(z.object({ source: z.string().min(1).max(200), text: z.string().min(1).max(1200) }))
    .max(8)
    .optional(),
  mode: z.enum(["chat", "analyze", "report"]).optional(),
});

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // المساعد يستهلك مفتاح النموذج: لا يُستخدم إلا بجلسة دخول صالحة
        const user = await currentUser(request).catch(() => null);
        if (!user) return json(401, "سجّل الدخول لاستخدام المساعد.");
        if (!can(user.role, "chat.use")) return json(403, "لا تملك صلاحية استخدام المساعد.");
        const provider = providerFromEnv();
        if (!provider)
          return json(503, "المساعد غير مفعّل: اضبط LLM_BASE_URL (نموذج محلي) أو GEMINI_API_KEY على الخادم.");
        // بوابة السرية: المزود الخارجي ممنوع ما لم يُفعَّل بقرار إداري، وكل ما يُرسل إليه يُحجب
        const gate = gateProvider(provider);
        if (!gate.ok) {
          void logEvent({ actor: user.employeeId, role: user.role, action: "ai.blocked", detail: "route=chat provider=external" });
          return json(gate.status, gate.message);
        }
        if (limited(user.employeeId)) return json(429, "طلبات كثيرة، حاول بعد دقيقة.");

        let parsed;
        try {
          parsed = bodySchema.safeParse(await request.json());
        } catch {
          return json(400, "طلب غير صالح.");
        }
        if (!parsed.success) return json(400, "طلب غير صالح.");
        const { mode, passages } = parsed.data;
        if (parsed.data.messages[parsed.data.messages.length - 1]!.role !== "user") return json(400, "طلب غير صالح.");
        const safe = sanitizeForAI(parsed.data.messages, parsed.data.context, { external: gate.external });
        const messages = safe.messages;

        const system = systemFor(mode, safe.context, passages);
        // نسجّل حدوث الاستخدام فقط (الوضع وعدد المقاطع)، لا نص السؤال ولا بيانات التدقيق
        void logEvent({
          actor: user.employeeId,
          role: user.role,
          action: "ai.chat",
          detail: aiLogDetail(`mode=${mode ?? "chat"} passages=${passages?.length ?? 0}`, gate.external, safe.total),
        });
        const maxTokens = maxTokensFor(mode);

        let upstream: Response | undefined;
        let lastStatus = 0;
        if (provider.kind === "openai") {
          // نموذج محلي/داخلي (Ollama, vLLM, LM Studio): بدون نماذج بديلة، مع إعادة محاولة واحدة
          for (let attempt = 0; attempt < 2 && !upstream; attempt++) {
            try {
              const res = await fetch(`${provider.baseUrl}/chat/completions`, {
                method: "POST",
                signal: request.signal,
                headers: {
                  "content-type": "application/json",
                  ...(provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {}),
                },
                body: openaiBody(provider.model, system, messages, maxTokens),
              });
              if (res.ok && res.body) upstream = res;
              else {
                lastStatus = res.status;
                console.error("llm error", provider.model, res.status, await res.text().catch(() => ""));
              }
            } catch {
              if (request.signal.aborted) return json(499, "أُلغي الطلب.");
              lastStatus = 0;
            }
            if (!upstream) await new Promise((r) => setTimeout(r, 1200));
          }
        } else {
          // نجرّب النموذج الأساسي مع إعادة محاولة، ثم نموذجًا بديلًا إذا كان عليه ضغط
          const payload = geminiBody(system, messages, maxTokens);
          outer: for (const model of provider.models) {
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const res = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
                  {
                    method: "POST",
                    signal: request.signal,
                    headers: { "content-type": "application/json", "x-goog-api-key": provider.apiKey },
                    body: payload,
                  },
                );
                if (res.ok && res.body) {
                  upstream = res;
                  break outer;
                }
                lastStatus = res.status;
                console.error("gemini error", model, res.status, await res.text().catch(() => ""));
                if (res.status === 404 || res.status === 400 || res.status === 403) continue outer;
              } catch {
                if (request.signal.aborted) return json(499, "أُلغي الطلب.");
                lastStatus = 0;
              }
              await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
            }
          }
        }
        if (!upstream)
          return json(
            lastStatus === 503 || lastStatus === 429 || lastStatus === 500 || lastStatus === 0 ? 503 : 502,
            lastStatus === 503 || lastStatus === 429 || lastStatus === 500 || lastStatus === 0
              ? "خدمة الذكاء الاصطناعي مشغولة أو غير متاحة حاليًا، أعد المحاولة بعد دقيقة."
              : "خدمة الذكاء الاصطناعي رفضت الطلب، حاول لاحقًا.",
          );

        // نحوّل بث SSE من المزوّد إلى نص عادي يُلحق مباشرة في الواجهة.
        const out = upstream.body!.pipeThrough(sseToText(provider.kind));
        return new Response(out, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
