import { createFileRoute } from "@tanstack/react-router";
import { currentUser } from "../server/auth.ts";
import { logEvent } from "../server/audit-log.ts";
import {
  buildOfflineZip,
  offlineEnabled,
  offlineStatus,
  OfflineBusyError,
  OfflineUnavailableError,
  passwordProblem,
} from "../server/offline-package.ts";
import { createLimiter } from "../server/rate-limit.ts";

// النسخة بدون إنترنت (docs/OFFLINE_PACKAGE.ar.md). يتطلب تسجيل دخول.
//   GET  -> {enabled, available, sizeMB?, builtAt?}
//   POST {password} -> zip فيه الحزمة المشفّرة بكلمة المرور + المشغّل. الكلمة لا تُخزَّن ولا تُسجَّل.
const limited = createLimiter({ max: 3, windowMs: 60_000 });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/offline-package")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await currentUser(request).catch(() => null);
        if (!user) return json(401, { error: "سجّل الدخول أولاً." });
        return json(200, await offlineStatus());
      },
      POST: async ({ request }: { request: Request }) => {
        const user = await currentUser(request).catch(() => null);
        if (!user) return json(401, { error: "سجّل الدخول أولاً." });
        if (!offlineEnabled()) return json(403, { error: "تحميل النسخة بدون إنترنت معطّل." });
        if (limited(user.employeeId)) return json(429, { error: "طلبات كثيرة، حاول بعد دقيقة." });

        let password: unknown;
        try {
          const raw = await request.text();
          if (raw.length > 4096) return json(413, { error: "الطلب كبير." });
          password = (JSON.parse(raw) as { password?: unknown }).password;
        } catch {
          return json(400, { error: "طلب غير صالح." });
        }
        const problem = passwordProblem(password);
        if (problem) return json(400, { error: problem });

        const actor = { actor: user.employeeId, role: user.role };
        try {
          const { body, encBytes } = await buildOfflineZip(password as string);
          void logEvent({ ...actor, action: "offline.package_download", detail: `حجم=${encBytes}` });
          return new Response(new Uint8Array(body), {
            status: 200,
            headers: {
              "content-type": "application/zip",
              "content-length": String(body.length),
              "content-disposition": 'attachment; filename="rasd-offline.zip"',
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
            },
          });
        } catch (e) {
          if (e instanceof OfflineBusyError) return json(503, { error: e.message });
          if (e instanceof OfflineUnavailableError) return json(503, { error: e.message });
          void logEvent({ ...actor, action: "offline.package_failed", detail: "فشل التجهيز" });
          return json(500, { error: "تعذّر تجهيز الحزمة." });
        }
      },
    },
  },
});
