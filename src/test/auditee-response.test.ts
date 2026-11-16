import { describe, it, expect, beforeEach } from "vitest";
import {
  analyzeResponse,
  attachResponses,
  decide,
  loadResponses,
  parseAiAnalysis,
  reportBlock,
  saveResponses,
  setResponseText,
  splitBulkResponses,
  summarizeResponses,
  withAnalysis,
  extractDate,
  type RecordMap,
} from "@/rasd/auditee-response";
import type { Observation } from "@/rasd/observations";

const obs = {
  id: "o1",
  test: "تقرير إنجاز مكرر بين موظفين",
  condition: "صدرت 9 حالة بعنوان «تقرير إنجاز مكرر بين موظفين» في العمل الإضافي والمكافآت",
  recommendation:
    "تفعيل منع التكرار على رقم المستند والمستفيد والفترة، ومراجعة الحالات وتسوية المكرر.",
  cause: "غياب فحص آلي للتكرار",
  count: 9,
};

describe("analyzeResponse", () => {
  it("رد فارغ أو قصير: لا يكفي للحكم", () => {
    expect(analyzeResponse(obs, "").verdict).toBe("insufficient");
    expect(analyzeResponse(obs, "تم").verdict).toBe("insufficient");
  });
  it("اعتراض بلا مستند: غير كافٍ", () => {
    const a = analyzeResponse(
      obs,
      "لا نوافق على الملاحظة، فلا يوجد مخالفة في تقارير الإنجاز والعمل الإضافي.",
    );
    expect(a.stance).toBe("rejects");
    expect(a.verdict).toBe("not_accepted");
  });
  it("اعتراض مع مستند: يلزم تحقق ولا يُقبل آلياً", () => {
    const a = analyzeResponse(
      obs,
      "لا نوافق، التقارير سليمة كما في الكتاب رقم 55 المرفق بشأن تقرير الإنجاز.",
    );
    expect(a.verdict).toBe("insufficient");
  });
  it("وعد بلا موعد ولا مسؤول: جزئي ويذكر الفجوة", () => {
    const a = analyzeResponse(
      obs,
      "نوافق على الملاحظة وسيتم تفعيل منع التكرار على رقم المستند والمستفيد ومراجعة الحالات.",
    );
    expect(a.verdict).toBe("partially_accepted");
    expect(a.gaps.join(" ")).toContain("موعد");
  });
  it("إجراء منفذ ومسند بمستند ويغطي التوصية: كافٍ مبدئياً", () => {
    const a = analyzeResponse(
      obs,
      "نوافق على الملاحظة. تم تفعيل منع التكرار على رقم المستند والمستفيد والفترة، وتمت مراجعة الحالات وتسوية المكرر بموجب القرار رقم 12 المرفق.",
    );
    expect(a.verdict).toBe("accepted");
  });
  it("عدد حالات مختلف يمنع الوصف بالكافي", () => {
    const a = analyzeResponse(
      obs,
      "نوافق. تم تفعيل منع التكرار على رقم المستند والمستفيد والفترة وتمت مراجعة 3 حالات وتسوية المكرر بموجب القرار رقم 12 المرفق.",
    );
    expect(a.verdict).toBe("partially_accepted");
    expect(a.reasons.join(" ")).toContain("9");
  });
  it("رد تبريري بلا إجراء: غير كافٍ", () => {
    const a = analyzeResponse(obs, "حدث ذلك بسبب نقص الكوادر وضغط العمل في نهاية الشهر.");
    expect(a.verdict).toBe("not_accepted");
  });
  it("رد لا علاقة له: لا يُقبل", () => {
    const a = analyzeResponse(
      obs,
      "سيتم شراء أجهزة حاسوب جديدة للمكتبة خلال العام القادم بإذن الله.",
    );
    expect(["insufficient", "not_accepted"]).toContain(a.verdict);
  });
  it("يستخرج الموعد", () => {
    expect(extractDate("سيتم التنفيذ بتاريخ 30/06/2026")).toBe("30/06/2026");
    expect(extractDate("خلال 3 أشهر من تاريخه")).toContain("خلال 3");
  });
  it("دالة نقية: نفس المدخل نفس الناتج", () => {
    const r = "نوافق وتم التصويب بموجب القرار رقم 3 المرفق.";
    expect(analyzeResponse(obs, r)).toEqual(analyzeResponse(obs, r));
  });
});

