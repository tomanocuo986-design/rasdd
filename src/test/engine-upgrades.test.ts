// @ts-nocheck
import { describe, expect, it } from "vitest";
import { advancedFindings, agingSummary, parseStamp } from "../rasd/advanced-queries";
import { calibrateSeverity, defaultCalibration } from "../rasd/severity";
import { buildHistoryIndex, classifyFindings, resolvedFindings, findingKey, extractRecommendations } from "../rasd/history";
import { legalFrameworkOf } from "../rasd/legal-framework";
import { partitionRecords } from "../rasd/validation";
import { buildLetters, letterHtml } from "../rasd/letters";
import { runAudit, auditSectors } from "../rasd/workspace";

const sectorOf = (k: string) => auditSectors.find((s) => s.datasets.some((d) => d.key === k))?.key;
const NOW = Date.UTC(2026, 9, 26);

describe("advanced queries", () => {
  it("flags receivables older than a year as high", () => {
    const store = { Revenue_Daily_Fees: [{ date: "2024-01-01", amount_due: "500", amount_collected: "0", collector: "أحمد" }] };
    const f = advancedFindings(store, sectorOf, {}, NOW);
    expect(f.find((x) => x.test.includes("تقادم"))?.severity).toBe("high");
    expect(agingSummary(store, NOW).overYear).toBe(500);
  });
  it("detects committee member who is the winner", () => {
    const store = { Tenders_Records: [{ tender_no: "T1", committee: "خالد محمد العلي، سامر يوسف", winner: "خالد محمد العلي" }] };
    expect(advancedFindings(store, sectorOf, {}, NOW).some((x) => x.test.includes("تعارض مصالح"))).toBe(true);
  });
  it("detects split purchases in a window", () => {
    const row = (d) => ({ po_no: d, date: d, supplier: "شركة النور للتجارة", value: "900" });
    const store = { Direct_Purchases_Orders: [row("2026-03-01"), row("2026-03-03"), row("2026-03-05")] };
    expect(advancedFindings(store, sectorOf, { splitWindowDays: 7 }, NOW).some((x) => x.test.includes("تجزئة"))).toBe(true);
  });
  it("parses Friday/Saturday deterministically", () => {
    expect(parseStamp("2026-10-23")?.day).toBe(5);
  });
});

describe("severity calibration", () => {
  it("escalates by recurrence and impact, never lowers", () => {
    expect(calibrateSeverity("low", { exactCount: 1 }, defaultCalibration).severity).toBe("medium");
    expect(calibrateSeverity("medium", { amount: 25000 }, defaultCalibration).severity).toBe("high");
    expect(calibrateSeverity("high", {}, defaultCalibration).severity).toBe("high");
    expect(calibrateSeverity("low", { amount: 1 }, defaultCalibration).severity).toBe("low");
  });
});

describe("history", () => {
  const reports = [{ name: "تقرير 2025", date: "2025-12-01", findings: [{ dataset: "A", test: "t1", ref: "1", severity: "low" }, { dataset: "A", test: "t2", ref: "2", severity: "low" }] }];
  it("classifies new / recurring / resolved", () => {
    const idx = buildHistoryIndex(reports);
    const cur = classifyFindings([{ dataset: "A", test: "t1", ref: "1", key: findingKey("A", "t1", "1") }, { dataset: "A", test: "t3", ref: "9", key: findingKey("A", "t3", "9") }], idx);
    expect(cur.map((c) => c.history.status)).toEqual(["recurring", "new"]);
    const r = resolvedFindings(idx, new Set(cur.map((c) => c.key)), new Set(["A"]));
    expect(r.resolved.map((x) => x.test)).toEqual(["t2"]);
  });
  it("extracts recommendations", () => {
    expect(extractRecommendations(["ملاحظة رقابية 1: تجزئة — مخاطر مرتفعة", "التوصية: طرح عطاء"])).toEqual([{ test: "تجزئة", text: "طرح عطاء" }]);
  });
});

describe("legal framework, validation, letters", () => {
  it("attaches legal basis to every sector's findings", () => {
    for (const d of ["Direct_Purchases_Orders", "HR_Payroll_Sheets", "Fleet_Maintenance", "Warehouses_Obsolete", "Advances_Temporary", "Receipt_Vouchers", "Tenders_Records"])
      expect(legalFrameworkOf({ dataset: d, test: "x" })?.needsVerification).toBe(true);
  });
  it("rejects records missing essential fields", () => {
    const ds = auditSectors.flatMap((s) => s.datasets).find((d) => d.key === "Direct_Purchases_Orders");
    const p = partitionRecords(ds, [{ po_no: "1", date: "2026-01-01", supplier: "س", value: "5" }, { po_no: "2" }]);
    expect(p.accepted).toHaveLength(1);
    expect(p.rejected[0].missing).toContain("اسم المورد");
  });
  it("audit flags missing required fields (no disabled checks)", () => {
    const out = runAudit({ Receipt_Vouchers: [{ voucher_no: "1" }] }, NOW, undefined);
    expect(out.some((f) => f.test === "حقل جوهري ناقص")).toBe(true);
  });
  it("builds an official letter with legal basis and records", () => {
    const obs = [{ sector: "procurement", dataset: "Direct_Purchases_Orders", test: "تجزئة", status: "approved", risk: { rating: "high" }, condition: "ح", cause: "س", effect: "أ", recommendation: "ت", legalBasis: { text: "نظام", needsVerification: true, source: "framework" } }];
    const fs = [{ dataset: "Direct_Purchases_Orders", test: "تجزئة", row: 0, ref: "PO-1", detail: "د", impact: 100 }];
    const [l] = buildLetters(obs, fs, auditSectors, {}, { approvedOnly: true });
    expect(letterHtml(l)).toContain("PO-1");
    expect(letterHtml(l)).toContain("نظام");
  });
});
