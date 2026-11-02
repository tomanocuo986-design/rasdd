import { describe, it, expect } from "vitest";
import { sodFindings, fraudFindings, riskSample } from "@/rasd/advanced";

const sectorOf = () => "s";

describe("advanced audit", () => {
  it("flags one person entering, approving and paying", () => {
    const f = sodFindings(
      { Payment_Vouchers: [{ entered_by: "أحمد علي", approver: "أحمد علي", paid_by: "أحمد علي" }] },
      sectorOf,
    );
    expect(f.some((x) => x.severity === "high")).toBe(true);
  });

  it("matches supplier and employee phone and bank account", () => {
    const f = fraudFindings(
      {
        Direct_Purchases_Orders: [{ supplier: "شركة النور", supplier_phone: "0791234567" }],
        HR_Payroll_Sheets: [{ name: "عمر حسن", phone: "٠٧٩١٢٣٤٥٦٧" }],
      },
      sectorOf,
    );
    expect(f.some((x) => x.severity === "high")).toBe(true);
  });

  it("samples top values, outliers and a random slice", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ amount: String(i === 7 ? 9999 : 10 + i) }));
    const r = riskSample({ key: "X", fields: [{ key: "amount", type: "number" }] }, rows, new Map(), {
      topPct: 20,
      randomPct: 10,
      seed: 1,
    });
    expect(r.picked.length).toBeGreaterThanOrEqual(10);
    expect(r.picked.some((p) => p.reasons.includes("outlier"))).toBe(true);
  });
});
