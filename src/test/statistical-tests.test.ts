import { describe, it, expect } from "vitest";
import {
  BENFORD,
  benfordTest,
  firstDigit,
  roundNumberBunching,
  thresholdFindings,
  duplicateFindings,
  supplierRiskScores,
  statisticalFindings,
} from "@/rasd/statistical-tests.js";

const sectorOf = () => "s";
const DS = [{ key: "Direct_Purchases_Orders", fields: [{ key: "value", label: "القيمة", type: "number" }] }];

// عينة تتبع بنفورد بالضبط (حتمية)
function benfordSample(n: number) {
  const out: number[] = [];
  BENFORD.forEach((p, i) => {
    const c = Math.round(p * n);
    for (let k = 0; k < c; k++) out.push((i + 1) * 1000 + k);
  });
  return out;
}

describe("Benford", () => {
  it("first digit", () => {
    expect(firstDigit(4521)).toBe(4);
    expect(firstDigit(0.0073)).toBe(7);
    expect(firstDigit(-912)).toBe(9);
  });
  it("conforming data passes, uniform-digit data is flagged", () => {
    const good = benfordTest(benfordSample(1000));
    expect(good!.chi2).toBeLessThan(5);
    const uniform = Array.from({ length: 900 }, (_, i) => ((i % 9) + 1) * 1000 + i);
    const bad = benfordTest(uniform)!;
    expect(bad.chi2).toBeGreaterThan(20.09);
    expect(bad.mad).toBeGreaterThan(0.015);
  });
  it("refuses small samples instead of guessing", () => {
    expect(benfordTest([100, 200, 300])).toBeNull();
  });
  it("engine flags a uniform dataset but not a Benford one", () => {
    const rows = (vals: number[]) => vals.map((v) => ({ value: String(v) }));
    const uniform = Array.from({ length: 900 }, (_, i) => ((i % 9) + 1) * 1000 + i);
    const f1 = statisticalFindings({ Direct_Purchases_Orders: rows(uniform) }, DS, sectorOf, {});
    expect(f1.some((f) => f.test.includes("قانون بنفورد"))).toBe(true);
    const f2 = statisticalFindings({ Direct_Purchases_Orders: rows(benfordSample(1000)) }, DS, sectorOf, {});
    expect(f2.some((f) => f.test.includes("قانون بنفورد"))).toBe(false);
  });
});

describe("threshold clustering", () => {
  it("flags orders just under the ceiling, high when the same supplier repeats", () => {
    const store = {
      Direct_Purchases_Orders: [
        { supplier: "شركة الأمل", value: "19800" },
        { supplier: "شركة الأمل", value: "19900" },
        { supplier: "مؤسسة النور", value: "19500" },
        { supplier: "شركة البناء", value: "5000" },
      ],
    };
    const f = thresholdFindings(store, DS, sectorOf, { directPurchaseCeiling: 20000 });
    expect(f).toHaveLength(3);
    expect(f.filter((x) => x.severity === "high")).toHaveLength(2);
    expect(f.find((x) => x.severity === "medium")!.detail).toContain("مؤسسة النور");
  });
  it("no ceiling configured: no ceiling findings", () => {
    const f = thresholdFindings({ Direct_Purchases_Orders: [{ supplier: "أ ب", value: "19900" }] }, DS, sectorOf, {});
    expect(f).toHaveLength(0);
  });
  it("detects bunching under a round number without any configuration", () => {
    const vals = [...Array.from({ length: 30 }, (_, i) => 1200 + i * 137), 9600, 9700, 9800, 9900];
    const b = roundNumberBunching(vals);
    expect(b).toMatchObject({ R: 10000, below: 4 });
    expect(roundNumberBunching(Array.from({ length: 40 }, (_, i) => 100 + i * 211))).toBeNull();
  });
});

describe("duplicate amounts", () => {
  it("same supplier + same amount: medium on different dates, high when close or same PO number", () => {
    const store = {
      Direct_Purchases_Orders: [
        { po_no: "P1", supplier: "شركة الأمل", value: "4500", date: "2025-01-05" },
        { po_no: "P2", supplier: "شركة الأمل", value: "4500", date: "2025-09-01" },
        { po_no: "P3", supplier: "شركة النور", value: "800", date: "2025-03-01" },
        { po_no: "P4", supplier: "شركة النور", value: "800", date: "2025-03-10" },
        { po_no: "P9", supplier: "شركة الدار", value: "300", date: "2025-02-01" },
        { po_no: "P9", supplier: "شركة الدار", value: "300", date: "2025-06-01" },
        { po_no: "P5", supplier: "شركة الدار", value: "301", date: "2025-02-01" },
      ],
    };
    const f = duplicateFindings(store, sectorOf);
    expect(f).toHaveLength(3);
    const sev = Object.fromEntries(f.map((x) => [x.row, x.severity]));
    expect(sev[1]).toBe("medium");
    expect(sev[3]).toBe("high");
    expect(sev[5]).toBe("high");
  });
});

describe("supplier anomaly score", () => {
  const mk = (supplier: string, v: number, n = 1) => Array.from({ length: n }, () => ({ supplier, value: String(v) }));
  it("a dominant supplier with repeated round amounts near the ceiling scores high, ordinary ones stay low", () => {
    const store = {
      Direct_Purchases_Orders: [
        ...mk("مورد مهيمن", 19900, 4),
        ...mk("مورد أ ب", 1230),
        ...mk("مورد ج د", 980, 2),
        ...mk("مورد هـ و", 1410),
        ...mk("مورد ز ح", 760),
        ...mk("مورد ط ي", 1120),
      ],
    };
    const scores = supplierRiskScores(store, { directPurchaseCeiling: 20000 });
    const top = scores.sort((a, b) => b.score - a.score)[0];
    expect(top.supplier).toBe("مورد مهيمن");
    expect(top.score).toBeGreaterThanOrEqual(60);
    expect(top.reasons.length).toBeGreaterThanOrEqual(2);
    expect(scores.filter((s) => s.supplier !== "مورد مهيمن").every((s) => s.score < 40)).toBe(true);
    const f = statisticalFindings(store, DS, sectorOf, { directPurchaseCeiling: 20000 });
    expect(f.some((x) => x.test.includes("درجة شذوذ") && x.severity === "high")).toBe(true);
  });
  it("clean data produces no statistical findings", () => {
    const store = { Direct_Purchases_Orders: Array.from({ length: 12 }, (_, i) => ({ po_no: `P${i}`, supplier: `مورد رقم ${i}`, value: String(1000 + i * 173), date: "2025-01-0" + (1 + (i % 9)) })) };
    expect(statisticalFindings(store, DS, sectorOf, { directPurchaseCeiling: 20000 })).toHaveLength(0);
  });
  it("malformed tables never throw", () => {
    expect(() => statisticalFindings({ Direct_Purchases_Orders: [null, {}, { value: "abc" }] as any }, DS, sectorOf, {})).not.toThrow();
  });
});
