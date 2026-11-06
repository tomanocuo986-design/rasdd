import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { currentUser } from "../server/auth.ts";
import { logEvent } from "../server/audit-log.ts";
import { aiLogDetail, gateProvider, sanitizeForAI } from "../server/ai-policy.ts";
import { can } from "../server/roles.ts";
import type { AgentMessage } from "../server/agent.ts";
import { AGENT_RULES, geminiAgentBody, openaiAgentBody, parseStep, MAX_AGENT_STEPS } from "../server/agent.ts";
import { providerFromEnv, systemFor } from "../server/llm.ts";
import { createLimiter } from "../server/rate-limit.ts";

// خطوة واحدة من حلقة الوكيل: يستقبل المحادثة (بما فيها نتائج الأدوات التي نفّذها المتصفح) ويعيد
// {text, toolCalls}. المتصفح هو من يحلقّ الحلقة وينفّذ الأدوات لأن بيانات التدقيق لا تغادره إلا كملخص.

// حدّ لكل مستخدم مسجَّل (الرقم الوظيفي)، لا لكل عنوان: العنوان يزوّره العميل، والمستخدم لا يستطيع تغيير هويته
const limited = createLimiter({ max: 60, windowMs: 60_000 }); // خطوات لكل دقيقة لكل مستخدم (الطلب الواحد قد يستهلك حتى MAX_AGENT_STEPS)

const toolCall = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(60),
  args: z.record(z.string(), z.unknown()),
  sig: z.string().max(4000).optional(),
});

const bodySchema = z.object({
  messages: z
    .array(
      z.discriminatedUnion("role", [
        z.object({ role: z.literal("user"), content: z.string().min(1).max(4000) }),
        z.object({
          role: z.literal("assistant"),
          content: z.string().max(8000),
          toolCalls: z.array(toolCall).max(6).optional(),
        }),
        z.object({
          role: z.literal("tool"),
          toolCallId: z.string().min(1).max(120),
          name: z.string().min(1).max(60),
          content: z.string().max(9000),
        }),
      ]),
    )
    .min(1)
    .max(MAX_AGENT_STEPS * 8 + 20),
  context: z.string().max(14000).optional(),
  passages: z
    .array(z.object({ source: z.string().min(1).max(200), text: z.string().min(1).max(1200) }))
    .max(8)
    .optional(),
  step: z.number().int().min(1).max(MAX_AGENT_STEPS).optional(),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const fail = (status: number, error: string) => json(status, { error });

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await currentUser(request).catch(() => null);
        if (!user) return fail(401, "سجّل الدخول لاستخدام الوكيل.");
        if (!can(user.role, "chat.use")) return fail(403, "لا تملك صلاحية استخدام المساعد.");
        const provider = providerFromEnv();
        if (!provider) return fail(503, "الوكيل غير مفعّل: اضبط LLM_BASE_URL أو GEMINI_API_KEY على الخادم.");
        const gate = gateProvider(provider);
        if (!gate.ok) {
          void logEvent({ actor: user.employeeId, role: user.role, action: "ai.blocked", detail: "route=agent provider=external" });
          return fail(gate.status, gate.message);
        }
        if (limited(user.employeeId)) return fail(429, "طلبات كثيرة، حاول بعد دقيقة.");

        let parsed;
        try {
          parsed = bodySchema.safeParse(await request.json());
        } catch {
          return fail(400, "طلب غير صالح.");
        }
        if (!parsed.success) return fail(400, "طلب غير صالح.");
        const { passages, step } = parsed.data;
        const last = parsed.data.messages[parsed.data.messages.length - 1]!;
        if (last.role === "assistant") return fail(400, "طلب غير صالح.");
        // نتائج أدوات الوكيل (tool) تحمل بيانات التدقيق، فتُحجب مع الرسائل والسياق عند المزود الخارجي
        const safe = sanitizeForAI(parsed.data.messages, parsed.data.context, { external: gate.external });
        const messages = safe.messages as AgentMessage[];

        const system = `${systemFor("chat", safe.context, passages)}\n\n${AGENT_RULES}`;
        const maxTokens = 2048;

        // نسجّل الاستخدام فقط (رقم الخطوة وأسماء الأدوات المطلوبة في هذه الرسالة الأخيرة)، لا نص ولا بيانات
        void logEvent({
          actor: user.employeeId,
          role: user.role,
          action: "ai.agent",
          detail: aiLogDetail(`step=${step ?? 1} last=${last.role === "tool" ? last.name : "user"}`, gate.external, safe.total),
        });

        let data: unknown;
        let lastStatus = 0;
        const attempt = async (url: string, headers: Record<string, string>, body: string) => {
          try {
            const res = await fetch(url, { method: "POST", signal: request.signal, headers, body });
            if (res.ok) return (await res.json()) as unknown;
            lastStatus = res.status;
            console.error("agent llm error", res.status, await res.text().catch(() => ""));
          } catch {
            if (request.signal.aborted) return "aborted" as const;
            lastStatus = 0;
          }
          return undefined;
        };

        if (provider.kind === "openai") {
          const body = openaiAgentBody(provider.model, system, messages, maxTokens);
          for (let i = 0; i < 2 && data === undefined; i++) {
            data = await attempt(
              `${provider.baseUrl}/chat/completions`,
              {
                "content-type": "application/json",
                ...(provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {}),
              },
              body,
            );
            if (data === undefined) await new Promise((r) => setTimeout(r, 1200));
          }
        } else {
          const body = geminiAgentBody(system, messages, maxTokens);
          outer: for (const model of provider.models) {
            for (let i = 0; i < 2; i++) {
              data = await attempt(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                { "content-type": "application/json", "x-goog-api-key": provider.apiKey },
                body,
              );
              if (data !== undefined) break outer;
              if (lastStatus === 404 || lastStatus === 400 || lastStatus === 403) continue outer;
              await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
            }
          }
        }
        if (data === "aborted") return fail(499, "أُلغي الطلب.");
        if (data === undefined)
          return [0, 429, 500, 503].includes(lastStatus)
            ? fail(503, "خدمة الذكاء الاصطناعي مشغولة أو غير متاحة حاليًا، أعد المحاولة بعد دقيقة.")
            : fail(502, "خدمة الذكاء الاصطناعي رفضت الطلب، حاول لاحقًا.");

        const out = parseStep(provider.kind, data);
        if (!out.text && !out.toolCalls.length) return fail(502, "رد فارغ من النموذج، حاول مرة أخرى.");
        return json(200, out);
      },
    },
  },
});
