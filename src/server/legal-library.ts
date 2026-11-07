import { createHash } from "node:crypto";
import {
  allowedHosts,
  fetchLegalPdf,
  legalFetchEnabled,
  maxBytesFromEnv,
  validateUrl,
  type Fetched,
  type Reject,
} from "./legal-fetch.ts";

type Env = Record<string, string | undefined>;

/**
 * المكتبة الرسمية: قائمة ثابتة بروابط أنظمة وتعليمات على مواقع حكومية مسموحة. الخادم يجلبها بنفسه ويحتفظ بها
 * في الذاكرة (تتجدد كل 24 ساعة)، فلا يرفع المستخدم شيئاً. لا يُكتب أي ملف على القرص.
 * لإضافة بند: أضفه هنا، أو ضع JSON في المتغير LEGAL_CATALOG_EXTRA (نطاقه يجب أن يكون ضمن المسموح).
 */
export type CatalogItem = {
  id: string;
  title: string;
  site: string;
  url: string;
  effectiveDate?: string;
  /**
   * بصمة النسخة التي اعتمدها المدقق (بداية sha المعروض في القائمة). إن وُضعت ثم تغيّر الملف على الموقع الرسمي
   * لا تُستبدل النسخة المحفوظة ويظهر البند بحالة تحتاج مراجعة، فلا يدخل نص جديد إلى «السند القانوني» دون قرار بشري.
   */
  pinSha?: string;
};

export const DEFAULT_CATALOG: readonly CatalogItem[] = [
  {
    id: "procurement-regulation",
    title: "نظام المشتريات الحكومية رقم (8) لسنة 2022",
    site: "وزارة الاقتصاد الرقمي",
    url: "https://modee.gov.jo/ebv4.0/root_storage/ar/eb_list_page/نظام_المشتريات_الحكومية_رقم_(8)_لسنة_2022.pdf",
  },
  {
    id: "procurement-instructions",
    title: "تعليمات تنظيم إجراءات المشتريات الحكومية لسنة 2022",
    site: "بوابة الحكومة الأردنية (الجريدة الرسمية)",
    url: "https://portal.jordan.gov.jo/OD/files/7003.pdf",
  },
  {
    id: "gtd-regulation-43-2020",
    title: "نظام دائرة العطاءات الحكومية رقم (43) لسنة 2020",
    site: "دائرة العطاءات الحكومية",
    url: "https://www.gtd.gov.jo/EBV4.0/Root_Storage/AR/78/نظام_دائرة_العطاءات_الحكومية_رقم_43_لسنة_2020.pdf",
  },
  {
    id: "public-works-regulation",
    title: "نظام الأشغال الحكومية",
    site: "دائرة العطاءات الحكومية",
    url: "https://www.gtd.gov.jo/ebv4.0/root_storage/ar/eb_list_page/نظام_الأشغال_الحكوميّة.pdf",
  },
  {
    id: "hr-regulation-33-2024",
    title: "نظام إدارة الموارد البشرية في القطاع العام رقم (33) لسنة 2024 وتعديلاته",
    site: "هيئة الخدمة والإدارة العامة",
    url: "https://www.spac.gov.jo/ebv4.0/root_storage/ar/eb_list_page/النظام_معدل-.pdf",
  },
  {
    id: "civil-service-regulation",
    title: "نظام الخدمة المدنية رقم (9) لسنة 2020 (النص الأصلي — قد يكون ملغى أو معدلاً بنظام الموارد البشرية 33/2024: تحقق قبل الاستشهاد)",
    site: "بوابة الحكومة الأردنية (الجريدة الرسمية)",
    url: "https://portal.jordan.gov.jo/OD/files/6983.pdf",
  },
];

const MAX_CATALOG = 30;
/** سقف مجموع ما يُحفظ في الذاكرة من ملفات (م.ب). يمنع 30 ملفاً كبيراً من استنزاف ذاكرة الخادم. */
export const DEFAULT_MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const PIN_RE = /^[0-9a-f]{8,32}$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

export const libraryEnabled = (env: Env = process.env): boolean =>
  legalFetchEnabled(env) && (env["LEGAL_LIBRARY"] ?? "").trim().toLowerCase() !== "off";

export const ttlFromEnv = (env: Env = process.env): number => {
  const h = Number(env["LEGAL_LIBRARY_TTL_HOURS"]);
  return Number.isFinite(h) && h >= 1 && h <= 24 * 30 ? Math.floor(h * 3600_000) : 24 * 3600_000;
};

