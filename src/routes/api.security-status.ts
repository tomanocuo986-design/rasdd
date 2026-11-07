import { createFileRoute } from "@tanstack/react-router";
import { currentUser } from "../server/auth.ts";
import { can } from "../server/roles.ts";
import { securityStatus } from "../server/security-status.ts";

// GET /api/security-status — ملخص إعدادات السرية للمدير فقط (لا مفاتيح ولا نصوص).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/security-status")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await currentUser(request).catch(() => null);
        if (!user) return json(401, { error: "سجّل الدخول أولاً." });
        if (!can(user.role, "users.manage")) return json(403, { error: "للمدير فقط." });
        return json(200, securityStatus());
      },
    },
  },
});
