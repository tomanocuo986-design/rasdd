import { describe, it, expect } from "vitest";
import { assessRisk, draftObservations, observationLines, type AuditFinding } from "@/rasd/observations";

const f = (over: Partial<AuditFinding> = {}): AuditFinding => ({
  dataset: "Direct_Purchases_Orders",
  sector: "procurement",
  row: 0,
  test: "احتمال تجزئة مشتريات",
  detail: "2 أوامر لنفس المورد بنفس اليوم",
  ref: "PO-1",
  severity: "high",
  ...over,
});

describe("observations", () => {
  it("groups findings per test and fills condition, cause, legal basis and effect", () => {
    const [o] = draftObservations([f(), f({ row: 1, ref: "PO-2" })], { datasetLabel: () => "أوامر الشراء" });
    expect(o?.count).toBe(2);
    expect(o?.condition).toContain("PO-1");
    expect(o?.cause).toBeTruthy();
    expect(o?.effect).toBeTruthy();
    expect(o?.legalBasis.source).toBe("framework");
    expect(o?.legalBasis.needsVerification).toBe(true);
    expect(o?.legalBasis.text).toContain("نظام المشتريات الحكومية");
  });

  it("prefers the uploaded regulation as legal basis", () => {
    const [o] = draftObservations([f({ regulation: { doc: "نظام المشتريات", excerpt: "المادة 5 ..." } })]);
    expect(o?.legalBasis).toMatchObject({ source: "library", needsVerification: false });
    expect(o?.legalBasis.text).toContain("نظام المشتريات");
  });

  it("rates risk by impact, likelihood and repetition", () => {
    expect(assessRisk([f({ severity: "low" })]).rating).toBe("low");
    expect(assessRisk([f(), f()]).rating).toBe("high");
    const rep = assessRisk([f({ severity: "medium", repeat: { exact: true, report: "r" } }), f({ severity: "medium" })]);
    expect(rep.score).toBe(5);
  });

  it("sorts by risk and marks approved items", () => {
    const list = draftObservations(
      [f({ severity: "low", test: "تاريخ غير صالح" }), f()],
      { approved: new Set(["Direct_Purchases_Orders|احتمال تجزئة مشتريات"]) },
    );
    expect(list[0]?.status).toBe("approved");
    expect(list[0]?.risk.rating).toBe("high");
  });

  it("produces report lines", () => {
    const [o] = draftObservations([f()]);
    const lines = observationLines(o!, { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" });
    expect(lines.map((l) => l.split(":")[0])).toEqual(expect.arrayContaining(["الحالة", "السند القانوني", "السبب", "الأثر"]));
  });
});

describe("observation lines order", () => {
  it("numbers the observation and orders condition, legal basis, cause, effect", () => {
    const [o] = draftObservations([f()]);
    const lines = observationLines(o!, { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" }, 3);
    expect(lines[0]).toContain("ملاحظة رقابية 3");
    expect(lines.slice(1, 5).map((l) => l.split(":")[0])).toEqual(["الحالة", "السند القانوني", "السبب", "الأثر"]);
  });
});
