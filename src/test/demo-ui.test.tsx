import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "@/rasd/workspace.jsx";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const openAudit = async () => {
  const nav = await screen.findAllByText("تدقيق الأنشطة والعمليات");
  fireEvent.click(nav[0]);
};

describe("demo mode in the audit workspace", () => {
  it("offers the demo on an empty workspace and fills every indicator with one click", async () => {
    render(<Workspace />);
    await openAudit();
    const btn = await screen.findByText("▶ تحميل العرض التجريبي");
    fireEvent.click(btn);
    expect(await screen.findByTestId("demo-banner")).toBeTruthy();
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("rasd-audit-store") ?? "{}");
      expect(Object.keys(saved).length).toBeGreaterThan(10);
      expect(saved.Receipt_Vouchers.length).toBeGreaterThan(15);
    });
    expect(localStorage.getItem("rasd-demo-active")).toBe("1");
    const reports = JSON.parse(localStorage.getItem("rasd-audit-reports") ?? "[]");
    expect(reports.filter((r: any) => !r.seed)).toHaveLength(1);
  });

  it("restores the user's own data when leaving the demo", async () => {
    const mine = { Petty_Cash: [{ box: "صندوقي", approved: "100", actual: "100", unsettled_docs: "0" }] };
    localStorage.setItem("rasd-audit-store", JSON.stringify(mine));
    render(<Workspace />);
    await openAudit();
    fireEvent.click(await screen.findByText("تحميل العرض التجريبي (يستبدل بياناتك مؤقتًا)"));
    await screen.findByTestId("demo-banner");
    expect(JSON.parse(localStorage.getItem("rasd-demo-snapshot")!).store).toEqual(mine);
    fireEvent.click(screen.getByText("الخروج واستعادة بياناتي"));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("rasd-audit-store")!)).toEqual(mine));
    expect(localStorage.getItem("rasd-demo-active")).toBeNull();
    expect(localStorage.getItem("rasd-demo-snapshot")).toBeNull();
  });

  it("?demo=1 loads the demo and opens the audit view only when the workspace is empty", async () => {
    window.history.replaceState(null, "", "/?demo=1");
    render(<Workspace />);
    expect(await screen.findByTestId("demo-banner")).toBeTruthy();
    expect(localStorage.getItem("rasd-demo-active")).toBe("1");
    expect(window.location.search).toBe("");
    cleanup();
    localStorage.clear();
    localStorage.setItem("rasd-audit-store", JSON.stringify({ Petty_Cash: [{ box: "x" }] }));
    window.history.replaceState(null, "", "/?demo=1");
    render(<Workspace />);
    await new Promise((r) => setTimeout(r, 50));
    expect(localStorage.getItem("rasd-demo-active")).toBeNull();
    expect(JSON.parse(localStorage.getItem("rasd-audit-store")!)).toEqual({ Petty_Cash: [{ box: "x" }] });
  });
});
