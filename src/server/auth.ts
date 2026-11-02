// Email + password + one-time code (OTP) sign-in.
//   POST /api/auth {action:"start", email, password}   -> sends a 6-digit code to the email, returns {challenge, mode}
//   POST /api/auth {action:"verify", challenge, code}   -> sets a 30-day signed session cookie
//   POST /api/auth {action:"logout"}                    -> clears the cookie
//   GET  /api/auth                                      -> {user:{email}|null}
// Users: PostgreSQL if DATABASE_URL is set, otherwise a JSON file in AUTH_DATA_DIR (default ./data).
// Email: Resend (RESEND_API_KEY) or SMTP (SMTP_HOST...). With neither, the code is printed in the server console.
import { createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const COOKIE = "rasd_session";
const SESSION_MS = 30 * 24 * 3600 * 1000;
const CODE_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const env = (k: string) => process.env[k];
const dataDir = () => path.resolve(env("AUTH_DATA_DIR") ?? "./data");

// ---------- secret ----------
let secretCache: Buffer | undefined;
async function secret(): Promise<Buffer> {
  if (secretCache) return secretCache;
  if (env("AUTH_SECRET")) return (secretCache = Buffer.from(env("AUTH_SECRET")!));
  const f = path.join(dataDir(), "auth-secret");
  try {
    secretCache = Buffer.from((await fs.readFile(f, "utf8")).trim());
  } catch {
    const s = randomBytes(32).toString("hex");
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(f, s, { mode: 0o600 });
    secretCache = Buffer.from(s);
  }
  return secretCache;
}
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
async function sign(payload: object): Promise<string> {
  const body = b64(JSON.stringify(payload));
  const mac = createHmac("sha256", await secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}
async function unsign<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const good = createHmac("sha256", await secret()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== good.length || !timingSafeEqual(given, good)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p.exp && p.exp > Date.now() ? (p as T) : null;
  } catch {
    return null;
  }
}
const codeMac = async (code: string, salt: string) =>
  createHmac("sha256", await secret()).update(`${salt}:${code}`).digest("hex");

// ---------- passwords ----------
const scrypt = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((res, rej) => scryptCb(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));
async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await scrypt(pw, salt)).toString("hex")}`;
}
async function checkPassword(pw: string, stored: string) {
  const [s, h] = stored.split(":");
  if (!s || !h) return false;
  const k = await scrypt(pw, Buffer.from(s, "hex"));
  const want = Buffer.from(h, "hex");
  return k.length === want.length && timingSafeEqual(k, want);
}

// ---------- user store ----------
type User = { email: string; passwordHash: string; createdAt: string };
interface Store {
  get(email: string): Promise<User | null>;
  create(u: User): Promise<void>;
}
function fileStore(): Store {
  const f = path.join(dataDir(), "users.json");
  const read = async (): Promise<Record<string, User>> => {
    try {
      return JSON.parse(await fs.readFile(f, "utf8"));
    } catch {
      return {};
    }
  };
  return {
    get: async (email) => (await read())[email] ?? null,
    create: async (u) => {
      const all = await read();
      all[u.email] = u;
      await fs.mkdir(dataDir(), { recursive: true });
      await fs.writeFile(f, JSON.stringify(all, null, 2), { mode: 0o600 });
    },
  };
}
function pgStore(): Store {
  let pool: Promise<any> | undefined;
  const getPool = () =>
    (pool ??= (async () => {
      // @ts-ignore
      const { default: pg } = await import("pg");
      const p = new pg.Pool({
        connectionString: env("DATABASE_URL"),
        ssl: env("DATABASE_SSL") === "require" ? { rejectUnauthorized: false } : undefined,
      });
      await p.query(
        `create table if not exists rasd_users (email text primary key, password_hash text not null, created_at timestamptz not null default now())`,
      );
      return p;
    })());
  return {
    get: async (email) => {
      const r = await (await getPool()).query("select * from rasd_users where email=$1", [email]);
      return r.rows[0]
        ? { email, passwordHash: r.rows[0].password_hash, createdAt: new Date(r.rows[0].created_at).toISOString() }
        : null;
    },
    create: async (u) => {
      await (await getPool()).query(
        "insert into rasd_users(email,password_hash) values($1,$2) on conflict (email) do nothing",
        [u.email, u.passwordHash],
      );
    },
  };
}
const store = () => (env("DATABASE_URL") ? pgStore() : fileStore());

// ---------- email ----------
async function sendCode(to: string, code: string) {
  const subject = "رمز الدخول إلى رصد";
  const text = `رمز التحقق الخاص بك: ${code}\nصالح لمدة 10 دقائق. إذا لم تطلبه فتجاهل هذه الرسالة.`;
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #e5e5e5;border-radius:12px">
<h2 style="margin:0 0 8px">رصد</h2><p style="color:#555">رمز التحقق الخاص بك:</p>
<div style="font-size:34px;letter-spacing:10px;font-weight:700;background:#fde047;border-radius:10px;padding:14px;text-align:center;direction:ltr">${code}</div>
<p style="color:#888;font-size:12px">صالح لمدة 10 دقائق. إذا لم تطلبه فتجاهل هذه الرسالة.</p></div>`;
  const from = env("MAIL_FROM") ?? "Rasd <onboarding@resend.dev>";

  if (env("RESEND_API_KEY")) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return;
  }
  if (env("SMTP_HOST")) {
    // @ts-ignore - nodemailer is a runtime dependency
    const nm = await import("nodemailer");
    const t = nm.default.createTransport({
      host: env("SMTP_HOST"),
      port: Number(env("SMTP_PORT") ?? 587),
      secure: Number(env("SMTP_PORT") ?? 587) === 465,
      auth: env("SMTP_USER") ? { user: env("SMTP_USER"), pass: env("SMTP_PASS") } : undefined,
    });
    await t.sendMail({ from: env("SMTP_FROM") ?? env("MAIL_FROM") ?? env("SMTP_USER"), to, subject, text, html });
    return;
  }
  console.log(`\n[auth] (no email provider configured) code for ${to}: ${code}\n`);
}

