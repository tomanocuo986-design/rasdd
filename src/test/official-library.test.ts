import { describe, expect, it, vi } from "vitest";
import {
  OFFICIAL_PREFIX,
  isOfficialDoc,
  syncOfficialLibrary,
  syncSummary,
} from "@/rasd/official-library";
import type { OfficialDoc } from "@/rasd/official-library";

type Doc = OfficialDoc;

function setup(opts: {
  items: () => unknown[];
  enabled?: boolean;
  existing?: Doc[];
  downloadOk?: boolean;
}) {
  const db = new Map<string, Doc>((opts.existing ?? []).map((d) => [d.id, d]));
  const extract = vi.fn(async (file: File) => ({
    text: `نص ${file.name}`,
    garbledPages: [],
    ocrPages: [],
    repairedPages: [],
  }));
  const fetchImpl = vi.fn(async (url: string) => {
    if (url === "/api/legal-library")
      return new Response(JSON.stringify({ enabled: opts.enabled ?? true, items: opts.items() }), {
        status: 200,
      });
    if (opts.downloadOk === false) return new Response("{}", { status: 404 });
    return new Response(new Blob(["%PDF-1.7"], { type: "application/pdf" }), { status: 200 });
  });
  const deps = {
    fetchImpl,
    listRegulations: async () => [...db.values()],
    saveRegulation: async (d: Doc) => void db.set(d.id, d),
    deleteRegulation: async (id: string) => void db.delete(id),
    extractPdfPages: extract,
    sleep: async () => {},
    pollMs: 0,
    maxPolls: 5,
  };
  return { db, extract, fetchImpl, deps };
}

const item = (id: string, sha: string | undefined, extra: Record<string, unknown> = {}) => ({
  id,
  title: `نظام ${id}`,
  site: "موقع رسمي",
  url: `https://www.gtd.gov.jo/${id}.pdf`,
  status: "ok",
  sha,
  fetchedAt: "2026-11-07T10:00:00.000Z",
  ...extra,
});

