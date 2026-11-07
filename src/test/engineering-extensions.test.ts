import { describe, expect, it } from "vitest";
import { runAudit } from "@/rasd/workspace.jsx";

const T = Date.parse("2026-11-01");
const NO_REASON = "تمديد مدة دون سبب موثق";
const CUMULATIVE = "تمديدات متراكمة تتجاوز النسبة المسموحة من مدة العقد";

const ext = (o: Record<string, string>) => ({ project_no: "P1", request_no: "R", type: "تمديد مدة", date: "2026-03-01", extension_days: "", variation_value: "", approved: "نعم", approved_by: "المجلس", reason: "ظروف جوية", ...o });
const hand = (o: Record<string, string> = {}) => ({ project_no: "P1", contractor: "م", handover_date: "2026-01-01", commencement_date: "2026-01-05", contract_days: "120", minutes_no: "1", signed_by: "أ، ب", ...o });
const audit = (store: Record<string, Record<string, string>[]>, params = {}) => runAudit(store, T, params) as { test: string; row: number; severity: string; detail: string }[];
const only = (fs: ReturnType<typeof audit>, test: string) => fs.filter((f) => f.test === test);

describe("extension without a documented reason", () => {
  it("flags an extension with days but no reason, and only that", () => {
    const fs = audit({ Engineering_Time_Extensions_Variations: [ext({ request_no: "R1", extension_days: "30", reason: "" }), ext({ request_no: "R2", extension_days: "30" })] });
    const hits = only(fs, NO_REASON);
    expect(hits.map((f) => f.row)).toEqual([0]);
    expect(hits[0].severity).toBe("medium");
    expect(hits[0].detail).toContain("R1");
  });

  it("ignores variation orders (no extension days) and whitespace-only reasons count as missing", () => {
    const fs = audit({ Engineering_Time_Extensions_Variations: [ext({ request_no: "V1", type: "أمر تغيير", variation_value: "500", reason: "" }), ext({ request_no: "R3", extension_days: "10", reason: "   " })] });
    expect(only(fs, NO_REASON).map((f) => f.row)).toEqual([1]);
  });
});

describe("cumulative extensions above the allowed share of the contract period", () => {
  const store = (rows: Record<string, string>[]) => ({ Engineering_Site_Handover_Minutes: [hand()], Engineering_Time_Extensions_Variations: rows });
  const three = [ext({ request_no: "R1", extension_days: "45" }), ext({ request_no: "R2", extension_days: "40" }), ext({ request_no: "R3", extension_days: "10" })];

  it("is disabled by default (the legal limit is the auditor's input, never invented)", () => {
    expect(only(audit(store(three)), CUMULATIVE)).toEqual([]);
  });

  it("flags once per project, at the extension that crosses the limit", () => {
    const hits = only(audit(store(three), { extensionMaxPct: 50 }), CUMULATIVE); // 45+40=85 > 60 (50% of 120)
    expect(hits.map((f) => f.row)).toEqual([1]);
    expect(hits[0].severity).toBe("high");
    expect(hits[0].detail).toContain("85");
    expect(hits[0].detail).toContain("120");
  });

  it("does not flag at or below the limit", () => {
    expect(only(audit(store([ext({ request_no: "R1", extension_days: "60" })]), { extensionMaxPct: 50 }), CUMULATIVE)).toEqual([]);
  });

  it("counts only approved extensions", () => {
    const rows = [ext({ request_no: "R1", extension_days: "45" }), ext({ request_no: "R2", extension_days: "40", approved: "لا" })];
    expect(only(audit(store(rows), { extensionMaxPct: 50 }), CUMULATIVE)).toEqual([]);
  });

  it("keeps projects separate and needs the contract period from the handover minutes", () => {
    const rows = [ext({ project_no: "P1", request_no: "R1", extension_days: "50" }), ext({ project_no: "P2", request_no: "R2", extension_days: "50" })];
    const st = { Engineering_Site_Handover_Minutes: [hand(), hand({ project_no: "P2", contract_days: "" })], Engineering_Time_Extensions_Variations: rows };
    // P1: 50/120 = 42% (<50%), P2: no contract period => cannot judge, so no finding
    expect(only(audit(st, { extensionMaxPct: 50 }), CUMULATIVE)).toEqual([]);
  });
});
