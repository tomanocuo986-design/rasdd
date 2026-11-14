import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RootCausePanel } from "@/rasd/RootCausePanel";

const input = { test: "قيد مكرر", condition: "قيدان بنفس المبلغ", count: 2 };
const aiBody = JSON.stringify({
  category: "it_data",
  confidence: "medium",
  statement: "النظام يقبل قيوداً مكررة لعدم وجود قاعدة تحقق عند الإدخال.",
  whys: ["أ", "ب", "ج"],
  fix: "منع التكرار",
});

describe("RootCausePanel", () => {
  it("يعرض الاقتراح المحلي ويعتمده كسبب بإرادة المدقق فقط", () => {
    const onUse = vi.fn();
    render(<RootCausePanel input={input} currentCause="سبب قديم" onUse={onUse} />);
    expect(screen.getByTestId("root-cause-label").textContent).toBeTruthy();
    expect(onUse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("root-cause-use"));
    expect(onUse).toHaveBeenCalledWith(screen.getByTestId("root-cause-statement").textContent);
  });

  it("يعطّل زر الاعتماد إن طابق السبب الحالي الاقتراح", () => {
    const onUse = vi.fn();
    const { rerender } = render(<RootCausePanel input={input} onUse={onUse} />);
    const statement = screen.getByTestId("root-cause-statement").textContent ?? "";
    rerender(<RootCausePanel input={input} currentCause={statement} onUse={onUse} />);
    expect((screen.getByTestId("root-cause-use") as HTMLButtonElement).disabled).toBe(true);
  });

  it("زر الذكاء الاصطناعي يستبدل العرض ويمكن الرجوع للمحلي", async () => {
    const fetchImpl = (async () => new Response(aiBody, { status: 200 })) as unknown as typeof fetch;
    render(<RootCausePanel input={input} onUse={() => {}} fetchImpl={fetchImpl} />);
    const local = screen.getByTestId("root-cause-statement").textContent;
    fireEvent.click(screen.getByTestId("root-cause-ai"));
    await waitFor(() => expect(screen.getByTestId("root-cause-statement").textContent).toContain("قواعد تحقق"));
    fireEvent.click(screen.getByText("العودة للاقتراح المحلي"));
    expect(screen.getByTestId("root-cause-statement").textContent).toBe(local);
  });

  it("يعرض رسالة الخطأ ويُبقي الاقتراح المحلي", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: "سجّل الدخول لاستخدام المساعد." }), { status: 401, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    render(<RootCausePanel input={input} fetchImpl={fetchImpl} />);
    const local = screen.getByTestId("root-cause-statement").textContent;
    fireEvent.click(screen.getByTestId("root-cause-ai"));
    await waitFor(() => expect(screen.getByTestId("root-cause-error").textContent).toContain("سجّل الدخول"));
    expect(screen.getByTestId("root-cause-statement").textContent).toBe(local);
  });
});