/** القائمة الافتراضية + LEGAL_CATALOG_EXTRA (مصفوفة JSON من {title,url,site?,id?}). البنود التي تفشل في فحص الرابط تُهمل. */
export function loadCatalog(
  env: Env = process.env,
  hosts: readonly string[] = allowedHosts(env),
): CatalogItem[] {
  const out: CatalogItem[] = [];
  const seen = new Set<string>();
  const add = (it: CatalogItem) => {
    if (out.length >= MAX_CATALOG || seen.has(it.id) || !ID_RE.test(it.id)) return;
    const v = validateUrl(it.url, hosts);
    if (!v.ok) return;
    seen.add(it.id);
    out.push({ ...it, url: v.url.toString() }); // الرابط بعد الفحص (http يُرقّى إلى https)
  };
  for (const it of DEFAULT_CATALOG) add(it);
  const raw = (env["LEGAL_CATALOG_EXTRA"] ?? "").trim();
  if (raw) {
    try {
      const arr: unknown = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const x of arr) {
          const o = x as Record<string, unknown>;
          if (typeof o?.["url"] !== "string" || typeof o?.["title"] !== "string") continue;
          const id =
            typeof o["id"] === "string" && o["id"]
              ? o["id"]
              : "x-" + createHash("sha1").update(o["url"]).digest("hex").slice(0, 10);
          const ed =
            typeof o["effectiveDate"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o["effectiveDate"])
              ? o["effectiveDate"]
              : undefined;
          const pin =
            typeof o["pinSha"] === "string" && PIN_RE.test(o["pinSha"].toLowerCase())
              ? o["pinSha"].toLowerCase()
              : undefined;
          add({
            id,
            title: o["title"].slice(0, 200),
            site: typeof o["site"] === "string" ? o["site"].slice(0, 120) : "",
            url: o["url"],
            ...(ed ? { effectiveDate: ed } : {}),
            ...(pin ? { pinSha: pin } : {}),
          });
        }
      }
    } catch {
      /* JSON غير صالح: تُتجاهل الإضافات */
    }
  }
  return out;
}

export type PublicItem = {
  id: string;
  title: string;
  site: string;
  url: string;
  status: "ok" | "pending" | "error";
  sha?: string;
  fetchedAt?: string;
  bytes?: number;
  effectiveDate?: string;
  error?: string;
  /** نسخة محفوظة وصالحة، لكن آخر جلب لم يُعتمد (تغيّر عن pinSha أو تجاوز الميزانية): تحتاج مراجعة بشرية. */
  warning?: string;
};

type Entry = {
  state: "pending" | "ok" | "error";
  body?: Buffer;
  sha?: string;
  finalUrl?: string;
  fetchedAt?: number;
  error?: string;
  retryAt?: number;
  inflight?: boolean;
};

export type LibraryOpts = {
  catalog: () => CatalogItem[];
  fetchPdf: (url: string) => Promise<Fetched | Reject>;
  ttlMs?: number;
  retryMs?: number;
  maxTotalBytes?: number;
  now?: () => number;
  onEvent?: (e: { action: string; detail: string }) => void;
};

const where = (raw: string): string => {
  try {
    const u = new URL(raw);
    let p = u.pathname;
    try {
      p = decodeURIComponent(p);
    } catch {
      /* يبقى كما هو */
    }
    return `${u.hostname}${p}`.slice(0, 160);
  } catch {
    return "";
  }
};