// ---------- rate limiting (in memory) ----------
const attempts = new Map<string, number>();
const lastSent = new Map<string, number>();

// ---------- http helpers ----------
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
const cookieHeader = (value: string, maxAge: number, req: Request) => {
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
};
const readCookie = (req: Request) =>
  (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);

export async function currentUser(req: Request): Promise<{ email: string } | null> {
  const s = await unsign<{ e: string; exp: number }>(readCookie(req));
  return s ? { email: s.e } : null;
}

export async function handleGet(req: Request) {
  return json(200, { user: await currentUser(req) });
}

export async function handlePost(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_request" });
  }

  if (body.action === "logout") return json(200, { ok: true }, { "set-cookie": cookieHeader("", 0, req) });

  if (body.action === "start") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!EMAIL_RE.test(email)) return json(400, { error: "invalid_email" });
    if (password.length < 8 || password.length > 200) return json(400, { error: "weak_password" });
    if (Date.now() - (lastSent.get(email) ?? 0) < 30_000) return json(429, { error: "too_soon" });

    const user = await store().get(email);
    let mode: "signup" | "signin";
    let passwordHash: string;
    if (user) {
      if (!(await checkPassword(password, user.passwordHash))) return json(401, { error: "wrong_password" });
      mode = "signin";
      passwordHash = user.passwordHash;
    } else {
      mode = "signup";
      passwordHash = await hashPassword(password);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const salt = randomBytes(8).toString("hex");
    try {
      await sendCode(email, code);
    } catch (e) {
      console.error("[auth] email send failed:", e);
      return json(502, { error: "email_failed" });
    }
    lastSent.set(email, Date.now());
    const challenge = await sign({ e: email, s: salt, c: await codeMac(code, salt), m: mode, p: passwordHash, exp: Date.now() + CODE_MS });
    return json(200, { challenge, mode });
  }

  if (body.action === "verify") {
    const ch = await unsign<{ e: string; s: string; c: string; m: string; p: string; exp: number }>(body.challenge);
    if (!ch) return json(400, { error: "expired" });
    const key = ch.s;
    const n = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, n);
    if (n > MAX_ATTEMPTS) return json(429, { error: "too_many_attempts" });
    const code = String(body.code ?? "").replace(/\D/g, "");
    const given = Buffer.from(await codeMac(code, ch.s), "hex");
    const want = Buffer.from(ch.c, "hex");
    if (code.length !== 6 || given.length !== want.length || !timingSafeEqual(given, want))
      return json(401, { error: "wrong_code", left: MAX_ATTEMPTS - n });
    attempts.delete(key);
    if (ch.m === "signup") await store().create({ email: ch.e, passwordHash: ch.p, createdAt: new Date().toISOString() });
    const session = await sign({ e: ch.e, exp: Date.now() + SESSION_MS });
    return json(200, { user: { email: ch.e }, mode: ch.m }, { "set-cookie": cookieHeader(session, SESSION_MS / 1000, req) });
  }
  return json(400, { error: "bad_request" });
}
