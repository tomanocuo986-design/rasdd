// سجل تدقيق غير قابل للتعديل: كل حدث يحمل بصمة SHA-256 تشمل بصمة الحدث السابق (سلسلة تجزئة).
// أي تعديل أو حذف أو إعادة ترتيب لحدث قديم يكسر السلسلة ويكشفه verifyChain.
//  - مع DATABASE_URL: جدول rasd_audit_log مع مشغّل (trigger) يمنع UPDATE/DELETE على مستوى قاعدة البيانات.
//  - بدونها: ملف JSONL بوضع الإلحاق فقط في AUTH_DATA_DIR (للتجارب؛ ضع قاعدة بيانات في الإنتاج).
// لا تُسجَّل هنا بيانات التدقيق نفسها ولا كلمات المرور، بل «من فعل ماذا ومتى» فقط.
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type AuditEvent = {
  seq: number;
  ts: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  detail: string;
  prevHash: string;
  hash: string;
};
export type NewEvent = Pick<AuditEvent, "actor" | "action"> & Partial<Pick<AuditEvent, "role" | "target" | "detail">>;

export const GENESIS = "0".repeat(64);
const MAX_FIELD = 500;

const clip = (s: unknown) => String(s ?? "").replace(/[\r\n\u0000]+/g, " ").slice(0, MAX_FIELD);

export function hashEvent(e: Omit<AuditEvent, "hash">): string {
  const canonical = JSON.stringify([e.seq, e.ts, e.actor, e.role, e.action, e.target, e.detail, e.prevHash]);
  return createHash("sha256").update(canonical).digest("hex");
}

export function makeEvent(n: NewEvent, prev: AuditEvent | null, now: Date = new Date()): AuditEvent {
  const base = {
    seq: (prev?.seq ?? 0) + 1,
    ts: now.toISOString(),
    actor: clip(n.actor),
    role: clip(n.role ?? ""),
    action: clip(n.action),
    target: clip(n.target ?? ""),
    detail: clip(n.detail ?? ""),
    prevHash: prev?.hash ?? GENESIS,
  };
  return { ...base, hash: hashEvent(base) };
}

/** يتحقق من السلسلة كاملة؛ يعيد أول حدث تالف إن وُجد. */
export function verifyChain(events: AuditEvent[]): { ok: true; count: number } | { ok: false; brokenAt: number; reason: string } {
  let prevHash = GENESIS;
  let prevSeq = 0;
  for (const e of events) {
    if (e.seq !== prevSeq + 1) return { ok: false, brokenAt: e.seq, reason: "تسلسل الأحداث غير متصل (حدث محذوف أو مُعاد ترتيبه)" };
    if (e.prevHash !== prevHash) return { ok: false, brokenAt: e.seq, reason: "بصمة الحدث السابق لا تطابق السلسلة" };
    const { hash, ...rest } = e;
    if (hashEvent(rest) !== hash) return { ok: false, brokenAt: e.seq, reason: "محتوى الحدث تغيّر بعد تسجيله" };
    prevHash = hash;
    prevSeq = e.seq;
  }
  return { ok: true, count: events.length };
}

export interface AuditStore {
  append(n: NewEvent): Promise<AuditEvent>;
  all(): Promise<AuditEvent[]>;
}

/** مخزن في الذاكرة للاختبارات. */
export function memoryAuditStore(): AuditStore {
  const rows: AuditEvent[] = [];
  return {
    async append(n) {
      const e = makeEvent(n, rows[rows.length - 1] ?? null);
      rows.push(e);
      return e;
    },
    async all() {
      return rows.map((r) => ({ ...r }));
    },
  };
}

const env = (k: string) => process.env[k];

function fileAuditStore(): AuditStore {
  const f = path.join(path.resolve(env("AUTH_DATA_DIR") ?? "./data"), "audit-log.jsonl");
  let chain: Promise<unknown> = Promise.resolve(); // يمنع تداخل الكتابات فيتكسر التسلسل
  const read = async (): Promise<AuditEvent[]> => {
    try {
      return (await fs.readFile(f, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  };
  return {
    all: read,
    append(n) {
      const run = async () => {
        const rows = await read();
        const e = makeEvent(n, rows[rows.length - 1] ?? null);
        await fs.mkdir(path.dirname(f), { recursive: true });
        await fs.appendFile(f, JSON.stringify(e) + "\n", { mode: 0o600 });
        return e;
      };
      const p = chain.then(run, run) as Promise<AuditEvent>;
      chain = p.catch(() => undefined);
      return p;
    },
  };
}

function pgAuditStore(): AuditStore {
  let pool: Promise<any> | undefined;
  const getPool = () =>
    (pool ??= (async () => {
      // @ts-ignore - pg is a runtime dependency
      const { default: pg } = await import("pg");
      const p = new pg.Pool({
        connectionString: env("DATABASE_URL"),
        ssl: env("DATABASE_SSL") === "require" ? { rejectUnauthorized: false } : undefined,
      });
      await p.query(`create table if not exists rasd_audit_log (
        seq bigint primary key, ts text not null, actor text not null, role text not null, action text not null,
        target text not null, detail text not null, prev_hash text not null, hash text not null)`);
      // يمنع التعديل والحذف حتى من مدير قاعدة البيانات العادي (يلزمه إسقاط المشغّل صراحةً، وهذا بحد ذاته أثر ظاهر)
      await p.query(`create or replace function rasd_audit_immutable() returns trigger as $$
        begin raise exception 'rasd_audit_log is append-only'; end; $$ language plpgsql`);
      await p.query(`drop trigger if exists rasd_audit_no_change on rasd_audit_log`);
      await p.query(`create trigger rasd_audit_no_change before update or delete on rasd_audit_log
        for each row execute function rasd_audit_immutable()`);
      return p;
    })());
  const toEvent = (r: any): AuditEvent => ({
    seq: Number(r.seq), ts: r.ts, actor: r.actor, role: r.role, action: r.action,
    target: r.target, detail: r.detail, prevHash: r.prev_hash, hash: r.hash,
  });
  return {
    async all() {
      const { rows } = await (await getPool()).query("select * from rasd_audit_log order by seq");
      return rows.map(toEvent);
    },
    async append(n) {
      const p = await getPool();
      for (let attempt = 0; attempt < 5; attempt++) {
        const { rows } = await p.query("select * from rasd_audit_log order by seq desc limit 1");
        const e = makeEvent(n, rows[0] ? toEvent(rows[0]) : null);
        const r = await p.query(
          `insert into rasd_audit_log(seq,ts,actor,role,action,target,detail,prev_hash,hash)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing`,
          [e.seq, e.ts, e.actor, e.role, e.action, e.target, e.detail, e.prevHash, e.hash],
        );
        if (r.rowCount === 1) return e; // وإلا سبقنا طلب آخر على نفس الرقم: نعيد المحاولة على آخر حدث
      }
      throw new Error("audit log busy");
    },
  };
}

let singleton: AuditStore | undefined;
export const auditStore = (): AuditStore => (singleton ??= env("DATABASE_URL") ? pgAuditStore() : fileAuditStore());

/** تسجيل «أطلق وانسَ»: فشل السجل لا يُسقط الطلب الأصلي لكنه يُكتب في سجل الخادم. */
export async function logEvent(n: NewEvent, store: AuditStore = auditStore()): Promise<void> {
  try {
    await store.append(n);
  } catch (e) {
    console.error("audit-log failed", e instanceof Error ? e.message : e);
  }
}
