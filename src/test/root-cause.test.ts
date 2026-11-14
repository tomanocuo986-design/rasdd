import { describe, it, expect } from "vitest";
import { analyzeRootCause, ROOT_CAUSE_LABELS } from "@/rasd/root-cause";
import { buildRootCausePrompt, parseAiRootCause, requestAiRootCause } from "@/rasd/root-cause-ai";
import { draftObservations, type AuditFinding } from "@/rasd/observations";

const cat = (test: string, extra: { condition?: string; count?: number; repeated?: number } = {}) =>
  analyzeRootCause({ test, ...extra }).category;

describe("analyzeRootCause (قواعد محلية)", () => {
  it("يصنّف الاختبارات المعروفة", () => {
    expect(cat("معتمد الصرف هو نفسه المستفيد", { count: 2 })).toBe("segregation");
    expect(cat("تطابق الرقم الوطني بين موظفين", { count: 2 })).toBe("integrity");
    expect(cat("احتمال تجزئة مشتريات", { count: 3 })).toBe("integrity");
    expect(cat("تجمّع مبالغ تحت سقف الصلاحية", { count: 3 })).toBe("integrity");
    expect(cat("حقل جوهري لم يُدخل", { count: 3 })).toBe("it_data");
    expect(cat("نقدية غير مودعة", { count: 3 })).toBe("process");
    expect(cat("تجاوز الحد المسموح للصرف", { count: 3 })).toBe("control_design");
  });

  it("التكرار في تقارير سابقة يرجّح ضعف المتابعة", () => {
    const r = analyzeRootCause({ test: "نقدية غير مودعة", count: 3, repeated: 3 });
    expect(r.category).toBe("oversight");
    expect(r.evidence.join(" ")).toContain("تقارير سابقة");
  });

  it("لا يدّعي سبباً حين لا تكفي الدلالات", () => {
    const r = analyzeRootCause({ test: "ملاحظة عامة", count: 1 });
    expect(r.category).toBe("undetermined");
    expect(r.confidence).toBe("low");
  });

  it("يعيد دائماً صياغة وسلسلة لماذا ومعالجة وأدلة", () => {
    for (const test of ["معتمد الصرف هو نفسه", "قيد مكرر", "خطأ في الاحتساب"]) {
      const r = analyzeRootCause({ test, count: 2 });
      expect(r.label).toBe(ROOT_CAUSE_LABELS[r.category]);
      expect(r.statement.length).toBeGreaterThan(20);
      expect(r.whys.length).toBeGreaterThanOrEqual(2);
      expect(r.fix).toBeTruthy();
      expect(r.evidence.length).toBeGreaterThan(0);
      expect(r.source).toBe("rules");
    }
  });

  it("مؤشرات التحايل تُصاغ تحققاً لا اتهاماً", () => {
    expect(analyzeRootCause({ test: "تطابق رقم هاتف بين مورد وموظف", count: 2 }).statement).toContain("لا تُعدّ اتهاماً");
  });

  it("تُرفق الملاحظات المصاغة آلياً باقتراح السبب الجذري", () => {
    const f: AuditFinding = { dataset: "Direct_Purchases_Orders", sector: "procurement", test: "احتمال تجزئة مشتريات", severity: "high", ref: "PO-1" };
    const [o] = draftObservations([f, { ...f, ref: "PO-2" }]);
    expect(o?.rootCause?.category).toBe("integrity");
    // حقل «السبب» الأصلي لا يتغير
    expect(o?.cause).toBeTruthy();
    expect(o?.cause).not.toBe(o?.rootCause?.statement);
  });
});

describe("الذكاء الاصطناعي الاختياري", () => {
  const input = { test: "قيد مكرر", condition: "قيدان بنفس المبلغ", count: 2 };
  const local = analyzeRootCause(input);
  const good = JSON.stringify({
    category: "it_data",
    confidence: "high",
    statement: "النظام يقبل قيوداً مكررة لعدم وجود قاعدة تحقق عند الإدخال.",
    whys: ["قيدان متطابقان", "لا منع للتكرار", "لم تُحدَّد قواعد التحقق"],
    fix: "إضافة قاعدة منع تكرار",
  });

  it("يبني طلباً يحوي الفئات والعنوان ويطلب JSON فقط", () => {
    const p = buildRootCausePrompt(input, local);
    expect(p).toContain("قيد مكرر");
    expect(p).toContain("control_design");
    expect(p).toContain("JSON");
  });

  it("يقرأ الرد حتى لو أحاط به نص أو سياج شيفرة، ولا يرفع الثقة فوق متوسطة", () => {
    const r = parseAiRootCause("```json\n" + good + "\n```", local);
    expect(r?.source).toBe("ai");
    expect(r?.category).toBe("it_data");
    expect(r?.confidence).toBe("medium");
  });

  it("يرفض الرد غير الصالح", () => {
    expect(parseAiRootCause("لا أعرف", local)).toBeUndefined();
    expect(parseAiRootCause('{"category":"x","statement":"جملة طويلة بما يكفي للقبول"}', local)).toBeUndefined();
    expect(parseAiRootCause('{"category":"it_data","statement":"قصير"}', local)).toBeUndefined();
  });

  it("يرسل الطلب إلى /api/chat بوضع analyze ويعيد التحليل", async () => {
    let sent: { url: string; body: { mode: string; messages: { role: string }[] } } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return new Response(good, { status: 200 });
    }) as unknown as typeof fetch;
    const r = await requestAiRootCause(input, local, { fetchImpl });
    expect(sent?.url).toBe("/api/chat");
    expect(sent?.body.mode).toBe("analyze");
    expect(sent?.body.messages[0]?.role).toBe("user");
    expect(r.source).toBe("ai");
  });

  it("يمرّر رسالة الخادم عند الرفض (مزود غير مفعّل أو ممنوع)", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: "المساعد غير مفعّل" }), { status: 503, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    await expect(requestAiRootCause(input, local, { fetchImpl })).rejects.toThrow("المساعد غير مفعّل");
  });
});
