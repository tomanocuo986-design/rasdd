import { describe, expect, it } from "vitest";
import { GENESIS, makeEvent, memoryAuditStore, verifyChain } from "../server/audit-log.ts";

describe("tamper-evident audit log", () => {
  it("chains events and verifies", async () => {
    const s = memoryAuditStore();
    const a = await s.append({ actor: "1001", role: "auditor", action: "auth.login" });
    const b = await s.append({ actor: "1001", role: "auditor", action: "ui.report.export", target: "audit-2026-11-03" });
    expect(a.prevHash).toBe(GENESIS);
    expect(b.prevHash).toBe(a.hash);
    expect(b.seq).toBe(2);
    expect(verifyChain(await s.all())).toEqual({ ok: true, count: 2 });
  });

  it("detects an edited event, a deleted event and a reordered chain", async () => {
    const s = memoryAuditStore();
    for (const action of ["a", "b", "c", "d"]) await s.append({ actor: "u", action });
    const all = await s.all();

    const edited = all.map((e) => ({ ...e }));
    edited[1].actor = "someone-else";
    expect(verifyChain(edited)).toMatchObject({ ok: false, brokenAt: 2 });

    const deleted = all.filter((e) => e.seq !== 2);
    expect(verifyChain(deleted)).toMatchObject({ ok: false });

    const reordered = [all[0], all[2], all[1], all[3]];
    expect(verifyChain(reordered)).toMatchObject({ ok: false });

    // إعادة حساب بصمة الحدث المعدّل وحده لا تكفي: تنكسر بصمة اللاحق
    const forged = all.map((e) => ({ ...e }));
    const { hash: _h, ...rest } = { ...forged[1], actor: "x" };
    forged[1] = makeEvent({ actor: "x", action: rest.action }, forged[0], new Date(rest.ts));
    expect(verifyChain(forged)).toMatchObject({ ok: false, brokenAt: 3 });
  });

  it("clips long fields and strips newlines", () => {
    const e = makeEvent({ actor: "u", action: "x", detail: "a\nb".padEnd(2000, "z") }, null);
    expect(e.detail.length).toBe(500);
    expect(e.detail).not.toContain("\n");
  });
});
