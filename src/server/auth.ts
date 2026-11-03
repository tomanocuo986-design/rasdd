// Employee-ID + password sign-in (no email, no OTP).
//   POST /api/auth {action:"register", employeeId, password, confirm} -> creates the account, sets a 30-day signed session cookie
//   POST /api/auth {action:"login", employeeId, password}              -> sets the session cookie
//   POST /api/auth {action:"logout"}                                   -> clears the cookie
//   GET  /api/auth                                                     -> {user:{employeeId}|null}
// Users: PostgreSQL if DATABASE_URL is set (persistent), otherwise a JSON file in AUTH_DATA_DIR (default ./data).
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { auditStore, logEvent, verifyChain } from "./audit-log.ts";
import { can, effectiveRole, isClientEvent, isRole, registrationPolicy, type Role } from "./roles.ts";

const COOKIE = "rasd_session";
const SESSION_MS = 30 * 24 * 3600 * 1000;
const MAX_ATTEMPTS = 8;
const LOCK_MS = 10 * 60 * 1000;
const ID_RE = /^[A-Za-z0-9\-_.]{3,32}$/;

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
type User = { employeeId: string; passwordHash: string; createdAt: string; role?: Role };
interface Store {
  get(employeeId: string): Promise<User | null>;
  create(u: User): Promise<boolean>; // false if the employee ID already exists
  setRole(employeeId: string, role: Role): Promise<boolean>; // false if the user does not exist
  list(): Promise<User[]>;
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
    get: async (id) => (await read())[id] ?? null,
    create: async (u) => {
      const all = await read();
      if (all[u.employeeId]) return false;
      all[u.employeeId] = u;
      await fs.mkdir(dataDir(), { recursive: true });
      await fs.writeFile(f, JSON.stringify(all, null, 2), { mode: 0o600 });
      return true;
    },
    setRole: async (id, role) => {
      const all = await read();
      if (!all[id]) return false;
      all[id] = { ...all[id], role };
      await fs.writeFile(f, JSON.stringify(all, null, 2), { mode: 0o600 });
      return true;
    },
    list: async () => Object.values(await read()),
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
        `create table if not exists rasd_users_emp (employee_id text primary key, password_hash text not null, created_at timestamptz not null default now())`,
      );
      await p.query(`alter table rasd_users_emp add column if not exists role text not null default 'auditor'`);
      return p;
    })());
  const toUser = (r: any): User => ({
    employeeId: r.employee_id,
    passwordHash: r.password_hash,
    createdAt: new Date(r.created_at).toISOString(),
    role: isRole(r.role) ? r.role : "auditor",
  });
  return {
    get: async (employeeId) => {
      const r = await (await getPool()).query("select * from rasd_users_emp where employee_id=$1", [employeeId]);
      return r.rows[0] ? toUser(r.rows[0]) : null;
    },
    setRole: async (employeeId, role) => {
      const r = await (await getPool()).query("update rasd_users_emp set role=$2 where employee_id=$1", [employeeId, role]);
      return r.rowCount === 1;
    },
    list: async () => (await (await getPool()).query("select * from rasd_users_emp order by created_at")).rows.map(toUser),
    create: async (u) => {
      const r = await (await getPool()).query(
        "insert into rasd_users_emp(employee_id,password_hash) values($1,$2) on conflict (employee_id) do nothing",
        [u.employeeId, u.passwordHash],
      );
      return r.rowCount === 1;
    },
  };
}
const store = () => (env("DATABASE_URL") ? pgStore() : fileStore());

// ---------- rate limiting (in memory) ----------
const fails = new Map<string, { n: number; until: number }>();
const locked = (k: string) => {
  const f = fails.get(k);
  return !!f && f.n >= MAX_ATTEMPTS && Date.now() < f.until;
};
const noteFail = (k: string) => {
  const f = fails.get(k);
  const n = f && Date.now() < f.until ? f.n + 1 : 1;
  fails.set(k, { n, until: Date.now() + LOCK_MS });
};
const normId = (v: unknown) =>
  String(v ?? "")
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .toUpperCase();

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

export type SessionUser = { employeeId: string; role: Role };

/** المستخدم الحالي من ملف تعريف الارتباط الموقَّع، والدور يُقرأ من الخادم (يسري تغييره فورًا ويسقط حذف الحساب الجلسة). */
export async function currentUser(req: Request): Promise<SessionUser | null> {
  const s = await unsign<{ e: string; exp: number }>(readCookie(req));
  if (!s) return null;
  const user = await store().get(s.e);
  return user ? { employeeId: user.employeeId, role: effectiveRole(user) } : null;
}

const MAX_LIST = 500;

