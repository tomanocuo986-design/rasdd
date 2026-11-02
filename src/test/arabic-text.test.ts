import { describe, expect, it } from "vitest";
import { garbleRatio, isGarbled, looksReversed, normalizeArabic, repairArabic, repairKashida, unreverse } from "@/rasd/arabic-text.js";
import { matchRegulation, segmentDoc } from "@/rasd/workspace.jsx";
import { legalFrameworkOf } from "@/rasd/legal-framework";

// نمط الصورة: كشيدة مقروءة «ه» بطول ثابت (4) داخل الكلمات، وفي «تسهيل» ه حقيقية + الكشيدة (5)
const GARBLED = "يحظر تسهههههيل أي تجزئههههة لطلبههههات الشههههراء وإساءة استعمال إجراءات المشتريات الحكومية.";
const CLEAN = "يحظر تسهيل أي تجزئة لطلبات الشراء وإساءة استعمال إجراءات المشتريات الحكومية.";

describe("arabic PDF text repair", () => {
  it("detects the repeated-letter damage and repairs it", () => {
    expect(isGarbled(GARBLED)).toBe(true);
    expect(isGarbled(CLEAN)).toBe(false);
    expect(repairKashida(GARBLED)).toBe(CLEAN);
    expect(garbleRatio(repairArabic(GARBLED))).toBe(0);
  });

  it("is idempotent, so documents stored before the fix are repaired on load", () => {
    expect(repairArabic(repairArabic(GARBLED))).toBe(repairArabic(GARBLED));
    expect(repairArabic(CLEAN)).toBe(CLEAN);
  });

  it("converts presentation forms back to plain letters", () => {
    expect(normalizeArabic("ﺍﻟﻤﺸﺘﺮﻳﺎﺕ")).toBe("المشتريات");
    expect(normalizeArabic("\u202Bنظام\u202C  الشراء")).toBe("نظام الشراء");
  });

  it("restores text extracted in reversed visual order, keeping numbers readable", () => {
    const logical = "الالتزام بالقواعد في الشراء المباشر لا يجوز التجزئة ولا الاستثناء إلا بقرار حسب المادة 25 من النظام في البلدية والوزارة والدائرة";
    const reversed = unreverse(logical);
    expect(looksReversed(reversed)).toBe(true);
    expect(looksReversed(logical)).toBe(false);
    expect(repairArabic(reversed)).toBe(logical);
  });

  it("never lets a damaged excerpt become a legal basis", () => {
    const docs = [{ id: "d", name: "نظام_المشتريات", segments: segmentDoc(`${GARBLED}\nالمادة 5: يجب الإعلان عن العطاءات الكبرى في صحيفتين محليتين يوميتين.`) }];
    const hit = matchRegulation("احتمال تجزئة مشتريات", docs);
    expect(hit?.excerpt ?? "").not.toMatch(/(.)\1{2}/);
    // تلف لا تصلحه القواعد (أطوال تكرار متباينة): المقطع يُحجب فلا يُعرض نص مشوّه، ويُستعمل السند المدمج السليم
    const mixed = "تجزئههه المشتريات ؛ تسههه المشتريات ؛ شراءههه المشتريات ؛ يحظر تجزئههههههههههههههة لطلبات الشراء في المشتريات العامة";
    expect(isGarbled(repairArabic(mixed))).toBe(true);
    const bad = [{ id: "d", name: "x", segments: segmentDoc(mixed.replaceAll(" ؛ ", "\n")) }];
    expect(bad[0].segments.every((g: { text: string }) => !/(.)\1{2}/.test(g.text))).toBe(true);
    expect(matchRegulation("احتمال تجزئة مشتريات", bad)?.excerpt ?? "").not.toMatch(/(.)\1{2}/);
    expect(legalFrameworkOf({ test: "احتمال تجزئة مشتريات", dataset: "Direct_Purchases_Orders" })?.text).toMatch(/نظام المشتريات/);
  });

  it("repairs a stored document so its segments match again", () => {
    const docs = [{ id: "d", name: "نظام", segments: segmentDoc(`المادة 7: يحظر تجزئة المشتريات بقصد التهرب من الطرح التنافسي. ${GARBLED}`) }];
    const hit = matchRegulation("احتمال تجزئة مشتريات", docs);
    expect(hit).toBeDefined();
    expect(isGarbled(hit!.excerpt)).toBe(false);
  });
});
