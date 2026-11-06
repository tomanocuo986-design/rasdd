// Server-side workspace store: auditors' workspaces (the same JSON as the browser backup) kept in PostgreSQL with
// column-level encryption. The browser keeps working offline on IndexedDB/localStorage; this is the durable copy.
//
//   GET    /api/workspaces            -> list (id, name, version, updatedAt)
//   GET    /api/workspaces?id=X       -> one workspace with its payload
//   PUT    /api/workspaces?id=X       body { name, payload, baseVersion }   (baseVersion 0 = create)
//   DELETE /api/workspaces?id=X
// Auth: Authorization: Bearer <token>, tokens configured as RASD_API_TOKENS="auditor1:tokenA,auditor2:tokenB".
// Each token's name is the owner: auditors only ever see their own workspaces.
import { createHash, timingSafeEqual } from "node:crypto";
import { clientIp } from "./client-ip.ts";
import { decryptField, encryptField, type KeyRing } from "./field-crypto.ts";
import { failStore } from "./rate-limit.ts";

export type Row = { id: string; nameEnc: string; payloadEnc: string; version: number; updatedAt: string };
export type PutResult = { ok: true; version: number } | { ok: false; current: number };

export interface Repo {
  list(owner: string): Promise<Omit<Row, "payloadEnc">[]>;
  get(owner: string, id: string): Promise<Row | null>;
  put(owner: string, id: string, nameEnc: string, payloadEnc: string, baseVersion: number): Promise<PutResult>;
  remove(owner: string, id: string): Promise<boolean>;
}

export type Deps = {
  repo: Repo;
  ring: KeyRing;
  tokens: Map<string, string>; // sha256(token) hex -> owner
  maxPayloadBytes: number;
  /** اختياري: يُستدعى بعد كل سحب/دفع/حذف ناجح لمساحة عمل (سجل التدقيق). لا يُمرَّر فيه محتوى المساحة. */
  audit?: (e: { actor: string; action: string; target: string; detail: string }) => void;
};

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const WS_MAX_FAILS = 20;
const WS_LOCK_MS = 10 * 60 * 1000;
const sha = (s: string) => createHash("sha256").update(s).digest();

export function parseTokens(raw: string | undefined): Map<string, string> {
  const m = new Map<string, string>();
  for (const part of (raw ?? "").split(",")) {
    const i = part.indexOf(":");
    const owner = part.slice(0, i).trim();
    const token = part.slice(i + 1).trim();
    if (i > 0 && owner && token.length >= 16) m.set(sha(token).toString("hex"), owner);
  }
  return m;
}

function authOwner(request: Request, tokens: Map<string, string>): string | null {
  const h = request.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return null;
  const digest = sha(token);
  let owner: string | null = null;
  for (const [hex, o] of tokens) if (timingSafeEqual(digest, Buffer.from(hex, "hex"))) owner = o;
  return owner;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const err = (status: number, error: string, extra: object = {}) => json(status, { error, ...extra });

export async function handleWorkspaces(request: Request, deps: Deps): Promise<Response> {
  // تخمين الرموز: بعد WS_MAX_FAILS رمز خاطئ من عنوان واحد يُقفل العنوان WS_LOCK_MS (الحدّ كان غائباً عن هذا المسار)
  const ip = clientIp(request);
  const failKey = `ws:${ip}`;
  if (await failStore().isLocked(failKey, WS_MAX_FAILS)) return err(429, "محاولات كثيرة، حاول لاحقاً.");
  const owner = authOwner(request, deps.tokens);
  if (!owner) {
    await failStore().note(failKey, WS_LOCK_MS);
    return err(401, "غير مصرّح: رمز الدخول غير صحيح.");
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const aad = (wid: string) => `${owner}:${wid}`;

  try {
    if (request.method === "GET" && !id) {
      const rows = await deps.repo.list(owner);
      return json(200, {
        workspaces: rows.map((r) => ({
          id: r.id,
          name: decryptField(deps.ring, r.nameEnc, aad(r.id)),
          version: r.version,
          updatedAt: r.updatedAt,
        })),
      });
    }

    if (!id || !ID_RE.test(id)) return err(400, "معرّف مساحة العمل غير صالح.");

    if (request.method === "GET") {
      const row = await deps.repo.get(owner, id);
      if (!row) return err(404, "مساحة العمل غير موجودة.");
      deps.audit?.({ actor: owner, action: "workspace.pull", target: id, detail: `version=${row.version}` });
      return json(200, {
        id,
        name: decryptField(deps.ring, row.nameEnc, aad(id)),
        version: row.version,
        updatedAt: row.updatedAt,
        payload: JSON.parse(decryptField(deps.ring, row.payloadEnc, aad(id))),
      });
    }

    if (request.method === "PUT") {
      const text = await request.text();
      if (text.length > deps.maxPayloadBytes) return err(413, "حجم مساحة العمل أكبر من الحد المسموح.");
      let body: { name?: unknown; payload?: unknown; baseVersion?: unknown };
      try {
        body = JSON.parse(text);
      } catch {
        return err(400, "طلب غير صالح.");
      }
      const { name, payload, baseVersion } = body;
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.length > 200 ||
        !payload ||
        typeof payload !== "object" ||
        !Number.isInteger(baseVersion) ||
        (baseVersion as number) < 0
      )
        return err(400, "طلب غير صالح.");
      const r = await deps.repo.put(
        owner,
        id,
        encryptField(deps.ring, name, aad(id)),
        encryptField(deps.ring, JSON.stringify(payload), aad(id)),
        baseVersion as number,
      );
      if (!r.ok)
        return err(409, "تغيّرت النسخة على الخادم منذ آخر مزامنة (تعارض).", { currentVersion: r.current });
      deps.audit?.({ actor: owner, action: "workspace.push", target: id, detail: `version=${r.version}` });
      return json(200, { id, version: r.version });
    }

    if (request.method === "DELETE") {
      if (!(await deps.repo.remove(owner, id))) return err(404, "مساحة العمل غير موجودة.");
      deps.audit?.({ actor: owner, action: "workspace.delete", target: id, detail: "" });
      return json(200, { ok: true });
    }
    return err(405, "الطريقة غير مدعومة.");
  } catch (e) {
    console.error("workspaces error", e instanceof Error ? e.message : e);
    return err(500, "تعذّر تنفيذ الطلب على الخادم.");
  }
}

/** In-memory repo: used by tests and as a no-database fallback for demos (data is lost on restart). */
export function memoryRepo(): Repo {
  const rows = new Map<string, Row>();
  const k = (o: string, id: string) => `${o}\u0000${id}`;
  return {
    async list(owner) {
      return [...rows.entries()]
        .filter(([key]) => key.startsWith(`${owner}\u0000`))
        .map(([, { payloadEnc: _p, ...r }]) => r);
    },
    async get(owner, id) {
      return rows.get(k(owner, id)) ?? null;
    },
    async put(owner, id, nameEnc, payloadEnc, baseVersion) {
      const cur = rows.get(k(owner, id));
      if ((cur?.version ?? 0) !== baseVersion) return { ok: false, current: cur?.version ?? 0 };
      const version = baseVersion + 1;
      rows.set(k(owner, id), { id, nameEnc, payloadEnc, version, updatedAt: new Date().toISOString() });
      return { ok: true, version };
    },
    async remove(owner, id) {
      return rows.delete(k(owner, id));
    },
  };
}
