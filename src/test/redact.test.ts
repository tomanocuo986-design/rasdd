import { describe, expect, it } from "vitest";
import { redactDocument, redactionSummary, restoreText } from "@/rasd/redact.js";
import { CHECKLIST_IDS, reviewDocumentRedacted } from "@/rasd/doc-review.js";

const red = (t: string, extraTerms: string[] = []) => redactDocument(t, { extraTerms });

describe("what is redacted", () => {
  it("national ids (Latin and Arabic digits), Jordanian phones, IBAN and emails", () => {
    const r = red("الرقم الوطني 9900000137 و٩٩٠٠٠٠٠١٣٧٥ هاتف 0791234567 و+962 78 5551234 و00962771234567 حساب JO94CBJO0010000000000131000302 بريد a.b@mail.com");
    expect(r.text).not.toMatch(/9900000137|٩٩٠٠٠٠٠١٣٧٥|0791234567|5551234|771234567|JO94|a\.b@/);
    expect(r.counts).toEqual({ nid: 2, phone: 3, iban: 1, email: 1 });
  });

  it("names that follow a title, up to the first stop word; keeps the title and what follows", () => {
    const r = red("قدّم السيد أحمد محمود علي الخطيب العرض. وأحال المهندس خالد في البلدية وأقرّ الدكتورة ليلى حداد.");
    expect(r.text).toContain("السيد [اسم_1] العرض");
    expect(r.text).toContain("المهندس [اسم_2] في البلدية");
    expect(r.text).toContain("الدكتورة [اسم_3]");
    expect(r.text).not.toMatch(/أحمد|خالد|ليلى|الخطيب/);
  });

  it("the auditor's own terms, longest first, case-insensitively", () => {
    const r = red("فازت شركة النور للمقاولات وتنافست النور وACME Ltd و acme ltd", ["النور", "شركة النور للمقاولات", "ACME Ltd"]);
    expect(r.text).not.toMatch(/النور|ACME|acme/i);
    expect(r.counts["term"]).toBe(4);
  });

  it("same text gets the same placeholder", () => {
    const r = red("السيد سامي ناصر، ثم السيد سامي ناصر. وكذلك 9900000137 و9900000137");
    expect(r.text.match(/\[اسم_1\]/g)).toHaveLength(2);
    expect(r.text.match(/\[رقم_وطني_1\]/g)).toHaveLength(2);
    expect(r.map.size).toBe(2);
  });
});

describe("known limit: names are captured by pattern, so the error direction is over-redaction", () => {
  it("without punctuation up to 3 words after the first name word may be swallowed, never fewer (safe side)", () => {
    const r = red("قدّم السيد سامي ناصر مرة أخرى العرض");
    expect(r.text).not.toMatch(/سامي|ناصر/);
  });
  it("a person without a title is not caught unless the auditor lists the name", () => {
    expect(red("قدّم سامي ناصر العرض").text).toContain("سامي ناصر");
    expect(red("قدّم سامي ناصر العرض", ["سامي ناصر"]).text).not.toContain("سامي");
  });
});

describe("what must stay (the checklist needs it)", () => {
  it("amounts, dates, tender and article numbers, short numbers, public bodies", () => {
    const t = "قيمة العطاء 24,839 دينارًا و1500 دينار بتاريخ 2026-06-23 و23/6/2026 كتاب 1559/4/9/12 والعطاء (2024/7) المادة (39) من نظام المشتريات الحكومية رقم (8) لسنة 2022 بلدية القويرة";
    const r = red(t);
    expect(r.text).toBe(t);
    expect(r.total).toBe(0);
  });
});

describe("restore", () => {
  it("round-trips exactly", () => {
    const t = "السيد أحمد محمود علي أحال 9900000137 وهاتفه 0791234567 وبريده x@y.org وشركة النور.";
    const r = red(t, ["شركة النور"]);
    expect(r.text).not.toBe(t);
    expect(restoreText(r.text, r.map)).toBe(t);
  });
  it("summary lists the counts, and says so when nothing matched", () => {
    expect(redactionSummary({ nid: 2, name: 1 })).toBe("حُجب: 2 رقم وطني، 1 اسم بلقب");
    expect(redactionSummary({})).toContain("لم يُحجب شيء");
  });
});

describe("review with redaction (fake model)", () => {
  const doc = "يحدد الإعلان أن مكان تقديم العروض هو ديوان بلدية القويرة وأن العرض قدّمه السيد أحمد محمود علي الخطيب هاتفه 0791234567 والرقم الوطني 9900000137 في المقر";
  const answer = (id: string, verdict: string, quote = "") => ({ id, verdict, quote, explanation: "x" });

  it("nothing personal reaches the model; quotes verify against what the model saw and are restored for display", async () => {
    const seen: string[] = [];
    const r = await reviewDocumentRedacted(doc, async (chunk: string) => {
      seen.push(chunk);
      return JSON.stringify([answer("ad_details", "present", "العرض قدّمه السيد [اسم_1] هاتفه [هاتف_1] والرقم الوطني [رقم_وطني_1]")]);
    });
    expect(seen.join("\n")).not.toMatch(/أحمد|الخطيب|0791234567|9900000137/);
    const ad = r.results.find((x: any) => x.id === "ad_details")!;
    expect(ad.status).toBe("verified_present");
    expect(ad.quote).toContain("أحمد محمود علي الخطيب");
    expect(ad.quote).toContain("0791234567");
    expect(r.redaction.total).toBe(3);
    expect(r.redaction.summary).toContain("حُجب");
  });

  it("a quote that uses the original (unredacted) text is NOT accepted: the model never saw it", async () => {
    const r = await reviewDocumentRedacted(doc, async () => JSON.stringify([answer("ad_details", "present", "العرض قدّمه السيد أحمد محمود علي الخطيب هاتفه 0791234567")]));
    expect(r.results.find((x: any) => x.id === "ad_details")!.status).toBe("unverified_claim");
  });

  it("extra terms are redacted before sending", async () => {
    const seen: string[] = [];
    await reviewDocumentRedacted("فازت شركة النور للمقاولات بالعطاء وتسلّمت مؤسسة الندى الدفعة الأولى كاملة", async (c: string) => (seen.push(c), "[]"), { extraTerms: ["شركة النور للمقاولات", "مؤسسة الندى"] });
    expect(seen.join("")).not.toMatch(/النور|الندى/);
  });

  it("still returns one result per checklist item", async () => {
    const r = await reviewDocumentRedacted(doc, async () => "[]");
    expect(r.results.map((x: any) => x.id)).toEqual(CHECKLIST_IDS);
  });
});
