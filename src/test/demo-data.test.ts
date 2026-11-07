import { describe, expect, it } from "vitest";
import { auditSectors, runAudit } from "@/rasd/workspace.jsx";
import { buildDemoPreviousReport, buildDemoStore, DEMO_PARAMS } from "@/rasd/demo-data.js";
import { buildHistoryIndex, classifyFindings, findingKey, resolvedFindings } from "@/rasd/history.js";

const T = Date.parse("2026-11-01");

describe("demo mode data", () => {
  const store = buildDemoStore(T);
  const findings = runAudit(store, T, DEMO_PARAMS);

  it("only uses dataset and field keys that the platform defines", () => {
    const defs = new Map(auditSectors.flatMap((s: any) => s.datasets).map((d: any) => [d.key, new Set(d.fields.map((f: any) => f.key))]));
    for (const [key, rows] of Object.entries(store) as [string, Record<string, string>[]][]) {
      expect(defs.has(key), key).toBe(true);
      for (const r of rows) for (const k of Object.keys(r)) expect(defs.get(key)!.has(k), `${key}.${k}`).toBe(true);
    }
  });

  it("is made only of strings so it round-trips through localStorage/CSV like imported data", () => {
    for (const rows of Object.values(store) as Record<string, unknown>[][])
      for (const r of rows) for (const v of Object.values(r)) expect(typeof v).toBe("string");
  });

  it("surfaces deviations in every sector it fills, including high-risk ones", () => {
    const sectors = new Set(findings.map((f: any) => f.sector));
    for (const key of ["finance", "hr", "fleet", "procurement"]) expect(sectors.has(key), key).toBe(true);
    expect(findings.length).toBeGreaterThan(60);
    expect(findings.filter((f: any) => f.severity === "high").length).toBeGreaterThan(25);
  });

  it("detects the headline fraud patterns", () => {
    const tests = new Set(findings.map((f: any) => f.test));
    for (const t of [
      "احتمال صرف مزدوج",
      "صرف دون معتمد",
      "معتمد الصرف هو نفسه المستفيد",
      "رقم الشيك مستخدم في أكثر من سند",
      "حساب بنكي مشترك بين أكثر من موظف",
      "صرف راتب لموظف حالته غير نشطة",
      "احتمال تجزئة مشتريات",
      "سعر اللتر في فاتورة المحطة يخالف سعر العقد",
      "فرق تسوية غير مبرر",
      "عجز في العهدة النقدية",
    ])
      expect(tests.has(t), t).toBe(true);
  });

  it("does not drown the demo in accidental split-payment noise", () => {
    const split = findings.filter((f: any) => f.test === "احتمال تجزئة الصرف");
    expect(split.length).toBeLessThanOrEqual(2);
  });

  it("previous report makes the history layer show new / recurring / resolved", () => {
    const base = findings.map((f: any) => {
      const d = auditSectors.flatMap((s: any) => s.datasets).find((x: any) => x.key === f.dataset);
      const ref = d ? (store[f.dataset as keyof typeof store][f.row]?.[d.fields[0].key] ?? "") : "";
      return { ...f, ref, key: findingKey(f.dataset, f.test, ref) };
    });
    const report = buildDemoPreviousReport(base, T);
    expect(report.findings.length).toBeGreaterThan(10);
    const index = buildHistoryIndex([report]);
    const classified = classifyFindings(base, index);
    const status = (s: string) => classified.filter((f: any) => f.history.status === s).length;
    expect(status("new")).toBeGreaterThan(0);
    expect(status("recurring")).toBeGreaterThan(0);
    const active = new Set(Object.keys(store));
    const { resolved } = resolvedFindings(index, new Set(base.map((f: any) => f.key)), active);
    expect(resolved.length).toBeGreaterThanOrEqual(2);
  });
});
