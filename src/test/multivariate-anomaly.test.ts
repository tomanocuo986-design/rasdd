import { describe, it, expect } from "vitest";
import { makeRng, fitIsolationForest, scoreIsolationForest } from "@/rasd/isolation-forest.js";
import { multivariateFindings, MV_SUPPLIER_TEST } from "@/rasd/multivariate-anomaly.js";

const f = (key: string, label: string, type = "text") => ({ key, label, type });
const DS = [
  { key: "Direct_Purchases_Orders", fields: [f("po_no", "رقم"), f("date", "التاريخ", "date"), f("supplier", "المورد"), f("value", "القيمة", "number"), f("approver", "الموافق"), f("entered_by", "المدخل"), f("received_by", "المستلم")] },
];
function store(withShadow: boolean) {
  const r = makeRng(7);
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < 300; i++)
    rows.push({ po_no: `P${i}`, date: `2026-0${1 + Math.floor(i / 60)}-${String(1 + (i % 28)).padStart(2, "0")}`, supplier: `مورد ${1 + Math.floor(r() * 30)}`, value: String(Math.round(500 + r() * 4000)), approver: `م${1 + Math.floor(r() * 4)}`, entered_by: `أ${1 + Math.floor(r() * 5)}`, received_by: `ب${1 + Math.floor(r() * 5)}` });
  if (withShadow) for (let i = 0; i < 14; i++) rows.push({ po_no: `X${i}`, date: `2026-03-${String(1 + i).padStart(2, "0")}`, supplier: "شركة الظل", value: "19800", approver: "م1", entered_by: "س", received_by: "س" });
  return { Direct_Purchases_Orders: rows };
}

describe("isolation forest", () => {
  it("is deterministic and scores an obvious outlier highest", () => {
    const r = makeRng(3);
    const X = Array.from({ length: 200 }, () => [r(), r()]);
    X.push([40, 40]);
    const a = scoreIsolationForest(fitIsolationForest(X, { seed: 1 }), X);
    const b = scoreIsolationForest(fitIsolationForest(X, { seed: 1 }), X);
    expect(a).toEqual(b);
    expect(a.indexOf(Math.max(...a))).toBe(200);
    expect(a[200]).toBeGreaterThan(0.7);
  });
});

describe("multivariate findings", () => {
  it("flags a planted supplier with an explanation, and nothing on clean data", () => {
    const p = { directPurchaseCeiling: 20000 };
    const out = multivariateFindings(store(true), DS, () => "s", p, []);
    expect(out.length).toBe(1);
    expect(out[0].test).toBe(MV_SUPPLIER_TEST);
    expect(out[0].detail).toContain("شركة الظل");
    expect(out[0].detail).toContain("السمات التي حرّكتها");
    expect(multivariateFindings(store(false), DS, () => "s", p, [])).toEqual([]);
  });
  it("can be switched off, and skips small tables", () => {
    expect(multivariateFindings(store(true), DS, () => "s", { multivariate: 0 }, [])).toEqual([]);
    const small = { Direct_Purchases_Orders: store(true).Direct_Purchases_Orders.slice(0, 20) };
    expect(multivariateFindings(small, DS, () => "s", {}, [])).toEqual([]);
  });
});
