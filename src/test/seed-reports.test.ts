import { describe, it, expect, beforeEach } from "vitest";
import { SEED_REPORTS, mergeSeedReports, markSeedRemoved } from "@/rasd/seed-reports.js";
import { buildCorpus, compareObservation } from "@/rasd/auditor-draft.js";

describe("seed reports", () => {
  beforeEach(() => localStorage.clear());

  it("contains both audit bureau reports with findings and observations", () => {
    expect(SEED_REPORTS).toHaveLength(2);
    expect(SEED_REPORTS[0].findings).toHaveLength(15);
    expect(SEED_REPORTS[1].findings.length).toBeGreaterThan(0);
    for (const r of SEED_REPORTS) expect(r.observations.length).toBe(r.findings.length);
  });

  it("merges once, keeps user reports, and does not duplicate", () => {
    const user = [{ id: "u1", name: "x", date: "2026-01-01", findings: [] }];
    const a = mergeSeedReports(user);
    expect(a).toHaveLength(3);
    expect(mergeSeedReports(a)).toHaveLength(3);
  });

  it("does not bring back a removed seed report", () => {
    markSeedRemoved(SEED_REPORTS[0].id);
    const a = mergeSeedReports([]);
    expect(a.map((r) => r.id)).toEqual([SEED_REPORTS[1].id]);
  });

  it("feeds the auditor draft comparison", () => {
    const corpus = buildCorpus(SEED_REPORTS);
    const res = compareObservation("الشراء بأسلوب استدراج العروض دون مبررات", corpus);
    expect(res.matches.length).toBeGreaterThan(0);
  });
});