describe("syncOfficialLibrary", () => {
  it("adds new official documents with their text, source note and flag", async () => {
    const s = setup({ items: () => [item("a", "s1"), item("b", "s2")] });
    const r = await syncOfficialLibrary(s.deps);
    expect(r).toMatchObject({ added: 2, updated: 0, failed: 0, pending: 0 });
    const a = s.db.get(`${OFFICIAL_PREFIX}a`)!;
    expect(a.official).toBe(true);
    expect(a.name).toBe("نظام a");
    expect(a.text).toContain("نظام a");
    expect(a.sha).toBe("s1");
    expect(a.sourceNote).toContain("https://www.gtd.gov.jo/a.pdf");
    expect(a.sourceNote).toContain("2026-11-07");
    expect(isOfficialDoc(a)).toBe(true);
    expect(isOfficialDoc({ id: "x" })).toBe(false);
  });

  it("does not read a document again while its sha is unchanged", async () => {
    const s = setup({ items: () => [item("a", "s1")] });
    await syncOfficialLibrary(s.deps);
    await syncOfficialLibrary(s.deps);
    expect(s.extract).toHaveBeenCalledTimes(1);
  });

  it("re-reads on a new sha but keeps the effective date the auditor entered", async () => {
    let sha = "s1";
    const s = setup({ items: () => [item("a", sha)] });
    await syncOfficialLibrary(s.deps);
    s.db.set(`${OFFICIAL_PREFIX}a`, {
      ...s.db.get(`${OFFICIAL_PREFIX}a`)!,
      effectiveDate: "2022-06-01",
    });
    sha = "s2";
    const r = await syncOfficialLibrary(s.deps);
    expect(r.updated).toBe(1);
    expect(s.db.get(`${OFFICIAL_PREFIX}a`)!.sha).toBe("s2");
    expect(s.db.get(`${OFFICIAL_PREFIX}a`)!.effectiveDate).toBe("2022-06-01");
  });

  it("re-saves a document when only its title changed, keeping the text source and the entered date", async () => {
    let title = "نظام قديم";
    const s = setup({ items: () => [item("a", "s1", { title })] });
    await syncOfficialLibrary(s.deps);
    s.db.set(`${OFFICIAL_PREFIX}a`, {
      ...s.db.get(`${OFFICIAL_PREFIX}a`)!,
      effectiveDate: "2024-01-01",
    });
    title = "نظام بعنوان جديد";
    const r = await syncOfficialLibrary(s.deps);
    expect(r.updated).toBe(1);
    expect(s.db.get(`${OFFICIAL_PREFIX}a`)!.name).toBe("نظام بعنوان جديد");
    expect(s.db.get(`${OFFICIAL_PREFIX}a`)!.effectiveDate).toBe("2024-01-01");
  });

  it("removes official documents that left the catalog but never touches user uploads", async () => {
    const s = setup({
      items: () => [item("a", "s1")],
      existing: [
        { id: `${OFFICIAL_PREFIX}gone`, official: true, name: "قديم", text: "x" },
        { id: "user-upload-1", name: "ملف المدقق", text: "y" },
      ],
    });
    await syncOfficialLibrary(s.deps);
    expect(s.db.has(`${OFFICIAL_PREFIX}gone`)).toBe(false);
    expect(s.db.has("user-upload-1")).toBe(true);
  });

  it("waits for items the server is still fetching", async () => {
    let n = 0;
    const s = setup({
      items: () => {
        n++;
        return n < 3 ? [item("a", "", { status: "pending", sha: undefined })] : [item("a", "s1")];
      },
    });
    const r = await syncOfficialLibrary(s.deps);
    expect(r.added).toBe(1);
    expect(r.pending).toBe(0);
  });

  it("does nothing when the library is disabled or the user is not signed in", async () => {
    const s = setup({ items: () => [item("a", "s1")], enabled: false });
    expect((await syncOfficialLibrary(s.deps)).enabled).toBe(false);
    expect(s.db.size).toBe(0);
    const unauth = { ...s.deps, fetchImpl: async () => new Response("{}", { status: 401 }) };
    expect(await syncOfficialLibrary(unauth)).toMatchObject({ added: 0, failed: 0 });
  });

  it("counts a failed download once and does not save a document without text", async () => {
    const s = setup({ items: () => [item("a", "s1")], downloadOk: false });
    const r = await syncOfficialLibrary(s.deps);
    expect(r.failed).toBe(1);
    expect(s.db.size).toBe(0);
  });

  it("does not wipe the local official library when the server returns an empty list", async () => {
    const existing: Doc[] = [{ id: `${OFFICIAL_PREFIX}a`, official: true, name: "نظام a", text: "x", sha: "s1" }];
    const s = setup({ items: () => [], existing });
    await syncOfficialLibrary(s.deps);
    expect(s.db.has(`${OFFICIAL_PREFIX}a`)).toBe(true);
  });

  it("counts items the server failed to fetch as failed (once)", async () => {
    const s = setup({ items: () => [item("a", undefined, { status: "error" })], maxPolls: 3 } as never);
    const r = await syncOfficialLibrary(s.deps);
    expect(r.failed).toBe(1);
  });

  it("rejects a file whose x-sha differs from the listed sha", async () => {
    const s = setup({ items: () => [item("a", "s1")] });
    s.deps.fetchImpl.mockImplementation(async (url: string) =>
      url === "/api/legal-library"
        ? new Response(JSON.stringify({ enabled: true, items: [item("a", "s1")] }), { status: 200 })
        : new Response(new Blob(["%PDF-1.7"]), { status: 200, headers: { "x-sha": "other" } }),
    );
    const r = await syncOfficialLibrary(s.deps);
    expect(r.failed).toBe(1);
    expect(s.db.size).toBe(0);
  });
});

describe("needs-review items", () => {
  it("counts ok items that carry a warning and says so in the summary", async () => {
    const s = setup({ items: () => [item("a", "s1", { warning: "تغيّر الملف على الموقع الرسمي عن النسخة المعتمدة." }), item("b", "s2")] });
    const r = await syncOfficialLibrary(s.deps);
    expect(r.review).toBe(1);
    expect(syncSummary(r)).toContain("تحتاج مراجعة 1");
  });
});

describe("syncSummary", () => {
  it("summarizes in Arabic and stays silent when nothing happened", () => {
    expect(syncSummary({ added: 2, updated: 1, failed: 0, pending: 0, enabled: true })).toBe(
      "الأنظمة الرسمية: أُضيف 2، حُدّث 1.",
    );
    expect(syncSummary({ added: 0, updated: 0, failed: 0, pending: 0, enabled: true })).toBe("");
    expect(syncSummary({ added: 1, updated: 0, failed: 0, pending: 0, enabled: false })).toBe("");
  });
});
