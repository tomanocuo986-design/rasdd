import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditReport } from "@/rasd/AuditReport";
import { draftObservations, loadIds, saveDraft, saveIds } from "@/rasd/observations";
import { loadOverrides } from "@/rasd/legal-status";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node: ReactNode) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => {
    root.render(node);
  });
  return { el, unmount: () => act(async () => root.unmount()) };
}

const finding = (over = {}) => ({
  dataset: "Direct_Purchases_Orders",
  sector: "procurement",
  row: 0,
  test: "احتمال تجزئة مشتريات",
  ref: "PO-1",
  severity: "high" as const,
  ...over,
});

const baseProps = (onExportPdf: () => Promise<void>) => ({
  Button: ({ children, onClick, disabled }: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
  sevLabel: { high: "مرتفعة", medium: "متوسطة", low: "منخفضة", none: "-" },
  sevClass: { high: "", medium: "", low: "", none: "" },
  datasetLabel: (k: string) => k,
  loadSaved: () => [],
  onExportPdf,
});

const clickText = async (el: HTMLElement, label: string) => {
  const b = [...el.querySelectorAll("button")].find((x) => x.textContent?.startsWith(label));
  await act(async () => {
    b?.click();
  });
};

describe("legal basis gate", () => {
  beforeEach(() => localStorage.clear());

  it("shows a badge per observation", async () => {
    saveDraft({ date: "2026-11-02", observations: draftObservations([finding()]) });
    const { el } = await mount(<AuditReport {...baseProps(async () => {})} />);
    expect(el.querySelector('[data-testid="legal-badge"]')?.getAttribute("data-status")).toBe("framework");
  });

  it("asks for explicit confirmation before exporting without a library basis, and logs it", async () => {
    const onExport = vi.fn(async () => {});
    const obs = draftObservations([finding()]);
    saveDraft({ date: "2026-11-02", observations: obs });
    saveIds("approved", new Set(obs.map((o) => o.id))); // الملاحظة الجديدة لا تُصدَّر قبل اعتماد المدقق
    const { el } = await mount(<AuditReport {...baseProps(onExport)} />);
    await clickText(el, "تصدير التقرير PDF");
    expect(onExport).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="basis-confirm"]')).not.toBeNull();
    await clickText(el, "تصدير التقرير رغم ذلك");
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(loadOverrides()).toHaveLength(1);
    expect(loadOverrides()[0]).toMatchObject({ action: "export", status: "framework" });
  });

  it("exports directly when every observation has a library basis", async () => {
    const onExport = vi.fn(async () => {});
    const withReg = finding({ regulation: { doc: "نظام المشتريات", excerpt: "المادة 5: يحظر تجزئة المشتريات" } });
    const obs = draftObservations([withReg]);
    saveDraft({ date: "2026-11-02", observations: obs });
    saveIds("approved", new Set(obs.map((o) => o.id)));
    const { el } = await mount(<AuditReport {...baseProps(onExport)} />);
    expect(el.querySelector('[data-testid="legal-badge"]')?.getAttribute("data-status")).toBe("library");
    await clickText(el, "تصدير التقرير PDF");
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[data-testid="basis-confirm"]')).toBeNull();
  });

  it("gates approval of an observation without a library basis", async () => {
    saveDraft({ date: "2026-11-02", observations: draftObservations([finding()]) });
    const { el } = await mount(<AuditReport {...baseProps(async () => {})} />);
    await clickText(el, "اعتماد الملاحظة");
    expect(loadIds("approved").size).toBe(0);
    expect(el.querySelector('[data-testid="basis-confirm"]')).not.toBeNull();
    await clickText(el, "اعتماد رغم عدم وجود سند من المكتبة");
    expect(loadIds("approved").size).toBe(1);
    expect(loadOverrides()[0]).toMatchObject({ action: "approve" });
  });
});
