import { describe, it, expect, beforeEach } from "vitest";
import {
  buildCorpus,
  buildObservation,
  classifyObservation,
  compareObservation,
  extractAmount,
  normalizeArabic,
  reviewMemo,
  analyzeObservation,
} from "@/rasd/auditor-draft.js";
import { addManualObservation, getManualObservations, removeManualObservation } from "@/rasd/manual-observations";

const past = [
  {
    id: "r1",
    name: "تقرير المشتريات 2025-12-01",
    date: "2025-12-01",
    findings: [{ dataset: "Direct_Purchases_Orders", test: "احتمال تجزئة مشتريات", severity: "high", detail: "أوامر متتالية لنفس المورد", ref: "PO-1" }],
    observations: [
      {
        id: "Direct_Purchases_Orders|احتمال تجزئة مشتريات",
        dataset: "Direct_Purchases_Orders",
        test: "احتمال تجزئة مشتريات",
        condition: "رُصدت 3 حالة بعنوان احتمال تجزئة مشتريات: أوامر شراء متتالية لنفس المورد",
        recommendation: "ربط سقف الشراء المباشر بإجمالي المورد",
        risk: { rating: "high" },
        legalBasis: { source: "library", text: "نظام المشتريات: المادة 5", needsVerification: false },
      },
    ],
  },
  {
    id: "r2",
    name: "تقرير الصيانة 2026-03-01",
    date: "2026-03-01",
    findings: [{ dataset: "Maintenance_Orders", test: "تضخم تكلفة صيانة", severity: "medium", detail: "تكلفة الصيانة أعلى من متوسط الأسطول" }],
  },
];

beforeEach(() => localStorage.clear());

describe("normalizeArabic", () => {
  it("unifies letters, strips diacritics and converts Arabic digits", () => {
    expect(normalizeArabic("أَمْرُ الشِّرَاءِ ١٢٣")).toBe("امر الشراء 123");
    expect(normalizeArabic("مؤسسة")).toBe(normalizeArabic("مؤسسه"));
  });
});

describe("compareObservation", () => {
  const corpus = buildCorpus(past);

  it("finds a repeated observation in a previous report", () => {
    const c = compareObservation("لوحظ تجزئة مشتريات عبر أوامر شراء متتالية لنفس المورد", corpus);
    expect(c.matches[0]?.title).toBe("احتمال تجزئة مشتريات");
    expect(c.matches[0]?.report).toContain("المشتريات");
    expect(c.matches[0]?.score).toBeGreaterThan(0.35);
  });

  it("does not match an unrelated observation", () => {
    const c = compareObservation("عدم وجود لوحة إرشادية عند مدخل المبنى", corpus);
    expect(c.matches.length).toBe(0);
  });

  it("handles an empty corpus", () => {
    const c = compareObservation("أي ملاحظة", []);
    expect(c.matches).toEqual([]);
    expect(c.entries).toBe(0);
  });
});

describe("classifyObservation", () => {
  it("rates fraud wording as high with reasons", () => {
    const r = classifyObservation("وجود فاتورة وهمية وتلاعب في الصرف", { matches: [] });
    expect(r.severity).toBe("high");
    expect(r.reasons.join(" ")).toContain("دلالة عالية");
    expect(r.status).toBe("new");
  });

  it("rates cosmetic wording as low", () => {
    expect(classifyObservation("خطأ في ترقيم الصفحات وتنسيق الملف", { matches: [] }).severity).toBe("low");
  });

  it("raises severity for repetition and past severity", () => {
    const a = analyzeObservation("تجزئة مشتريات عبر أوامر شراء متتالية لنفس المورد", buildCorpus(past));
    expect(a.severity).toBe("high");
    expect(["recurring", "pattern"]).toContain(a.status);
  });

  it("raises severity for a large financial impact", () => {
    const small = classifyObservation("تأخر في تسوية السلف", { matches: [] });
    const big = classifyObservation("تأخر في تسوية السلف بمبلغ 60,000 دينار", { matches: [] });
    expect(small.severity).toBe("medium");
    expect(big.severity).toBe("high");
  });

  it("extracts amounts with currency words", () => {
    expect(extractAmount("صرف ٢٥٬٠٠٠ دينار")).toBeGreaterThan(0);
    expect(extractAmount("مبلغ 12,500 JD")).toBe(12500);
    expect(extractAmount("بدون مبلغ")).toBe(0);
  });
});

describe("build, store and memo", () => {
  it("builds an approved manual observation shaped like engine observations", () => {
    const analysis = analyzeObservation("تجزئة مشتريات عبر أوامر متتالية لنفس المورد", buildCorpus(past));
    const o = buildObservation({ text: "تجزئة مشتريات عبر أوامر متتالية لنفس المورد", sector: "procurement", analysis });
    expect(o).toMatchObject({ dataset: "manual", sector: "procurement", status: "approved", manual: true, count: 1 });
    expect(o.risk.rating).toBe(analysis.severity);
    expect(o.recommendation).toBeTruthy();
    expect(o.legalBasis.text).toBeTruthy();
  });

  it("persists manual observations and notifies subscribers", () => {
    const o = buildObservation({ text: "ملاحظة تجريبية عن تأخر التسوية", sector: "finance", severity: "low" });
    addManualObservation(o);
    expect(getManualObservations().map((x) => x.id)).toContain(o.id);
    removeManualObservation(o.id);
    expect(getManualObservations()).toHaveLength(0);
  });

  it("writes a review memo for the delete path", () => {
    const m = reviewMemo({ title: "عنوان", text: "نص الملاحظة", severity: "medium", sector: "المشتريات", reason: "مبرر موثق", matches: [] });
    expect(m).toContain("مذكرة مراجعة");
    expect(m).toContain("مبرر موثق");
    expect(m).toContain("المطلوب");
  });
});
