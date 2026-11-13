// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AuditTrailTimeline } from "@/rasd/AuditTrailTimeline";
import { standingOf, type AuditEvent } from "@/rasd/audit-chain";
import { AuditTrailPanel } from "@/rasd/AuditTrailPanel";

const ev = (seq: number, extra: Partial<AuditEvent> = {}): AuditEvent => ({
  seq,
  ts: "2026-11-13T08:00:00.000Z",
  actor: "U1",
  role: "auditor",
  action: "ui.finding.approve",
  target: "obs-1",
  detail: "",
  prevHash: "a".repeat(64),
  hash: "b".repeat(64),
  ...extra,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AuditTrailTimeline", () => {
  it("يعرض كل الأحداث موثّقة حين تكون السلسلة سليمة", () => {
    render(<AuditTrailTimeline events={[ev(3), ev(2), ev(1)]} verify={{ ok: true, count: 3 }} />);
    expect(screen.getByTestId("audit-verdict").textContent).toContain("سليمة");
    const items = screen.getAllByTestId("audit-event");
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.getAttribute("data-standing") === "valid")).toBe(true);
    expect(screen.getAllByText("اعتماد ملاحظة")).toHaveLength(3);
  });

  it("يحدد نقطة الكسر والأحداث اللاحقة لها من حكم الخادم", () => {
    const verify = { ok: false as const, brokenAt: 2, reason: "محتوى الحدث تغيّر بعد تسجيله" };
    render(<AuditTrailTimeline events={[ev(3), ev(2), ev(1)]} verify={verify} />);
    expect(screen.getByRole("alert").textContent).toContain("2");
    const states = screen.getAllByTestId("audit-event").map((i) => i.getAttribute("data-standing"));
    expect(states).toEqual(["after", "broken", "valid"]);
    expect(standingOf(1, verify)).toBe("valid");
  });

  it("يعرض رسالة فراغ ويترجم أحداث الخزنة", () => {
    const { rerender } = render(<AuditTrailTimeline events={[]} verify={{ ok: true, count: 0 }} />);
    expect(screen.getByTestId("audit-empty")).toBeTruthy();
    rerender(
      <AuditTrailTimeline
        events={[ev(1, { action: "ui.vault.escrow_use", role: "admin", actor: "ADMIN1" })]}
        verify={{ ok: true, count: 1 }}
      />,
    );
    expect(screen.getByText("استعمال مفتاح الطوارئ لفتح الخزنة")).toBeTruthy();
    expect(screen.getByText("مدير")).toBeTruthy();
  });
});

describe("AuditTrailPanel", () => {
  const respond = (status: number, body: unknown) =>
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    );

  it("يعرض حكم الخادم والأحداث", async () => {
    const fetchMock = respond(200, {
      verify: { ok: true, count: 2 },
      total: 2,
      matched: 2,
      events: [ev(2), ev(1)],
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuditTrailPanel />);
    await waitFor(() => expect(screen.getAllByTestId("audit-event")).toHaveLength(2));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("audit=1");
  });

  it("يمرر التصفية بالهدف إلى الخادم", async () => {
    const fetchMock = respond(200, {
      verify: { ok: true, count: 1 },
      total: 5,
      matched: 1,
      events: [ev(1)],
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuditTrailPanel target="obs-1" />);
    await waitFor(() => expect(screen.getAllByTestId("audit-event")).toHaveLength(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("target=obs-1");
  });

  it("يشرح الرفض للمدقق العادي", async () => {
    vi.stubGlobal("fetch", respond(403, { error: "forbidden" }));
    render(<AuditTrailPanel />);
    await waitFor(() => expect(screen.getByTestId("audit-forbidden")).toBeTruthy());
  });
});
