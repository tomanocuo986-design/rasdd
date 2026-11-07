import { describe, expect, it } from "vitest";
import { auditSectors } from "@/rasd/workspace.jsx";
import { linesToRows } from "@/rasd/pdf-rows.js";

describe("activities", () => {
  it("has seven activities", () => expect(auditSectors).toHaveLength(7));
  it("advances stays fifth", () => expect(auditSectors[4]?.key).toBe("advances"));
  it("sixth is purchase orders", () =>
    expect(auditSectors[5]?.datasets[0]?.key).toBe("Direct_Purchases_Orders"));
  it("seventh is tenders", () => expect(auditSectors[6]?.key).toBe("tenders"));
  it("finance has the revenue inputs and tenders has the engineering inputs", () => {
    const keys = (k: string) => auditSectors.find((s) => s.key === k)!.datasets.map((d) => d.key);
    expect(keys("finance")[0]).toBe("Receipt_Vouchers");
    expect(keys("finance")).toEqual(expect.arrayContaining(["Revenue_Profession_Licenses", "Revenue_Property_Taxes_Regulation", "Revenue_Municipal_Properties_Leases", "Revenue_Daily_Fees"]));
    expect(keys("tenders")[0]).toBe("Tenders_Records");
    expect(keys("tenders")).toEqual(expect.arrayContaining(["Engineering_BoQ_Master", "Engineering_Site_Handover_Minutes", "Engineering_Progress_Payments", "Engineering_Time_Extensions_Variations"]));
    expect(keys("hr").some((k) => /Revenue_|Engineering_/.test(k))).toBe(false);
  });
});

describe("pdf rows", () => {
  it("maps header row to fields", () => {
    const fields = [
      { key: "a", label: "رقم", type: "text" },
      { key: "b", label: "المبلغ", type: "number" },
    ];
    expect(linesToRows([["رقم", "المبلغ"], ["1", "50"]], fields)).toEqual([{ رقم: "1", المبلغ: "50" }]);
  });
});