describe("مطابقة الصيغ المختلفة وقراءة الفجوات", () => {
  const cash = {
    ...obs,
    test: "نقدية غير مودعة",
    condition: "نقدية محصّلة لم تُودع في الحساب البنكي في المهلة المحددة",
    recommendation: "إيداع النقدية يومياً وربط الإيداع بإشعار بنكي ومراجعة المهل",
    count: 3,
  };
  it("«إيداع» في الرد تطابق «مودعة» في الملاحظة (ليس رداً بلا صلة)", () => {
    const a = analyzeResponse(
      cash,
      "نوافق على الملاحظة وسيتم إيداع المبالغ خلال شهر من قبل مديرية الشؤون المالية.",
    );
    expect(a.verdict).toBe("partially_accepted");
    expect(a.reasons.join(" ")).not.toContain("لا يتناول موضوع");
  });
  it("الفجوات بكلمات مقروءة لا بجذور مقطوعة", () => {
    const a = analyzeResponse(cash, "حدث ذلك بسبب نقص الكوادر وضغط العمل في نهاية الشهر.");
    const gap = a.gaps.join(" ");
    expect(gap).toContain("إشعار");
    expect(gap).not.toMatch(/(^|[\s،])(زام|مهل|اشعار)([\s،]|$)/);
  });
});

describe("اعتماد المدقق وربط التقرير", () => {
  beforeEach(() => localStorage.clear());
  const base = (): RecordMap => {
    let m = setResponseText({}, "o1", "نوافق وسيتم التنفيذ خلال شهر من قبل مديرية الشؤون المالية.");
    m = withAnalysis(m, "o1", analyzeResponse(obs, m["o1"]!.response));
    return m;
  };
  it("التعقيب لا يدخل التقرير قبل الاعتماد، ونص الرد يدخل", () => {
    const b = reportBlock(base()["o1"]);
    expect(b?.response).toContain("نوافق");
    expect(b?.opinion).toBeUndefined();
  });
  it("الاعتماد والتعديل والرفض", () => {
    const m = base();
    const ok = decide(m, "o1", "approved");
    expect(ok["o1"]?.decision).toBe("approved");
    expect(reportBlock(ok["o1"])?.opinion).toBeTruthy();
    const ed = decide(m, "o1", "approved", { opinion: "تعقيب بصياغة المدقق" });
    expect(ed["o1"]?.decision).toBe("edited");
    expect(reportBlock(ed["o1"])?.opinion).toBe("تعقيب بصياغة المدقق");
    const no = decide(ok, "o1", "rejected");
    expect(reportBlock(no["o1"])?.opinion).toBeUndefined();
  });
  it("تغيّر نص الرد يُسقط الاعتماد", () => {
    const ok = decide(base(), "o1", "approved");
    const changed = setResponseText(ok, "o1", "رد جديد مختلف تماماً عن الأول وأطول منه.");
    expect(changed["o1"]?.decision).toBe("pending");
    expect(changed["o1"]?.analysis).toBeUndefined();
  });
  it("لا اعتماد دون تحليل", () => {
    const m = setResponseText({}, "o1", "رد بلا تحليل بعد وهو نص طويل كفاية");
    expect(decide(m, "o1", "approved")).toBe(m);
  });
  it("حفظ وتحميل وإلحاق بالملاحظات وملخص", () => {
    const m = decide(base(), "o1", "approved");
    saveResponses(m);
    expect(loadResponses()["o1"]?.decision).toBe("approved");
    const list = attachResponses([
      { ...(obs as unknown as Observation) },
      { ...(obs as unknown as Observation), id: "o2" },
    ]);
    expect(list[0]?.auditee?.opinion).toBeTruthy();
    expect(list[1]?.auditee).toBeUndefined();
    expect(summarizeResponses([{ id: "o1" }, { id: "o2" }], m)).toMatchObject({
      total: 2,
      withResponse: 1,
      approved: 1,
    });
  });
});

describe("ردود مجمّعة", () => {
  const list = [
    { id: "a", test: "تقرير إنجاز مكرر بين موظفين" },
    { id: "b", test: "نقدية غير مودعة" },
  ];
  it("يطابق بالعنوان ثم بالرقم", () => {
    const m = splitBulkResponses(
      "1. رد آخر\nنوافق وسنعالج.\n2. نقدية غير مودعة\nتم الإيداع.",
      list,
    );
    expect(m.find((x) => x.id === "b")?.by).toBe("title");
    expect(m.find((x) => x.id === "a")?.by).toBe("number");
  });
});

describe("رأي الذكاء الاصطناعي", () => {
  const local = analyzeResponse(obs, "حدث ذلك بسبب نقص الكوادر وضغط العمل في نهاية الشهر.");
  it("يرفض JSON غير صالح", () => expect(parseAiAnalysis("لا", local)).toBeUndefined());
  it("لا يرفع الحكم أكثر من درجة", () => {
    const raw = JSON.stringify({
      verdict: "accepted",
      opinion: "رأي طويل بما يكفي للقبول",
      followUp: "تعقيب طويل بما يكفي للقبول",
    });
    const r = parseAiAnalysis(raw, local);
    expect(r?.verdict).toBe("insufficient");
    expect(r?.source).toBe("ai");
  });
});
