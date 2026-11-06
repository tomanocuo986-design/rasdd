// حدود المحاولات.
//  1) createLimiter: نافذة منزلقة لطلبات المستخدم (المساعد/الوكيل/مراجعة المستندات)، مفتاحها الرقم الوظيفي بعد الدخول.
//  2) failStore: عدّاد محاولات فاشلة بقفل مؤقت (الدخول، ورموز مزامنة مساحات العمل). مع DATABASE_URL يُخزَّن في PostgreSQL
//     فلا يُمسح عند إعادة التشغيل ويُشارَك بين النسخ؛ وبدونها في الذاكرة (نسخة واحدة).
import { pgPool } from "./pg-pool.ts";

const MEM_CAP = 20_000;

export function createLimiter({ max, windowMs }: { max: number; windowMs: number }) {
  const buckets = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    hits.push(now);
    buckets.delete(key); // يعيد المفتاح إلى آخر الترتيب فيُحذف الأقدم أولاً عند الامتلاء
    buckets.set(key, hits);
    while (buckets.size > MEM_CAP) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest); // نحذف الأقدم فقط: لا يمكن لمهاجم تصفير العدّادات كلها بإغراق المفاتيح
    }
    return hits.length > max;
  };
}

export interface FailStore {
  /** هل المفتاح مقفل (بلغ max فشلاً داخل مدة القفل)؟ */
  isLocked(key: string, max: number): Promise<boolean>;
  note(key: string, lockMs: number): Promise<void>;
  clear(key: string): Promise<void>;
}

export function memoryFailStore(): FailStore {
  const m = new Map<string, { n: number; until: number }>();
  return {
    async isLocked(key, max) {
      const f = m.get(key);
      return !!f && f.n >= max && Date.now() < f.until;
    },
    async note(key, lockMs) {
      const now = Date.now();
      const f = m.get(key);
      const n = f && now < f.until ? f.n + 1 : 1;
      m.delete(key);
      m.set(key, { n, until: now + lockMs });
      while (m.size > MEM_CAP) {
        const oldest = m.keys().next().value;
        if (oldest === undefined) break;
        m.delete(oldest);
      }
    },
    async clear(key) {
      m.delete(key);
    },
  };
}

export function pgFailStore(fallback: FailStore = memoryFailStore()): FailStore {
  let ready: Promise<any> | undefined;
  const pool = () =>
    (ready ??= (async () => {
      const p = await pgPool();
      await p.query(
        `create table if not exists rasd_fail_counters (k text primary key, n integer not null, until_at timestamptz not null)`,
      );
      return p;
    })().catch((e) => {
      ready = undefined;
      throw e;
    }));
  // تعطّل قاعدة البيانات لا يجوز أن يفتح الباب: نرجع إلى عدّاد الذاكرة بدل تجاهل الحدّ
  const safe = async <T,>(fn: (p: any) => Promise<T>, fb: () => Promise<T>): Promise<T> => {
    try {
      return await fn(await pool());
    } catch (e) {
      console.error("fail-counter db error", e instanceof Error ? e.message : e);
      return fb();
    }
  };
  return {
    isLocked: (key, max) =>
      safe(
        async (p) => (await p.query("select 1 from rasd_fail_counters where k=$1 and n>=$2 and until_at>now()", [key, max])).rowCount === 1,
        () => fallback.isLocked(key, max),
      ),
    note: (key, lockMs) =>
      safe(
        async (p) => {
          await p.query(
            `insert into rasd_fail_counters(k,n,until_at) values($1,1,now()+($2 * interval '1 millisecond'))
             on conflict (k) do update set
               n = case when rasd_fail_counters.until_at > now() then rasd_fail_counters.n + 1 else 1 end,
               until_at = now()+($2 * interval '1 millisecond')`,
            [key, lockMs],
          );
          await p.query("delete from rasd_fail_counters where until_at < now() - interval '1 day'");
        },
        () => fallback.note(key, lockMs),
      ),
    clear: (key) =>
      safe(
        async (p) => void (await p.query("delete from rasd_fail_counters where k=$1", [key])),
        () => fallback.clear(key),
      ),
  };
}

let singleton: { key: string; store: FailStore } | undefined;
/** عدّاد واحد للعملية؛ يتبدّل إن تغيّر DATABASE_URL (للاختبارات). */
export function failStore(): FailStore {
  const key = process.env["DATABASE_URL"] ?? "";
  if (singleton?.key !== key) singleton = { key, store: key ? pgFailStore() : memoryFailStore() };
  return singleton.store;
}
