// مجمّع اتصالات PostgreSQL واحد مشترك بين المستخدمين والجلسات وسجل التدقيق ومساحات العمل وحدّ المحاولات.
// DATABASE_SSL:
//   require | verify -> TLS مع التحقق من الشهادة (الافتراضي الآمن). لشهادة جهة داخلية: DATABASE_SSL_CA (نص PEM أو مسار ملف).
//   no-verify        -> TLS بلا تحقق من الشهادة (يقبل اعتراض الاتصال؛ اضطرارياً فقط، ويُطبع تحذير).
//   (فارغ)           -> بلا TLS (مناسب للعنوان الداخلي في نفس الشبكة).
import { readFileSync } from "node:fs";

type Env = Record<string, string | undefined>;

let warned = false;
export function pgSsl(env: Env = process.env): undefined | { rejectUnauthorized: boolean; ca?: string } {
  const mode = (env["DATABASE_SSL"] ?? "").trim().toLowerCase();
  if (mode === "no-verify") {
    if (!warned) {
      warned = true;
      console.warn("DATABASE_SSL=no-verify: شهادة قاعدة البيانات لا تُتحقق، والاتصال معرّض للاعتراض. استخدم require مع DATABASE_SSL_CA متى أمكن.");
    }
    return { rejectUnauthorized: false };
  }
  if (mode === "require" || mode === "verify") {
    const raw = (env["DATABASE_SSL_CA"] ?? "").trim();
    if (!raw) return { rejectUnauthorized: true };
    const ca = raw.includes("BEGIN CERTIFICATE") ? raw.replace(/\\n/g, "\n") : readFileSync(raw, "utf8");
    return { rejectUnauthorized: true, ca };
  }
  return undefined;
}

let shared: Promise<any> | undefined;
export const pgPool = (): Promise<any> =>
  (shared ??= (async () => {
    // @ts-ignore - `pg` is a runtime dependency (listed in package.json)
    const { default: pg } = await import("pg");
    const ssl = pgSsl();
    return new pg.Pool({
      connectionString: process.env["DATABASE_URL"],
      max: Number(process.env["DATABASE_POOL_MAX"] ?? 10),
      ...(ssl ? { ssl } : {}),
    });
  })().catch((e) => {
    shared = undefined;
    throw e;
  }));
