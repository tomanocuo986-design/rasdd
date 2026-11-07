import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { currentUser } from "../server/auth.ts";
import { logEvent } from "../server/audit-log.ts";
import { can } from "../server/roles.ts";
import { providerFromEnv } from "../server/llm.ts";
import { MAX_CHUNK_CHARS, completionBody, completionText, externalAllowed, isExternalProvider } from "../server/doc-review.ts";
import { CHECKLIST_IDS, MAX_CHUNKS, REVIEW_SYSTEM, buildUserPrompt } from "../rasd/doc-review.js";
import { createLimiter } from "../server/rate-limit.ts";

// مراجعة مقطع واحد من مستند عطاء مقابل بنود قائمة التحقق. المتصفح يقطّع المستند ويستدعي هذا المسار لكل مقطع،
// ثم يتحقق من الاقتباسات ويدمج النتائج محلياً. الخادم لا يخزّن النص ولا يسجّله (يسجّل رقم المقطع وعدد البنود فقط).

// حدّ لكل مستخدم مسجَّل (الرقم الوظيفي)، لا لكل عنوان: العنوان يزوّره العميل، والمستخدم لا يستطيع تغيير هويته
const limited = createLimiter({ max: 30, windowMs: 60_000 }); // مقطع لكل دقيقة لكل مستخدم

const bodySchema = z.object({
  text: z.string().min(20).max(MAX_CHUNK_CHARS),
  itemIds: z.array(z.string().refine((id) => CHECKLIST_IDS.includes(id))).min(1).max(CHECKLIST_IDS.length),
  index: z.number().int().min(1).max(MAX_CHUNKS),
  total: z.number().int().min(1).max(MAX_CHUNKS),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const fail = (status: number, error: string) => json(status, { error });

export const Route = createFileRoute("/api/doc-review")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await currentUser(request).catch(() => null);
        if (!user) return fail(401, "سجّل الدخول لاستخدام مراجعة المستندات.");
        if (!can(user.role, "chat.use")) return fail(403, "لا تملك صلاحية استخدام المساعد.");
        const provider = providerFromEnv();
        if (!provider) return fail(503, "الذكاء الاصطناعي غير مفعّل: اضبط LLM_BASE_URL أو GEMINI_API_KEY على الخادم.");
        if (isExternalProvider(provider) && !externalAllowed())
          return fail(403, "مراجعة المستندات تتطلب نموذجاً محلياً داخل شبكة الجهة (LLM_BASE_URL). لاستخدام مزود خارجي يضبط المسؤول DOC_REVIEW_ALLOW_EXTERNAL=1 بعد تقدير المخاطر.");
        if (limited(user.employeeId)) return fail(429, "طلبات كثيرة، حاول بعد دقيقة.");

        let parsed;
        try {
          parsed = bodySchema.safeParse(await request.json());
        } catch {
          return fail(400, "طلب غير صالح.");
        }
        if (!parsed.success) return fail(400, "طلب غير صالح.");
        const { text, itemIds, index, total } = parsed.data;

        void logEvent({
          actor: user.employeeId,
          role: user.role,
          action: "ai.doc_review",
          detail: `chunk=${index}/${total} items=${itemIds.length}`,
        });

        const system = REVIEW_SYSTEM;
        const prompt = buildUserPrompt(text, itemIds, index, total);
        const body = completionBody(provider, system, prompt);

        let data: unknown;
        let lastStatus = 0;
        const attempt = async (url: string, headers: Record<string, string>) => {
          try {
            const res = await fetch(url, { method: "POST", signal: request.signal, headers, body });
            if (res.ok) return (await res.json()) as unknown;
            lastStatus = res.status;
            console.error("doc-review llm error", res.status, await res.text().catch(() => ""));
          } catch {
            if (request.signal.aborted) return "aborted" as const;
            lastStatus = 0;
          }
          return undefined;
        };

        if (provider.kind === "openai") {
          for (let i = 0; i < 2 && data === undefined; i++) {
            data = await attempt(`${provider.baseUrl}/chat/completions`, {
              "content-type": "application/json",
              ...(provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {}),
            });
            if (data === undefined) await new Promise((r) => setTimeout(r, 1200));
          }
        } else {
          outer: for (const model of provider.models) {
            for (let i = 0; i < 2; i++) {
              data = await attempt(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                "content-type": "application/json",
                "x-goog-api-key": provider.apiKey,
              });
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

        const out = completionText(provider.kind, data);
        if (!out.trim()) return fail(502, "رد فارغ من النموذج، حاول مرة أخرى.");
        return json(200, { text: out });
      },
    },
  },
});
