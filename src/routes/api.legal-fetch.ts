import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { currentUser } from "../server/auth.ts";
import { logEvent } from "../server/audit-log.ts";
import { can } from "../server/roles.ts";
import { allowedHosts, fetchLegalPdf, legalFetchEnabled, maxBytesFromEnv, validateUrl } from "../server/legal-fetch.ts";
import { createLimiter } from "../server/rate-limit.ts";

// إضافة نظام/تعليمات إلى مكتبة الأنظمة برابط PDF من المواقع الرسمية المسموحة فقط (انظر server/legal-fetch.ts).
//   GET  -> المواقع المسموحة (لعرضها في الواجهة)
//   POST -> { url } يعيد ملف الـPDF نفسه؛ المتصفح يستخرج النص ويحفظه محلياً كأي ملف مرفوع.
// الخادم لا يخزّن الملف. التسجيل في سجل التدقيق: النطاق والمسار فقط (بلا نص ولا استعلام).
const limited = createLimiter({ max: 10, windowMs: 60_000 }); // 10 طلبات في الدقيقة لكل مستخدم

const bodySchema = z.object({ url: z.string().min(8).max(2048) });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const fail = (status: number, error: string) => json(status, { error });

export const Route = createFileRoute("/api/legal-fetch")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await currentUser(request).catch(() => null);
        if (!user) return fail(401, "سجّل الدخول أولاً.");
        return json(200, { enabled: legalFetchEnabled(), hosts: allowedHosts() });
      },
      POST: async ({ request }: { request: Request }) => {
        const user = await currentUser(request).catch(() => null);
        if (!user) return fail(401, "سجّل الدخول لإضافة نظام من رابط.");
        if (!can(user.role, "events.write")) return fail(403, "لا تملك صلاحية إضافة الأنظمة.");
        if (!legalFetchEnabled()) return fail(403, "إضافة الأنظمة من الروابط معطّلة على هذا الخادم.");
        if (limited(user.employeeId)) return fail(429, "طلبات كثيرة، حاول بعد دقيقة.");

        let parsed;
        try {
          parsed = bodySchema.safeParse(await request.json());
        } catch {
          return fail(400, "طلب غير صالح.");
        }
        if (!parsed.success) return fail(400, "طلب غير صالح.");

        const hosts = allowedHosts();
        const where = (u: URL) => `${u.hostname}${decodeSafe(u.pathname)}`.slice(0, 160);
        const check = validateUrl(parsed.data.url, hosts);
        if (!check.ok) {
          void logEvent({ actor: user.employeeId, role: user.role, action: "legal.fetch_denied", detail: `status=${check.status}` });
          return fail(check.status, check.error);
        }

        const r = await fetchLegalPdf(parsed.data.url, { hosts, maxBytes: maxBytesFromEnv() });
        if (!r.ok) {
          void logEvent({
            actor: user.employeeId,
            role: user.role,
            action: "legal.fetch_failed",
            detail: `${where(check.url)} status=${r.status}`,
          });
          return fail(r.status, r.error);
        }
        void logEvent({
          actor: user.employeeId,
          role: user.role,
          action: "legal.fetch",
          detail: `${where(new URL(r.finalUrl))} bytes=${r.body.length}`,
        });
        return new Response(new Uint8Array(r.body), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": String(r.body.length),
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "x-final-url": encodeURIComponent(r.finalUrl),
          },
        });
      },
    },
  },
});

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
