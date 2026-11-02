import { describe, it, expect } from "vitest";
import { fraudFindings } from "@/rasd/advanced";
import { nationalIdKey, scoreMatch, levelOf } from "@/rasd/conflict-match.js";

const sectorOf = () => "s";
const party = (o: Record<string, string> = {}) => ({ nid: "", acct: "", phone: "", addr: "", nm: "", ...o });
const run = (store: Record<string, Record<string, string>[]>) => fraudFindings(store, sectorOf).filter((f: any) => f.test.includes("بين مورد وموظف"));

describe("national id normalisation", () => {
  it("accepts Arabic digits and separators, rejects employee numbers and short values", () => {
    expect(nationalIdKey("٩٩٠٠٠٠٠١٣٧")).toBe("9900000137");
    expect(nationalIdKey("9900 000-137")).toBe("9900000137");
    expect(nationalIdKey("E-100")).toBe("");
    expect(nationalIdKey("12345")).toBe("");
    expect(nationalIdKey("")).toBe("");
  });
});

describe("conflict confidence score", () => {
  it("returns null when nothing matches", () => {
    expect(scoreMatch(party({ phone: "791234567" }), party({ phone: "799999999" }))).toBeNull();
  });
  it("national id alone is high confidence", () => {
    const m = scoreMatch(party({ nid: "9900000137" }), party({ nid: "9900000137" }))!;
    expect(m.signals).toEqual(["nid"]);
    expect(m.confidence).toBe(0.95);
    expect(m.level).toBe("high");
  });
  it("signals accumulate but never reach 100%", () => {
    const one = scoreMatch(party({ phone: "1", nm: "a b" }), party({ phone: "1" }))!.confidence;
    const all = scoreMatch(
      party({ nid: "9900000137", acct: "JO1234", phone: "791234567", addr: "العقبة شارع الملك", nm: "سلمى العمري" }),
      party({ nid: "9900000137", acct: "JO1234", phone: "791234567", addr: "العقبة شارع الملك", nm: "سلمى العمري" }),
    )!;
    expect(one).toBe(0.7);
    expect(all.confidence).toBeGreaterThan(0.95);
    expect(all.confidence).toBeLessThan(1);
  });
  it("keeps the legacy severities: phone/account high, address/name medium, any two signals high", () => {
    expect(scoreMatch(party({ phone: "1" }), party({ phone: "1" }))!.level).toBe("high");
    expect(scoreMatch(party({ acct: "JO1234" }), party({ acct: "JO1234" }))!.level).toBe("high");
    expect(scoreMatch(party({ addr: "x".repeat(12) }), party({ addr: "x".repeat(12) }))!.level).toBe("medium");
    expect(scoreMatch(party({ nm: "a b" }), party({ nm: "a b" }))!.level).toBe("medium");
    expect(scoreMatch(party({ nm: "a b", addr: "x".repeat(12) }), party({ nm: "a b", addr: "x".repeat(12) }))!.level).toBe("high");
    expect(levelOf(0.3)).toBe("low");
  });
  it("different national ids sharply lower confidence; a bare name match is dropped", () => {
    const nameOnly = scoreMatch(party({ nm: "a b", nid: "9900000137" }), party({ nm: "a b", nid: "9900000999" }));
    expect(nameOnly).toBeNull();
    const phone = scoreMatch(party({ phone: "1", nid: "9900000137" }), party({ phone: "1", nid: "9900000999" }))!;
    expect(phone.conflictingNid).toBe(true);
    expect(phone.confidence).toBeLessThan(0.4);
  });
  it("a missing national id on one side is not a conflict", () => {
    const m = scoreMatch(party({ phone: "1", nid: "9900000137" }), party({ phone: "1" }))!;
    expect(m.conflictingNid).toBe(false);
    expect(m.confidence).toBe(0.7);
  });
});

describe("fraudFindings with national id", () => {
  it("matches a supplier's national id to a payroll employee and reports confidence", () => {
    const f = run({
      Direct_Purchases_Orders: [{ supplier: "مؤسسة الندى", supplier_national_id: "٩٩٠٠٠٠٠١٣٧" }],
      HR_Payroll_Sheets: [{ employee_no: "E-1", name: "سلمى العمري", national_id: "9900000137" }],
    });
    expect(f.length).toBe(1);
    expect(f[0].severity).toBe("high");
    expect(f[0].test).toContain("تطابق الرقم الوطني");
    expect(f[0].confidence).toBe(0.95);
    expect(f[0].detail).toContain("درجة الثقة 95%");
  });
  it("matches tender winners against daily wagers whose id_no is a national id", () => {
    const f = run({
      Tenders_Records: [{ winner: "مقاول فردي", winner_national_id: "9800000001" }],
      HR_Daily_Wagers: [{ id_no: "9800000001", name: "علي حسن" }],
    });
    expect(f.length).toBe(1);
    expect(f[0].dataset).toBe("Tenders_Records");
  });
  it("one finding per supplier-employee pair, combining signals", () => {
    const f = run({
      Direct_Purchases_Orders: [{ supplier: "سلمى العمري", supplier_national_id: "9900000137", supplier_phone: "0790000101" }],
      HR_Payroll_Sheets: [{ name: "سلمى العمري", national_id: "9900000137", phone: "0790000101" }],
    });
    expect(f.length).toBe(1);
    expect(f[0].test).toContain("متعدد المؤشرات");
    expect(f[0].confidence).toBeGreaterThan(0.95);
  });
  it("same name but different national ids is not reported", () => {
    const f = run({
      Direct_Purchases_Orders: [{ supplier: "محمد أحمد", supplier_national_id: "9900000111" }],
      HR_Payroll_Sheets: [{ name: "محمد أحمد", national_id: "9900000222" }],
    });
    expect(f.length).toBe(0);
  });
  it("flags one national id shared by different suppliers", () => {
    const f = fraudFindings(
      {
        Direct_Purchases_Orders: [
          { supplier: "شركة الأول", supplier_national_id: "9900000555" },
          { supplier: "شركة الثاني", supplier_national_id: "9900000555" },
        ],
      },
      sectorOf,
    );
    expect(f.filter((x: any) => x.test.includes("رقم وطني مشترك")).length).toBe(2);
  });
});
