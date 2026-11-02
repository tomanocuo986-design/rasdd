// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  DECISIONS,
  DEFAULT_THRESHOLD,
  decisionFor,
  isSuppressed,
  loadThreshold,
  noisyRules,
  observationFingerprint,
  recordDecision,
  ruleStats,
  saveThreshold,
  staleHiddenIds,
} from "@/rasd/review-log.js";

const obs = (over = {}) => ({
  id: "Direct_Purchases_Orders|احتمال تجزئة مشتريات",
  dataset: "Direct_Purchases_Orders",
  test: "احتمال تجزئة مشتريات",
  count: 2,
  refs: ["PO-2", "PO-1"],
  ...over,
});

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
};

describe("review-log: observation decisions", () => {
  it("fingerprint ignores ref order and changes with count or refs", () => {
    expect(observationFingerprint(obs())).toBe(observationFingerprint(obs({ refs: ["PO-1", "PO-2"] })));
    expect(observationFingerprint(obs())).not.toBe(observationFingerprint(obs({ count: 3 })));
    expect(observationFingerprint(obs())).not.toBe(observationFingerprint(obs({ refs: ["PO-1", "PO-9"] })));
  });

  it("stores the latest decision per observation with its fingerprint", () => {
    const o = obs();
    let log = recordDecision([], { dataset: o.dataset, test: o.test, ref: o.id, decision: DECISIONS.confirmed, fingerprint: observationFingerprint(o) });
    log = recordDecision(log, { dataset: o.dataset, test: o.test, ref: o.id, decision: DECISIONS.falsePositive, note: "سبب", fingerprint: observationFingerprint(o), autoHidden: true });
    expect(log).toHaveLength(1);
    expect(decisionFor(log, o)).toMatchObject({ decision: "false_positive", note: "سبب", autoHidden: true });
  });

  it("suppresses a false positive only while the data is unchanged", () => {
    const o = obs();
    const log = recordDecision([], { dataset: o.dataset, test: o.test, ref: o.id, decision: DECISIONS.falsePositive, fingerprint: observationFingerprint(o), autoHidden: true });
    expect(isSuppressed(log, o)).toBe(true);
    expect(isSuppressed(log, obs({ count: 3, refs: ["PO-1", "PO-2", "PO-3"] }))).toBe(false);
    expect(staleHiddenIds(log, [o])).toEqual([]);
    expect(staleHiddenIds(log, [obs({ count: 3 })])).toEqual([o.id]);
  });

  it("does not suppress a confirmed observation", () => {
    const o = obs();
    const log = recordDecision([], { dataset: o.dataset, test: o.test, ref: o.id, decision: DECISIONS.confirmed, fingerprint: observationFingerprint(o) });
    expect(isSuppressed(log, o)).toBe(false);
  });

  it("flags noisy rules only after enough reviews", () => {
    let log = [];
    for (let i = 0; i < 4; i++)
      log = recordDecision(log, { dataset: "Payment_Vouchers", test: "فصل الصلاحيات", ref: `r${i}`, decision: DECISIONS.falsePositive });
    expect(noisyRules(log, { noisyRate: 0.6, minReviewed: 5 })).toHaveLength(0);
    log = recordDecision(log, { dataset: "Payment_Vouchers", test: "فصل الصلاحيات", ref: "r4", decision: DECISIONS.confirmed });
    const noisy = noisyRules(log, { noisyRate: 0.6, minReviewed: 5 });
    expect(noisy).toHaveLength(1);
    expect(noisy[0]).toMatchObject({ reviewed: 5, falsePositive: 4 });
    expect(ruleStats(log)[0].falsePositiveRate).toBeCloseTo(0.8);
  });

  it("persists and validates the alert threshold", () => {
    const st = memStorage();
    expect(loadThreshold(st)).toEqual(DEFAULT_THRESHOLD);
    saveThreshold({ noisyRate: 0.4, minReviewed: 6 }, st);
    expect(loadThreshold(st)).toEqual({ noisyRate: 0.4, minReviewed: 6 });
    saveThreshold({ noisyRate: 5, minReviewed: 0 }, st);
    expect(loadThreshold(st)).toEqual(DEFAULT_THRESHOLD);
  });
});
