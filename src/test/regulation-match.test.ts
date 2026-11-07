import { describe, expect, it } from "vitest";
import { matchRegulation, segmentDoc, tokenMatch } from "@/rasd/regulation-match.js";

const doc = (name: string, text: string) => ({ id: name, name, segments: segmentDoc(text) });

describe("tokenMatch", () => {
  it("exact = 1, close derivative = 0.5, unrelated words sharing 4 letters = 0", () => {
    expect(tokenMatch("مشتريات", "مشتريات")).toBe(1);
    expect(tokenMatch("مشتريات", "مشتريه")).toBe(0.5);
    expect(tokenMatch("مشترك", "مشتريات")).toBe(0); // كانت تطابق سابقاً بأول 4 أحرف
    expect(tokenMatch("عقد", "عقود")).toBe(0); // أقل من 4 أحرف مشتركة: لا اشتقاق
  });
});

describe("matchRegulation", () => {
  const d = doc(
    "نظام المشتريات",
    "يحظر تجزئة المشتريات الحكومية لتفادي الحصول على الموافقة المطلوبة من اللجنة المختصة.",
  );

  it("matches an exact multi-word finding and reports confidence", () => {
    const m = matchRegulation("تجزئة المشتريات", [d]);
    expect(m?.docId).toBe("نظام المشتريات");
    expect(m?.confidence).toBe("high");
    expect(m?.matched).toBe(2);
    expect(m?.of).toBe(2);
  });

  it("does not attribute a legal basis from prefix-only similarity", () => {
    // «مشترك» ≠ «مشتريات» و«مباشر» ≈ «مباشرة»: لا تطابق تام لأي كلمة، فلا سند مقترح
    const other = doc("نظام آخر", "تتم مشتريات الجهة عبر الطرح مباشرة وفق الأصول المقررة في هذا النظام.");
    expect(matchRegulation("مشترك مباشر", [other])).toBeUndefined();
  });

  it("stop words containing ى/ة (على، إلى، مقارنة) are really excluded after normalization", () => {
    const withOn = doc("نظام", "تُحال الملاحظات على اللجنة المختصة ثم تُرفع إلى الوزير المختص بعد المراجعة.");
    expect(matchRegulation("على إلى مقارنة", [withOn])).toBeUndefined();
  });

  it("returns nothing for an empty or stop-word-only test", () => {
    expect(matchRegulation("من في على", [d])).toBeUndefined();
    expect(matchRegulation("", [d])).toBeUndefined();
  });
});
