import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditReport } from "@/rasd/AuditReport";
import { ObservationsPanel } from "@/rasd/ObservationsPanel";
import {
  applyEdit,
  diffEdit,
  draftObservations,
  loadEdits,
  loadIds,
  reportable,
  saveDraft,
  saveIds,
  summarize,
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
const click = async (el: HTMLElement, label: string) => {
  const b = [...el.querySelectorAll("button")].find((x) => x.textContent?.startsWith(label));
  expect(b, label).toBeTruthy();
  await act(async () => {
    b?.click();
  });
};
const setValue = async (el: HTMLElement, aria: string, v: string) => {
  const f = el.querySelector(`[aria-label="${aria}"]`) as HTMLInputElement | HTMLTextAreaElement;
  const proto = f instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(f, v);
    f.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const f = (over: Record<string, unknown> = {}) => ({
  dataset: "Direct_Purchases_Orders",
  sector: "procurement",
  row: 0,
  test: "حالة جديدة لا يغطيها أي نمط معروف",
  ref: "PO-1",
  severity: "medium" as const,
  ...over,
});
const sev = { high: "مرتفعة", medium: "متوسطة", low: "منخفضة", none: "-" };
const cls = { high: "", medium: "", low: "", none: "" };

describe("new observation: drafted, then approved / edited / deleted by the auditor", () => {
  beforeEach(() => localStorage.clear());

  it("flags an observation absent from previous reports as new, with condition, cause, effect and a basis", () => {
    const [o] = draftObservations([f()]);
    expect(o?.isNew).toBe(true);
    expect(o?.condition).toContain("رُصدت");
    expect(o?.cause).toContain("حالة جديدة لا يغطيها أي نمط معروف"); // صياغة سياقية لا جملة عامة
    expect(o?.effect).toContain("حالة جديدة لا يغطيها أي نمط معروف");
    expect(o?.legalBasis.text.length).toBeGreaterThan(0);
    const [r] = draftObservations([f({ repeat: { exact: true, report: "تقرير سابق" } })]);
    expect(r?.isNew).toBe(false);
  });

  it("keeps a new observation out of the report until approved; recurring ones are unaffected", () => {
    const fresh = draftObservations([f()])[0]!;
    const old = draftObservations([f({ test: "قيد مكرر", repeat: { exact: true, report: "س" } })])[0]!;
    expect(reportable([fresh, old]).map((o) => o.id)).toEqual([old.id]);
    expect(reportable([{ ...fresh, status: "approved" }, old])).toHaveLength(2);
    expect(summarize([fresh, old]).pendingNew).toBe(1);
  });

  it("stores only what the auditor really changed, labels his basis as his own and survives re-analysis", () => {
    const o = draftObservations([f()])[0]!;
    expect(diffEdit(o, { cause: o.cause })).toBeUndefined();
    const e = diffEdit(o, { cause: "سبب كتبه المدقق", legalBasis: "المادة (5) من النظام كذا", rating: "high" })!;
    expect(Object.keys(e).sort()).toEqual(["at", "cause", "legalBasis", "rating"]);
    const edited = applyEdit(o, e);
    expect(edited).toMatchObject({ cause: "سبب كتبه المدقق", edited: true, risk: { rating: "high" }, legalBasis: { source: "auditor" } });
    expect(edited.condition).toBe(o.condition);
  });

  it("panel: edit then «حفظ واعتماد» saves the edit and approves", async () => {
    const o = draftObservations([f()])[0]!;
    const onEdit = vi.fn();
    const base = { observations: [o], sevLabel: sev, sevClass: cls, datasetLabel: (k: string) => k, onToggleApprove: vi.fn(), onDelete: vi.fn(), deletedCount: 0, onRestore: vi.fn(), onEdit };
    const { el } = await mount(<ObservationsPanel {...base} />);
    expect(el.querySelector('[data-testid="new-badge"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="pending-new"]')?.textContent).toContain("1 ملاحظة جديدة");
    await click(el, "تعديل الصياغة");
    await setValue(el, "السبب", "سبب جديد من المدقق");
    await setValue(el, "السند القانوني", "المادة (9) من التعليمات");
    await click(el, "حفظ واعتماد");
    expect(onEdit).toHaveBeenCalledTimes(1);
    const [, patch, approve] = onEdit.mock.calls[0]!;
    expect(patch).toMatchObject({ cause: "سبب جديد من المدقق", legalBasis: "المادة (9) من التعليمات" });
    expect(approve).toBe(true); // السند عدّله المدقق فلا بوابة سند
  });

  it("report: pending new observation is not exported; after approval (with his edit) it is", async () => {
    const obs = draftObservations([f()]);
    saveDraft({ date: "2026-11-03", observations: obs });
    const onPdf = vi.fn(async () => {});
    const onDocx = vi.fn(async () => {});
    const props = { Button: ({ children, onClick, disabled }: { children?: ReactNode; onClick?: () => void; disabled?: boolean }) => <button onClick={onClick} disabled={disabled}>{children}</button>, sevLabel: sev, sevClass: cls, datasetLabel: (k: string) => k, loadSaved: () => [], onExportPdf: onPdf, onExportDocx: onDocx };
    const { el } = await mount(<AuditReport {...props} />);
    expect(el.querySelector('[data-testid="pending-new"]')).not.toBeNull();
    const pdfBtn = [...el.querySelectorAll("button")].find((b) => b.textContent === "تصدير التقرير PDF") as HTMLButtonElement;
    expect(pdfBtn.disabled).toBe(true);

    await click(el, "تعديل الصياغة");
    await setValue(el, "الأثر", "أثر صاغه المدقق");
    await setValue(el, "السند القانوني", "المادة (3) من النظام");
    await click(el, "حفظ واعتماد");
    expect(loadIds("approved").size).toBe(1);
    expect(loadEdits()[obs[0]!.id]?.effect).toBe("أثر صاغه المدقق");
    expect(el.textContent).toContain("أثر صاغه المدقق");
    expect(el.textContent).toContain("✎ معدّلة من المدقق");

    await click(el, "تصدير Word");
    expect(onDocx).toHaveBeenCalledTimes(1);
    const sent = (onDocx.mock.calls[0] as unknown as [{ observations: { effect: string; status: string }[] }])[0];
    expect(sent.observations).toHaveLength(1);
    expect(sent.observations[0]).toMatchObject({ effect: "أثر صاغه المدقق", status: "approved" });
  });

  it("report: deleting a new observation removes it from the report for good", async () => {
    const obs = draftObservations([f()]);
    saveDraft({ date: "2026-11-03", observations: obs });
    saveIds("approved", new Set([obs[0]!.id]));
    const { el } = await mount(<AuditReport Button={({ children }: { children?: ReactNode }) => <button>{children}</button>} sevLabel={sev} sevClass={cls} datasetLabel={(k) => k} loadSaved={() => []} onExportPdf={async () => {}} />);
    await click(el, "حذف الملاحظة");
    expect(el.textContent).not.toContain("ملاحظة رقابية 1:");
  });

  it("report model preview shows only approved new observations, in the template layout", async () => {
    const obs = draftObservations([f()]);
    saveDraft({ date: "2026-11-03", observations: obs });
    const props = { Button: ({ children }: { children?: ReactNode }) => <button>{children}</button>, sevLabel: sev, sevClass: cls, datasetLabel: (k: string) => k, loadSaved: () => [], onExportPdf: async () => {} };
    const { el } = await mount(<AuditReport {...props} />);
    expect(el.querySelector('[data-testid="report-model"]')?.textContent).toContain("لا توجد ملاحظات معتمدة");
    await click(el, "اعتماد الملاحظة");
    if (el.querySelector('[data-testid="basis-confirm"]')) await click(el, "اعتماد رغم عدم وجود سند من المكتبة");
    const model = el.querySelector('[data-testid="report-model"]')!;
    expect(model.querySelectorAll('[data-testid="model-block"]')).toHaveLength(1);
    for (const t of ["قائمة الملاحظات", "الحالة:", "السند القانوني:", "السبب:", "الأثر:", "التوصيات", "رد إدارة الجهة", "خطة (خطط) العمل", "تعقيب الديوان"]) expect(model.textContent).toContain(t);
  });

  it("report model: the Word download button inside the model sends exactly the approved observations", async () => {
    const obs = draftObservations([f()]);
    saveDraft({ date: "2026-11-03", observations: obs });
    const onDocx = vi.fn(async () => {});
    const Btn = ({ children, onClick, disabled }: { children?: ReactNode; onClick?: () => void; disabled?: boolean }) => <button onClick={onClick} disabled={disabled}>{children}</button>;
    const props = { Button: Btn, sevLabel: sev, sevClass: cls, datasetLabel: (k: string) => k, loadSaved: () => [], onExportPdf: async () => {}, onExportDocx: onDocx };
    const { el } = await mount(<AuditReport {...props} />);
    // لا ملاحظات معتمدة بعد: لا زر تحميل داخل النموذج
    expect(el.querySelector('[data-testid="model-download-word"]')).toBeNull();
    await click(el, "اعتماد الملاحظة");
    if (el.querySelector('[data-testid="basis-confirm"]')) await click(el, "اعتماد رغم عدم وجود سند من المكتبة");
    const btn = el.querySelector('[data-testid="model-download-word"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain("Word");
    await act(async () => btn.click());
    if (el.querySelector('[data-testid="basis-confirm"]')) await click(el, "تصدير Word رغم ذلك");
    expect(onDocx).toHaveBeenCalledTimes(1);
    const sent = (onDocx.mock.calls[0] as unknown as [{ observations: { status: string }[] }])[0];
    expect(sent.observations).toHaveLength(1);
    expect(sent.observations[0]!.status).toBe("approved");
  });

  it("report model: no Word button when Word export is not provided", async () => {
    const obs = draftObservations([f()]);
    saveDraft({ date: "2026-11-03", observations: obs });
    saveIds("approved", new Set([obs[0]!.id]));
    const props = { Button: ({ children }: { children?: ReactNode }) => <button>{children}</button>, sevLabel: sev, sevClass: cls, datasetLabel: (k: string) => k, loadSaved: () => [], onExportPdf: async () => {} };
    const { el } = await mount(<AuditReport {...props} />);
    expect(el.querySelector('[data-testid="model-block"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="model-download-word"]')).toBeNull();
  });
});
