import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATALOG,
  createLegalLibrary,
  libraryEnabled,
  loadCatalog,
  ttlFromEnv,
  type CatalogItem,
} from "@/server/legal-library.ts";
import { DEFAULT_ALLOWED_HOSTS } from "@/server/legal-fetch.ts";

const HOSTS = [...DEFAULT_ALLOWED_HOSTS];
const A: CatalogItem = {
  id: "a",
  title: "نظام أ",
  site: "موقع",
  url: "https://www.gtd.gov.jo/a.pdf",
};
const B: CatalogItem = {
  id: "b",
  title: "نظام ب",
  site: "موقع",
  url: "https://portal.jordan.gov.jo/b.pdf",
};

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

function setup(cat: CatalogItem[] = [A, B]) {
  let t = 1_000_000;
  const calls: string[] = [];
  let mode: "ok" | "fail" = "ok";
  let content = "v1";
  const lib = createLegalLibrary({
    catalog: () => cat,
    fetchPdf: async (url) => {
      calls.push(url);
      return mode === "ok"
        ? { ok: true, body: Buffer.from(`%PDF-1.7 ${content} ${url}`), finalUrl: url }
        : { ok: false, status: 502, error: "رفض الموقع الطلب (500)." };
    },
    ttlMs: 1000,
    retryMs: 100,
    now: () => t,
  });
  return {
    lib,
    calls,
    advance: (ms: number) => (t += ms),
    setMode: (m: "ok" | "fail") => (mode = m),
    setContent: (c: string) => (content = c),
  };
}

describe("catalog", () => {
  it("has only https PDFs on allowed hosts and unique ids", () => {
    const ids = new Set<string>();
    for (const c of DEFAULT_CATALOG) {
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(new URL(c.url).protocol).toBe("https:");
    }
    expect(loadCatalog({}, HOSTS).map((c) => c.id)).toEqual(DEFAULT_CATALOG.map((c) => c.id));
  });

  it("accepts extra items from LEGAL_CATALOG_EXTRA and drops disallowed or malformed ones", () => {
    const extra = JSON.stringify([
      {
        title: "تعليمات س",
        url: "https://www.csb.gov.jo/x.pdf",
        site: "الخدمة المدنية",
        effectiveDate: "2024-05-01",
      },
      { title: "خارجي", url: "https://evil.example.com/x.pdf" },
      { title: "http", url: "http://csb.gov.jo/x.pdf" },
      { url: "https://csb.gov.jo/no-title.pdf" },
    ]);
    const cat = loadCatalog({ LEGAL_CATALOG_EXTRA: extra }, HOSTS);
    // البند الخارجي والبند بلا عنوان يُهملان؛ بند http يُقبل بعد ترقيته إلى https
    expect(cat.length).toBe(DEFAULT_CATALOG.length + 2);
    const added = cat[DEFAULT_CATALOG.length]!;
    expect(added.title).toBe("تعليمات س");
    expect(added.effectiveDate).toBe("2024-05-01");
    expect(cat.every((c) => c.url.startsWith("https://"))).toBe(true);
    expect(cat.some((c) => c.url.includes("evil.example.com"))).toBe(false);
    expect(loadCatalog({ LEGAL_CATALOG_EXTRA: "{not json" }, HOSTS).length).toBe(
      DEFAULT_CATALOG.length,
    );
  });

  it("env switches", () => {
    expect(libraryEnabled({})).toBe(true);
    expect(libraryEnabled({ LEGAL_LIBRARY: "off" })).toBe(false);
    expect(libraryEnabled({ LEGAL_FETCH: "off" })).toBe(false);
    expect(ttlFromEnv({})).toBe(24 * 3600_000);
    expect(ttlFromEnv({ LEGAL_LIBRARY_TTL_HOURS: "6" })).toBe(6 * 3600_000);
    expect(ttlFromEnv({ LEGAL_LIBRARY_TTL_HOURS: "0" })).toBe(24 * 3600_000);
  });
});