export function createLegalLibrary(opts: LibraryOpts) {
  const ttl = opts.ttlMs ?? 24 * 3600_000;
  const retry = opts.retryMs ?? 10 * 60_000;
  const maxTotal = opts.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const now = opts.now ?? Date.now;
  const store = new Map<string, Entry>();
  let queue: Promise<void> = Promise.resolve();

  function schedule(item: CatalogItem, e: Entry) {
    if (e.inflight) return;
    e.inflight = true;
    // واحد بعد الآخر: لا نضغط على مواقع الجهات بطلبات متوازية.
    queue = queue.then(async () => {
      try {
        const r = await opts.fetchPdf(item.url);
        if (!r.ok) {
          e.retryAt = now() + retry;
          e.error = r.error;
          if (!e.body) e.state = "error"; // إن وُجدت نسخة قديمة نُبقيها بدل أن نفقدها
          opts.onEvent?.({
            action: "legal.library_failed",
            detail: `${where(item.url)} status=${r.status}`,
          });
          return;
        }
        const sha = createHash("sha256").update(r.body).digest("hex").slice(0, 32);
        let others = 0;
        for (const v of store.values()) if (v !== e && v.body) others += v.body.length;
        if (item.pinSha && !sha.startsWith(item.pinSha)) {
          // الملف على الموقع الرسمي تغيّر عن النسخة المعتمدة: نُبقي القديمة (إن وُجدت) ونطلب قراراً بشرياً.
          e.retryAt = now() + ttl;
          e.error = "تغيّر الملف على الموقع الرسمي عن النسخة المعتمدة. راجعه ثم حدّث pinSha.";
          if (!e.body) e.state = "error";
          opts.onEvent?.({
            action: "legal.library_changed",
            detail: `${where(item.url)} sha=${sha.slice(0, 12)}`,
          });
        } else if (others + r.body.length > maxTotal) {
          e.retryAt = now() + retry;
          e.error = "تجاوز مجموع حجم المكتبة الرسمية المسموح في ذاكرة الخادم.";
          if (!e.body) e.state = "error";
          opts.onEvent?.({
            action: "legal.library_failed",
            detail: `${where(item.url)} status=memory_budget`,
          });
        } else {
          e.body = r.body;
          e.sha = sha;
          e.finalUrl = r.finalUrl;
          e.fetchedAt = now();
          e.state = "ok";
          delete e.error;
          delete e.retryAt;
          opts.onEvent?.({
            action: "legal.library_refresh",
            detail: `${where(r.finalUrl)} bytes=${r.body.length}`,
          });
        }
      } catch {
        e.retryAt = now() + retry;
        e.error = "تعذّر جلب الملف من الموقع.";
        if (!e.body) e.state = "error";
      } finally {
        e.inflight = false;
      }
    });
  }

  /** يحدّث ما يلزم تحديثه في الخلفية ويعيد الحالة الحالية فوراً. */
  function list(): PublicItem[] {
    const cat = opts.catalog();
    const ids = new Set(cat.map((c) => c.id));
    for (const k of store.keys()) if (!ids.has(k)) store.delete(k);
    return cat.map((item) => {
      let e = store.get(item.id);
      if (!e) {
        e = { state: "pending" };
        store.set(item.id, e);
      }
      const due = (e.retryAt ?? 0) <= now(); // بعد فشل سابق ننتظر مهلة إعادة المحاولة
      const wants =
        e.state === "pending"
          ? true
          : e.state === "ok"
            ? now() - (e.fetchedAt ?? 0) > ttl && due
            : due;
      if (wants) schedule(item, e);
      const pub: PublicItem = {
        id: item.id,
        title: item.title,
        site: item.site,
        url: e.finalUrl ?? item.url,
        status: e.state,
      };
      if (item.effectiveDate) pub.effectiveDate = item.effectiveDate;
      if (e.state === "ok") {
        pub.sha = e.sha!;
        pub.fetchedAt = new Date(e.fetchedAt!).toISOString();
        pub.bytes = e.body!.length;
      }
      if (e.state === "error" && e.error) pub.error = e.error;
      if (e.state === "ok" && e.error) pub.warning = e.error;
      return pub;
    });
  }

  /** ملف PDF المخزّن مؤقتاً لبند من القائمة (لا يقبل إلا معرّفات القائمة). */
  function file(id: string): { body: Buffer; finalUrl: string; sha: string } | null {
    if (!opts.catalog().some((c) => c.id === id)) return null;
    const e = store.get(id);
    if (!e || e.state !== "ok" || !e.body) return null;
    return { body: e.body, finalUrl: e.finalUrl!, sha: e.sha! };
  }

  return { list, file };
}

let shared: ReturnType<typeof createLegalLibrary> | null = null;

/** النسخة المشتركة بين كل المستخدمين داخل عملية الخادم. */
export function getLegalLibrary(onEvent?: LibraryOpts["onEvent"]) {
  if (!shared) {
    shared = createLegalLibrary({
      catalog: () => loadCatalog(),
      fetchPdf: (url) => fetchLegalPdf(url, { hosts: allowedHosts(), maxBytes: maxBytesFromEnv() }),
      ttlMs: ttlFromEnv(),
      ...(onEvent ? { onEvent } : {}),
    });
  }
  return shared;
}
