import { describe, expect, it } from "vitest";
import * as X from "xlsx";
import { allDatasets } from "@/rasd/workspace.jsx";
import { mapWorkbook } from "@/rasd/import-table.js";
import { isExcelSerial, parseDateMs, serialToISO } from "@/rasd/dates.js";
import { legalFrameworkOf } from "@/rasd/legal-framework";
import { buildBackup, importBackup, validateBackup, localKeys } from "@/rasd/backup.js";
import { DECISIONS, recordDecision, ruleStats, suggestions } from "@/rasd/review-log.js";
import { ocrTextToLines } from "@/rasd/pdf-text.js";

describe("Excel serial dates", () => {
  it("converts Excel serials to ISO dates", () => {
    expect(serialToISO(46323)).toBe("2026-10-28");
    expect(serialToISO(45667)).toBe("2025-01-10");
    expect(serialToISO(46323.5)).toBe("2026-10-28 12:00");
  });
  it("recognises only plausible serials", () => {
    expect(isExcelSerial("46315")).toBe(true);
    expect(isExcelSerial("1234")).toBe(false);
    expect(isExcelSerial("2025-01-05")).toBe(false);
    expect(isExcelSerial("123456")).toBe(false);
  });
  it("parseDateMs differences are right for serials and ISO strings", () => {
    const a = parseDateMs("46323")!;
    const b = parseDateMs("2026-11-04")!;
    expect((b - a) / 864e5).toBe(7);
  });
  it("imports a General-formatted date cell as a real date", () => {
    const ds = allDatasets.find((d) => d.key === "Fleet_Movement_Orders")!;
    const dateField = ds.fields.find((f: any) => f.type === "date")!;
    const wb = X.utils.book_new();
    const ws = X.utils.aoa_to_sheet([
      ds.fields.map((f: any) => f.label),
      ds.fields.map((f: any) => (f === dateField ? 46323 : "x")),
    ]);
    X.utils.book_append_sheet(wb, ws, ds.key);
    const { imports } = mapWorkbook(X, wb, allDatasets, ds.key);
    expect(imports[0].rows[0][dateField.key]).toBe("2026-10-28");
  });
});

describe("legal articles", () => {
  it("keeps needsVerification until articles + verifier are filled", () => {
    const fw = legalFrameworkOf({ dataset: "Direct_Purchases_Orders", test: "تجزئة شراء" });
    expect(fw?.needsVerification).toBe(true);
    expect(fw?.instruments.length).toBeGreaterThan(0);
  });
});

describe("backup", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return {
      get length() {
        return m.size;
      },
      key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    } as unknown as Storage;
  };
  it("collects only rasd- keys and restores them", async () => {
    const s = mem();
    s.setItem("rasd-audit-store", '{"a":1}');
    s.setItem("other", "x");
    expect(localKeys(s)).toEqual(["rasd-audit-store"]);
    const b = await buildBackup(s, false);
    expect(Object.keys(b.data)).toEqual(["rasd-audit-store"]);
    const t = mem();
    const file = { text: async () => JSON.stringify(b) } as unknown as File;
    const r = await importBackup(file, t);
    expect(r.keys).toBe(1);
    expect(t.getItem("rasd-audit-store")).toBe('{"a":1}');
  });
  it("rejects foreign files", () => {
    expect(() => validateBackup({ hello: 1 })).toThrow();
  });
});

describe("review log", () => {
  it("computes false-positive rate and only advises on enough samples", () => {
    let log: any[] = [];
    for (let i = 0; i < 10; i++)
      log = recordDecision(log, {
        dataset: "D",
        test: "T",
        ref: String(i),
        decision: i < 8 ? DECISIONS.falsePositive : DECISIONS.confirmed,
      });
    log = recordDecision(log, {
      dataset: "D",
      test: "Few",
      ref: "1",
      decision: DECISIONS.falsePositive,
    });
    const st = ruleStats(log).find((s) => s.test === "T")!;
    expect(st.falsePositiveRate).toBeCloseTo(0.8);
    const sg = suggestions(log);
    expect(sg.map((s) => s.test)).toEqual(["T"]);
    expect(sg[0].advice).toContain("مرتفعة");
  });
  it("last decision for the same finding wins", () => {
    let log: any[] = [];
    log = recordDecision(log, {
      dataset: "D",
      test: "T",
      ref: "1",
      decision: DECISIONS.falsePositive,
    });
    log = recordDecision(log, { dataset: "D", test: "T", ref: "1", decision: DECISIONS.confirmed });
    expect(log).toHaveLength(1);
    expect(log[0].decision).toBe(DECISIONS.confirmed);
  });
});

describe("OCR text to table cells", () => {
  it("splits columns by wide gaps", () => {
    expect(ocrTextToLines("101   أحمد   عمان - اربد\n\n102   خالد   الزرقاء")).toEqual([
      ["101", "أحمد", "عمان - اربد"],
      ["102", "خالد", "الزرقاء"],
    ]);
  });
});
