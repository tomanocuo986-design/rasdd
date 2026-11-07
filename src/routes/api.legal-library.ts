import { createFileRoute } from "@tanstack/react-router";
import { currentUser } from "../server/auth.ts";
import { logEvent } from "../server/audit-log.ts";
import { getLegalLibrary, libraryEnabled } from "../server/legal-library.ts";
import { createLimiter } from "../server/rate-limit.ts";

// المكتبة الرسمية للأنظمة والتعليمات (انظر server/legal-library.ts).
//   GET                -> قائمة البنود وحالتها {enabled, items:[{id,title,site,url,status,sha,fetchedAt,...}]}
//   GET ?file=<id>     -> ملف PDF المخزّن مؤقتاً على الخادم لذلك البند (المعرّف من القائمة فقط، لا روابط حرة)
// يتطلب تسجيل دخول. الخادم يجلب الملفات من مواقع الجهات ويجددها كل 24 ساعة؛ المتصفح يستخرج النص مرة لكل نسخة.
const limited = createLimiter({ max: 120, windowMs: 60_000 });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const library = () =>
  getLegalLibrary(
    (e) => void logEvent({ actor: "system", role: "system", action: e.action, detail: e.detail }),
  );

export const Route = createFileRoute("/api/legal-library")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await currentUser(request).catch(() => null);
        if (!user) return json(401, { error: "سجّل الدخول أولاً." });
        if (!libraryEnabled()) return json(200, { enabled: false, items: [] });
        if (limited(user.employeeId)) return json(429, { error: "طلبات كثيرة، حاول بعد دقيقة." });

        const id = new URL(request.url).searchParams.get("file");
        if (!id) return json(200, { enabled: true, items: library().list() });

        const f = library().file(id);
        if (!f) return json(404, { error: "الملف غير جاهز بعد أو غير موجود في القائمة." });
        return new Response(new Uint8Array(f.body), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": String(f.body.length),
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "x-final-url": encodeURIComponent(f.finalUrl),
            "x-sha": f.sha,
          },
        });
      },
    },
  },
});