describe("legal library cache", () => {
  it("starts pending, fetches in the background one after another, then serves from memory", async () => {
    const s = setup();
    const first = s.lib.list();
    expect(first.map((i) => i.status)).toEqual(["pending", "pending"]);
    await flush();
    const second = s.lib.list();
    expect(second.map((i) => i.status)).toEqual(["ok", "ok"]);
    expect(second[0]!.sha).toMatch(/^[0-9a-f]{32}$/);
    expect(second[0]!.bytes).toBeGreaterThan(10);
    expect(s.calls).toEqual([A.url, B.url]);
    s.lib.list();
    s.lib.list();
    await flush();
    expect(s.calls.length).toBe(2); // لا جلب جديد قبل انتهاء المدة
  });

  it("refreshes after the TTL and the sha changes when the source changes", async () => {
    const s = setup([A]);
    s.lib.list();
    await flush();
    const sha1 = s.lib.list()[0]!.sha;
    s.setContent("v2");
    s.advance(1500);
    s.lib.list(); // يطلق التحديث ويبقي النسخة القديمة متاحة
    expect(s.lib.file("a")).not.toBeNull();
    await flush();
    const sha2 = s.lib.list()[0]!.sha;
    expect(sha2).not.toBe(sha1);
    expect(s.calls.length).toBe(2);
  });

  it("keeps the last good copy when a refresh fails and retries after the retry delay", async () => {
    const s = setup([A]);
    s.lib.list();
    await flush();
    s.setMode("fail");
    s.advance(1500);
    s.lib.list();
    await flush();
    expect(s.lib.list()[0]!.status).toBe("ok"); // ما زالت النسخة القديمة
    expect(s.lib.file("a")).not.toBeNull();
    const n = s.calls.length;
    s.lib.list();
    await flush();
    expect(s.calls.length).toBe(n); // لم يحن موعد إعادة المحاولة
    s.setMode("ok");
    s.advance(200);
    s.lib.list();
    await flush();
    expect(s.calls.length).toBe(n + 1);
  });

  it("reports an error with the reason when the first fetch fails", async () => {
    const s = setup([A]);
    s.setMode("fail");
    s.lib.list();
    await flush();
    const it = s.lib.list()[0]!;
    expect(it.status).toBe("error");
    expect(it.error).toContain("رفض الموقع");
    expect(s.lib.file("a")).toBeNull();
  });

  it("serves files only for catalog ids", async () => {
    const s = setup([A]);
    s.lib.list();
    await flush();
    expect(s.lib.file("a")?.body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(s.lib.file("../etc/passwd")).toBeNull();
    expect(s.lib.file("b")).toBeNull();
  });

  it("drops cached files of items removed from the catalog", async () => {
    const cat = [A, B];
    const s = setup(cat);
    s.lib.list();
    await flush();
    cat.pop();
    expect(s.lib.list().map((i) => i.id)).toEqual(["a"]);
    expect(s.lib.file("b")).toBeNull();
  });
});

describe("legal library: النسخة المعتمدة وميزانية الذاكرة", () => {
  const mkLib = (cat: CatalogItem[], body: () => string, maxTotalBytes?: number) => {
    let t = 1_000_000;
    const lib = createLegalLibrary({
      catalog: () => cat,
      fetchPdf: async (url) => ({ ok: true, body: Buffer.from(`%PDF-1.7 ${body()}`), finalUrl: url }),
      ttlMs: 1000,
      retryMs: 100,
      now: () => t,
      ...(maxTotalBytes ? { maxTotalBytes } : {}),
    });
    return { lib, advance: (ms: number) => (t += ms) };
  };

  it("لا تُستبدل النسخة المحفوظة إن تغيّر الملف عن pinSha، ويظهر السبب", async () => {
    let content = "v1";
    const probe = mkLib([A], () => content);
    probe.lib.list();
    await flush();
    const sha = probe.lib.list()[0]!.sha!;

    const pinned: CatalogItem = { ...A, pinSha: sha.slice(0, 16) };
    const s = mkLib([pinned], () => content);
    s.lib.list();
    await flush();
    expect(s.lib.list()[0]!.status).toBe("ok");
    content = "v2 تغيّر النص";
    s.advance(1500);
    s.lib.list();
    await flush();
    const it1 = s.lib.list()[0]!;
    expect(it1.sha).toBe(sha); // ما زالت المعتمدة
  });

  it("يُظهر تحذير «تحتاج مراجعة» مع بقاء النسخة المعتمدة صالحة (ولا يُخفيه خلف status=ok)", async () => {
    let content = "v1";
    const probe = mkLib([A], () => content);
    probe.lib.list();
    await flush();
    const sha = probe.lib.list()[0]!.sha!;
    const s = mkLib([{ ...A, pinSha: sha.slice(0, 16) }], () => content);
    s.lib.list();
    await flush();
    expect(s.lib.list()[0]!.warning).toBeUndefined();
    content = "v2 تغيّر النص";
    s.advance(1500);
    s.lib.list();
    await flush();
    const it1 = s.lib.list()[0]!;
    expect(it1.status).toBe("ok");
    expect(it1.warning).toMatch(/النسخة المعتمدة/);
    expect(s.lib.file("a")).not.toBeNull();
  });

  it("يرفض أول نسخة لا تطابق pinSha", async () => {
    const s = mkLib([{ ...A, pinSha: "00000000" }], () => "v1");
    s.lib.list();
    await flush();
    const it1 = s.lib.list()[0]!;
    expect(it1.status).toBe("error");
    expect(it1.error).toMatch(/النسخة المعتمدة/);
    expect(s.lib.file("a")).toBeNull();
  });

  it("يلتزم بسقف مجموع الذاكرة", async () => {
    const big = "x".repeat(60);
    const s = mkLib([A, B], () => big, 100); // يتّسع لملف واحد فقط
    s.lib.list();
    await flush();
    const st = s.lib.list().map((i) => i.status).sort();
    expect(st).toEqual(["error", "ok"]);
  });

  it("LEGAL_CATALOG_EXTRA يقبل pinSha صالحاً فقط", () => {
    const cat = loadCatalog(
      {
        LEGAL_CATALOG_EXTRA: JSON.stringify([
          { title: "س", url: "https://csb.gov.jo/1.pdf", pinSha: "ABCDEF0123456789" },
          { title: "ص", url: "https://csb.gov.jo/2.pdf", pinSha: "zzz" },
        ]),
      },
      HOSTS,
    );
    const extra = cat.slice(DEFAULT_CATALOG.length);
    expect(extra[0]!.pinSha).toBe("abcdef0123456789");
    expect(extra[1]!.pinSha).toBeUndefined();
  });
});
