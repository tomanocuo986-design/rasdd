import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";
import { AuditReport } from "@/rasd/AuditReport";
import {
  draftObservations,
  loadIds,
  saveDraft,
  summarize,
  summaryText,
} from "@/rasd/observations";

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

const findings = [
  { dataset: "Direct_Purchases_Orders", sector: "procurement", row: 0, test: "احتمال تجزئة مشتريات", ref: "PO-1", severity: "high" as const },
  { dataset: "HR_Overtime_Bonuses", sector: "hr", row: 1, test: "إضافي بلا اعتماد مسبق للساعات", ref: "E-7", severity: "medium" as const },
];

const props = {
  Button: ({ children, onClick, disabled }: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
  sevLabel: { high: "مرتفعة", medium: "متوسطة", low: "منخفضة", none: "-" },
  sevClass: { high: "", medium: "", low: "", none: "" },
  datasetLabel: (k: string) => k,
  loadSaved: () => [],
  onExportPdf: async () => {},
};

describe("consolidated audit report", () => {
  beforeEach(() => localStorage.clear());

  it("summarises observations", () => {
    const s = summarize(draftObservations(findings));
    expect(s).toMatchObject({ total: 2, high: 1, medium: 1 });
    expect(summaryText(s)).toContain("2 ملاحظة رقابية");
  });

  it("shows an empty state, then the numbered observations from the audit tab", async () => {
    const first = await mount(<AuditReport {...props} />);
    expect(first.el.textContent).toContain("لا توجد ملاحظات رقابية بعد");
    await first.unmount();
    saveDraft({ date: "2026-10-24", observations: draftObservations(findings) });
    const { el } = await mount(<AuditReport {...props} />);
    expect(el.textContent).toContain("ملاحظة رقابية 1:");
    expect(el.textContent).toContain("ملاحظة رقابية 2:");
    expect(el.textContent?.match(/السند القانوني:/g)).toHaveLength(2);
  });

  it("uses the risk class on the badge", async () => {
    saveDraft({ date: "2026-10-24", observations: draftObservations(findings) });
    const sevClass = { high: "sev-high", medium: "sev-medium", low: "sev-low", none: "" };
    const { el } = await mount(<AuditReport {...props} sevClass={sevClass} />);
    expect(el.querySelector(".sev-high")?.textContent).toBe("مرتفعة");
    expect(el.querySelector(".sev-medium")?.textContent).toBe("متوسطة");
  });

  it("deletes an observation, keeps that deletion, and can restore it", async () => {
    saveDraft({ date: "2026-10-24", observations: draftObservations(findings) });
    const { el } = await mount(<AuditReport {...props} />);
    const click = async (label: string) => {
      const b = [...el.querySelectorAll("button")].find((x) => x.textContent?.startsWith(label));
      await act(async () => {
        b?.click();
      });
    };
    await click("حذف الملاحظة");
    expect(el.textContent).not.toContain("ملاحظة رقابية 2:");
    expect(loadIds("deleted").size).toBe(1);
    await click("استرجاع المحذوفة");
    expect(el.textContent).toContain("ملاحظة رقابية 2:");
    expect(loadIds("deleted").size).toBe(0);
  });
});