export async function handleGet(req: Request) {
  const user = await currentUser(req);
  const url = new URL(req.url);

  // سجل التدقيق: للمراجع والمدير فقط، مع التحقق من سلامة السلسلة كاملة
  if (url.searchParams.get("audit") === "1") {
    if (!user) return json(401, { error: "unauthenticated" });
    if (!can(user.role, "audit.read")) return json(403, { error: "forbidden" });
    const all = await auditStore().all();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), MAX_LIST);
    await logEvent({ actor: user.employeeId, role: user.role, action: "audit.read", detail: `limit=${limit}` });
    return json(200, { verify: verifyChain(all), total: all.length, events: all.slice(-limit).reverse() });
  }
  if (url.searchParams.get("users") === "1") {
    if (!user) return json(401, { error: "unauthenticated" });
    if (!can(user.role, "users.manage")) return json(403, { error: "forbidden" });
    const users = (await store().list()).map((u) => ({ employeeId: u.employeeId, role: effectiveRole(u), createdAt: u.createdAt }));
    return json(200, { users });
  }
  return json(200, { user, registration: registrationPolicy() });
}

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function handlePost(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_request" });
  }

  if (body.action === "logout") {
    const u = await currentUser(req);
    if (u) await logEvent({ actor: u.employeeId, role: u.role, action: "auth.logout" });
    return json(200, { ok: true }, { "set-cookie": cookieHeader("", 0, req) });
  }

  // حدث من الواجهة (قرار مدقق ذو أثر): يُختم باسم الجلسة ودورها، لا باسم يرسله المتصفح
  if (body.action === "event") {
    const u = await currentUser(req);
    if (!u) return json(401, { error: "unauthenticated" });
    if (!can(u.role, "events.write")) return json(403, { error: "forbidden" });
    if (!isClientEvent(body.event)) return json(400, { error: "unknown_event" });
    await logEvent({
      actor: u.employeeId,
      role: u.role,
      action: String(body.event),
      target: String(body.target ?? ""),
      detail: String(body.detail ?? ""),
    });
    return json(200, { ok: true });
  }

  // تغيير دور مستخدم: للمدير فقط، ويُسجَّل
  if (body.action === "set-role") {
    const u = await currentUser(req);
    if (!u) return json(401, { error: "unauthenticated" });
    if (!can(u.role, "users.manage")) return json(403, { error: "forbidden" });
    const target = normId(body.employeeId);
    if (!isRole(body.role) || !ID_RE.test(target)) return json(400, { error: "bad_request" });
    if (target === u.employeeId && body.role !== "admin") return json(400, { error: "cannot_demote_self" });
    if (!(await store().setRole(target, body.role))) return json(404, { error: "not_found" });
    await logEvent({ actor: u.employeeId, role: u.role, action: "users.set_role", target, detail: `role=${body.role}` });
    return json(200, { ok: true });
  }

  if (body.action === "register" || body.action === "login") {
    const employeeId = normId(body.employeeId);
    const password = String(body.password ?? "");
    if (!ID_RE.test(employeeId)) return json(400, { error: "invalid_id" });
    if (password.length < 8 || password.length > 200) return json(400, { error: "weak_password" });
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const keys = [`id:${employeeId}`, `ip:${ip}`];
    if (keys.some(locked)) {
      await logEvent({ actor: employeeId, action: "auth.locked", detail: `ip=${ip}` });
      return json(429, { error: "too_many_attempts" });
    }

    let created: User | null = null;
    if (body.action === "register") {
      const policy = registrationPolicy();
      if (policy === "closed") return json(403, { error: "registration_closed" });
      if (policy === "invite") {
        const code = String(process.env["AUTH_INVITE_CODE"] ?? "");
        if (!code || !safeEq(String(body.inviteCode ?? ""), code)) {
          keys.forEach(noteFail);
          await logEvent({ actor: employeeId, action: "auth.register_denied", detail: `ip=${ip}` });
          return json(403, { error: "invite_required" });
        }
      }
      if (password !== String(body.confirm ?? "")) return json(400, { error: "mismatch" });
      if (await store().get(employeeId)) return json(409, { error: "exists" });
      const passwordHash = await hashPassword(password);
      created = { employeeId, passwordHash, createdAt: new Date().toISOString(), role: "auditor" };
      if (!(await store().create(created))) return json(409, { error: "exists" });
      await logEvent({ actor: employeeId, role: effectiveRole(created), action: "auth.register", detail: `ip=${ip}` });
    } else {
      const user = await store().get(employeeId);
      if (!user || !(await checkPassword(password, user.passwordHash))) {
        keys.forEach(noteFail);
        await logEvent({ actor: employeeId, action: "auth.login_failed", detail: `ip=${ip}` });
        return json(401, { error: "wrong_credentials" });
      }
      created = user;
      await logEvent({ actor: employeeId, role: effectiveRole(user), action: "auth.login", detail: `ip=${ip}` });
    }
    keys.forEach((k) => fails.delete(k));
    const session = await sign({ e: employeeId, exp: Date.now() + SESSION_MS });
    return json(
      200,
      { user: { employeeId, role: effectiveRole(created) }, mode: body.action },
      { "set-cookie": cookieHeader(session, SESSION_MS / 1000, req) },
    );
  }
  return json(400, { error: "bad_request" });
}
