import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditorDraft } from "@/rasd/AuditorDraft.jsx";
import { AssistantChat } from "@/rasd/AssistantChat.jsx";
import { getManualObservations } from "@/rasd/manual-observations";
import { loadIds } from "@/rasd/observations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REPORTS = [
  {
    id: "r1",
    name: "تقرير المشتريات السابق",
    date: "2025-12-01",
    findings: [],
    observations: [
      {
        id: "x",
        dataset: "Direct_Purchases_Orders",
        test: "احتمال تجزئة مشتريات",
        condition: "أوامر شراء متتالية لنفس المورد دون عرض أسعار",
        recommendation: "ربط سقف الشراء المباشر بإجمالي المورد",
        risk: { rating: "high" },
      },
    ],
  },
];

let unmount: () => Promise<void> = async () => {};
let host: HTMLElement;

async function mount(node: ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  unmount = () => act(async () => root.unmount());
}

const text = () => host.textContent ?? "";
const btn = (label: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(label)) as HTMLButtonElement;

async function click(label: string) {
  const b = btn(label);
  expect(b, `button «${label}»`).toBeTruthy();
  await act(async () => {
    b.click();
  });
}

async function fill(labelText: string, value: string) {
  const label = [...host.querySelectorAll("label")].find((l) => l.textContent?.includes(labelText));
  const el = label?.querySelector("textarea, input, select") as HTMLInputElement | undefined;
  expect(el, `field «${labelText}»`).toBeTruthy();
  const proto = el!.tagName === "SELECT" ? HTMLSelectElement.prototype : el!.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  await act(async () => {
    setter.call(el, value);
    el!.dispatchEvent(new Event(el!.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}


async function tickNoBasis() {
  const box = host.querySelector(".rasd-ad-check input") as HTMLInputElement | null;
  if (box) await act(async () => box.click());
}

const until = async (cond: () => boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await act(async () => new Promise((r) => setTimeout(r, 60)));
  expect(cond()).toBe(true);
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("rasd-audit-reports", JSON.stringify(REPORTS));
});
afterEach(async () => {
  await unmount();
  host?.remove();
  vi.unstubAllGlobals();
});

describe("AuditorDraft flow", () => {
  it("compares with past reports, classifies, then inserts only after final approval", async () => {
    await mount(<AuditorDraft />);
    await fill("نص الملاحظة", "لوحظ تجزئة مشتريات عبر أوامر شراء متتالية لنفس المورد");
    await click("حلّل وقارن");
    expect(host.querySelector('[role="status"]')).toBeTruthy(); // thinking indicator while analysing
    await until(() => text().includes("المقارنة بالتقارير السابقة"));
    expect(text()).toContain("تقرير المشتريات السابق");
    expect(text()).toContain("مرتفعة");

    await click("✓ اعتماد");
    expect(getManualObservations()).toHaveLength(0); // not inserted until the final approval
    expect(btn("اعتماد نهائي").disabled).toBe(true); // no library basis: needs explicit confirmation
    await tickNoBasis();
    await click("اعتماد نهائي");
    expect(getManualObservations()).toHaveLength(1);
    expect(loadIds("approved").has(getManualObservations()[0]!.id)).toBe(true);
    expect(text()).toContain("أُدرجت في التقارير");
  });

  it("delete path shows the review-memo guidance and needs a reason", async () => {
    await mount(<AuditorDraft />);
    await fill("نص الملاحظة", "خطأ في ترقيم الصفحات وتنسيق الملف");
    await click("حلّل وقارن");
    await until(() => !!btn("🗑 حذف"));
    await click("🗑 حذف");
    expect(text()).toContain("مذكرة مراجعة بالملاحظة");
    expect(btn("تأكيد الحذف").disabled).toBe(true);
    await fill("سبب الحذف", "الملاحظة شكلية وسبق تصويبها");
    expect(btn("تأكيد الحذف").disabled).toBe(false);
    expect(text()).toContain("الملاحظة شكلية وسبق تصويبها"); // reason flows into the memo draft
    await click("تأكيد الحذف");
    expect(text()).toContain("حُذفت المسودة");
    expect(getManualObservations()).toHaveLength(0);
  });

  it("edit path lets the auditor change the severity before approval", async () => {
    await mount(<AuditorDraft />);
    await fill("نص الملاحظة", "تأخر في تسوية السلف");
    await click("حلّل وقارن");
    await until(() => !!btn("✎ تعديل"));
    await click("✎ تعديل");
    await fill("الخطورة", "high");
    await click("حفظ التعديلات");
    expect(text()).toContain("عدّلتَ الخطورة يدويًا");
    await click("✓ اعتماد");
    await tickNoBasis();
    await click("اعتماد نهائي");
    expect(getManualObservations()[0]?.risk.rating).toBe("high");
  });

  it("a new observation (not in past reports) is formulated with the five elements and marked new", async () => {
    await mount(<AuditorDraft />);
    await fill("نص الملاحظة", "لوحظ عدم وجود سجل لعهدة الأجهزة الحاسوبية لدى قسم المعلومات");
    await click("حلّل وقارن");
    await until(() => !!btn("✓ اعتماد"));
    expect(text()).toContain("جديدة · لم ترد في التقارير السابقة");
    for (const k of ["الحالة", "السند القانوني", "السبب", "الأثر", "التوصية"]) expect(text()).toContain(k);
    await click("✓ اعتماد");
    await tickNoBasis();
    await click("اعتماد نهائي");
    const o = getManualObservations()[0]!;
    expect(o.isNew).toBe(true);
    expect(o.condition.startsWith("لوحظ")).toBe(true);
    expect(o.cause && o.effect && o.recommendation).toBeTruthy();
  });

  it("edit lets the auditor write the legal basis, which then passes the legal gate without confirmation", async () => {
    await mount(<AuditorDraft />);
    await fill("نص الملاحظة", "لوحظ عدم وجود سجل لعهدة الأجهزة الحاسوبية لدى قسم المعلومات");
    await click("حلّل وقارن");
    await until(() => !!btn("✎ تعديل"));
    await click("✎ تعديل");
    await fill("السند القانوني", "نظام المشتريات — المادة (12)");
    await click("حفظ التعديلات");
    expect(text()).toContain("نظام المشتريات — المادة (12)");
    await click("✓ اعتماد");
    expect(host.querySelector(".rasd-ad-check")).toBeNull();
    await click("اعتماد نهائي");
    expect(getManualObservations()[0]?.legalBasis.source).toBe("auditor");
  });
});

describe("assistant thinking indicator", () => {
  it("shows a status line that describes what the assistant is doing, not bare dots", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // the model never answers
    await mount(<AssistantChat />);
    await click("اسأل المساعد");
    await click("لخّص لي وضع بياناتي الحالي");
    expect(host.querySelector(".rasd-ai-msg .rasd-dots")).toBeTruthy();
    expect(text()).toContain("يقرأ سؤالك…");
    expect(host.querySelector(".rasd-ai-msg")?.textContent).not.toBe("…");
  });
});
