import { beforeEach, describe, expect, it } from "vitest";
import {
  approveChatDraft,
  discardChatDraft,
  extractObservationText,
  findLegalBasis,
  formalCondition,
  isObservationText,
  makeChatDraft,
} from "@/rasd/chat-draft.js";
import { buildCorpus } from "@/rasd/auditor-draft.js";
import { getManualObservations } from "@/rasd/manual-observations";
import { loadIds, reportable } from "@/rasd/observations";
import { loadReviewLog } from "@/rasd/review-log.js";

const LAW = {
  id: "law1",
  name: "نظام المشتريات الحكومية",
  effectiveDate: "2025-01-01",
  text:
    "المادة 12\nلا يجوز تجزئة المشتريات بقصد التهرب من سقف الشراء المباشر أو الهروب من الطرح التنافسي، ويعد شراء نفس الصنف من المورد نفسه خلال فترة قصيرة تجزئة.\n\n" +
    "المادة 20\nتحفظ سجلات الموظفين والرواتب وفق التعليمات المعمول بها في الجهة.",
};

const PAST = [
  {
    id: "r1",
    name: "تقرير سابق",
    date: "2025-12-01",
    findings: [],
    observations: [
      {
        id: "o1",
        dataset: "Maintenance_Orders",
        test: "تضخم تكلفة صيانة الآليات",
        condition: "تكلفة صيانة الآليات أعلى من متوسط الأسطول",
        recommendation: "اشتراط عروض أسعار وفحص فني مستقل",
        risk: { rating: "medium" },
      },
    ],
  },
];

beforeEach(() => localStorage.clear());

describe("recognising an observation typed in the assistant", () => {
  it("treats audit phrasing and explicit commands as observations, not questions", () => {
    expect(isObservationText("لوحظ صرف مبلغ 12,000 دينار لمورد واحد على أوامر شراء متتالية")).toBe(true);
    expect(isObservationText("صغ لي ملاحظة: تأخر تسوية السلف المفتوحة منذ أكثر من سنة")).toBe(true);
    expect(isObservationText("ما أهم الملاحظات التي تحتاج مراجعة؟")).toBe(false);
    expect(isObservationText("لخّص لي وضع بياناتي الحالي")).toBe(false);
    expect(isObservationText("لوحظ")).toBe(false);
  });

  it("strips the command and words the condition formally", () => {
    expect(extractObservationText("صغ لي ملاحظة: تأخر تسوية السلف")).toBe("تأخر تسوية السلف");
    expect(formalCondition("تأخر تسوية السلف")).toBe("لوحظ تأخر تسوية السلف.");
    expect(formalCondition("لوحظ تأخر تسوية السلف.")).toBe("لوحظ تأخر تسوية السلف.");
  });
});

describe("legal basis comes from the uploaded library only", () => {
  it("quotes the document name and the article number found in the passage", async () => {
    const r = await findLegalBasis("تجزئة المشتريات لنفس المورد", [LAW]);
    expect(r.basis.source).toBe("library");
    expect(r.basis.text).toContain("نظام المشتريات الحكومية");
    expect(r.basis.text).toContain("المادة (12)");
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it("is «no basis» when the library is empty or unrelated", async () => {
    expect((await findLegalBasis("أي شيء", [])).basis.source).toBe("default");
    expect((await findLegalBasis("zzzz qqqq", [LAW])).basis.source).toBe("default");
  });
});

describe("drafting a new observation", () => {
  const text = "لوحظ شراء أصناف متماثلة من المورد نفسه عبر أوامر شراء متتالية خلال أسبوع لتفادي سقف الشراء المباشر";

  it("rewrites it with condition, cause, legal basis, effect, recommendation and a rating", async () => {
    const d = await makeChatDraft(text, { corpus: buildCorpus(PAST), docs: [LAW] });
    expect(d.exists).toBe(false);
    for (const k of ["condition", "cause", "effect", "recommendation", "title"]) expect(String(d[k]).length).toBeGreaterThan(5);
    expect(["high", "medium", "low"]).toContain(d.severity);
    expect(d.legalBasis.source).toBe("library");
    expect(d.analysis.status).toBe("new");
  });

  it("does not redraft one that already appears in a previous report, unless forced", async () => {
    const dup = "تضخم تكلفة صيانة الآليات وتكلفة الصيانة أعلى من متوسط الأسطول";
    const d = await makeChatDraft(dup, { corpus: buildCorpus(PAST), docs: [LAW] });
    expect(d.exists).toBe(true);
    expect(d.matches[0].report).toBe("تقرير سابق");
    const forced = await makeChatDraft(dup, { corpus: buildCorpus(PAST), docs: [LAW], force: true });
    expect(forced.exists).toBe(false);
    expect(forced.condition).toBeTruthy();
  });
});

describe("the auditor's decision", () => {
  const text = "لوحظ شراء أصناف متماثلة من المورد نفسه عبر أوامر شراء متتالية خلال أسبوع لتفادي سقف الشراء المباشر";

  it("approval with a library basis adds it to the report observations", async () => {
    const d = await makeChatDraft(text, { corpus: [], docs: [LAW] });
    const r = approveChatDraft(d, "procurement");
    expect(r.ok).toBe(true);
    const saved = getManualObservations();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ status: "approved", manual: true, sector: "procurement", isNew: true });
    expect(saved[0].legalBasis.source).toBe("library");
    expect(loadIds("approved").has(saved[0].id)).toBe(true);
    expect(reportable(saved)).toHaveLength(1);
    expect(loadReviewLog().length).toBeGreaterThan(0);
  });

  it("without a library basis needs an explicit confirmation first", async () => {
    const d = await makeChatDraft(text, { corpus: [], docs: [] });
    expect(d.legalBasis.source).toBe("default");
    expect(approveChatDraft(d, "procurement")).toMatchObject({ ok: false, needsConfirm: true });
    expect(getManualObservations()).toHaveLength(0);
    expect(approveChatDraft(d, "procurement", { confirmedNoBasis: true }).ok).toBe(true);
    expect(getManualObservations()).toHaveLength(1);
  });

  it("edits made before approval are what gets saved", async () => {
    const d = await makeChatDraft(text, { corpus: [], docs: [LAW] });
    const edited = {
      ...d,
      severity: "low" as const,
      cause: "سبب عدله المدقق",
      legalBasis: { source: "auditor" as const, text: "تعليمات الجهة: البند 3", needsVerification: false },
    };
    approveChatDraft(edited, "finance");
    const o = getManualObservations()[0];
    expect(o.risk.rating).toBe("low");
    expect(o.cause).toBe("سبب عدله المدقق");
    expect(o.legalBasis).toMatchObject({ source: "auditor", text: "تعليمات الجهة: البند 3" });
  });

  it("deleting records the decision and adds nothing to the report", async () => {
    const d = await makeChatDraft(text, { corpus: [], docs: [LAW] });
    discardChatDraft(d, "الحالة موثقة بمستند رسمي");
    expect(getManualObservations()).toHaveLength(0);
    expect(loadIds("approved").size).toBe(0);
    expect(loadReviewLog().length).toBeGreaterThan(0);
  });
});
