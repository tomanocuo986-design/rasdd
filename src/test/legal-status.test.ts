import { describe, expect, it } from "vitest";
import {
  STALE_YEARS,
  basisStatus,
  docFreshness,
  linkKey,
  linkedRegulation,
  loadLinks,
  loadOverrides,
  needsConfirmation,
  recordOverrides,
  saveLinks,
} from "@/rasd/legal-status";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const obs = (source: "library" | "framework" | "default", id = "DS|اختبار") => ({
  id,
  legalBasis: { source, text: "x", needsVerification: source === "framework" },
});

describe("legal-status", () => {
  it("maps the basis source to a status", () => {
    expect(basisStatus(obs("library"))).toBe("library");
    expect(basisStatus(obs("framework"))).toBe("framework");
    expect(basisStatus(obs("default"))).toBe("none");
  });

  it("requires confirmation only when the basis is not from the library", () => {
    expect(needsConfirmation(obs("library"), [])).toBe(false);
    expect(needsConfirmation(obs("framework"), [])).toBe(true);
    expect(needsConfirmation(obs("default"), [])).toBe(true);
  });

  it("records an explicit confirmation and remembers it per observation and status", () => {
    const st = mem();
    const o = obs("framework");
    recordOverrides([o], "approve", st, new Date("2026-11-02T10:00:00Z"));
    const list = loadOverrides(st);
    expect(list).toEqual([{ id: o.id, status: "framework", action: "approve", at: "2026-11-02T10:00:00.000Z" }]);
    expect(needsConfirmation(o, list)).toBe(false);
    // the basis got worse (no basis any more): a new confirmation is needed
    expect(needsConfirmation(obs("default"), list)).toBe(true);
    // another observation is unaffected
    expect(needsConfirmation(obs("framework", "DS|آخر"), list)).toBe(true);
  });

  it("manual links become a regulation match with the auditor's article text", () => {
    const st = mem();
    const key = linkKey("Direct_Purchases_Orders", " احتمال تجزئة مشتريات ");
    saveLinks({ [key]: { docId: "d1", doc: "نظام المشتريات", article: "المادة 12", excerpt: "نص المادة", at: "2026-11-02" } }, st);
    const links = loadLinks(st);
    expect(linkedRegulation(links, "Direct_Purchases_Orders", "احتمال تجزئة مشتريات")).toEqual({
      doc: "نظام المشتريات",
      docId: "d1",
      excerpt: "المادة 12 — نص المادة",
    });
    expect(linkedRegulation(links, "Direct_Purchases_Orders", "اختبار آخر")).toBeUndefined();
  });

  it("ignores a link without excerpt text and tolerates corrupt storage", () => {
    const links = { "A|b": { docId: "d", doc: "n", article: "المادة 1", excerpt: "  ", at: "" } };
    expect(linkedRegulation(links, "A", "b")).toBeUndefined();
    const bad = { getItem: () => "{not json", setItem: () => {} };
    expect(loadLinks(bad)).toEqual({});
    expect(loadOverrides(bad)).toEqual([]);
  });

  it("flags missing or old effective dates of library files", () => {
    const now = new Date("2026-11-02");
    expect(docFreshness({}, now).state).toBe("unknown");
    expect(docFreshness({ effectiveDate: "خطأ" }, now).state).toBe("unknown");
    expect(docFreshness({ effectiveDate: "2025-06-01" }, now).state).toBe("ok");
    const old = docFreshness({ effectiveDate: "2019-01-01" }, now);
    expect(old.state).toBe("old");
    expect(old.label).toContain(String(STALE_YEARS));
  });
});
