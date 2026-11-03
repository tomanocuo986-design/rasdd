import { describe, expect, it } from "vitest";
import { articleOf, buildQuery, chunkText, retrievePassages, tokenize, toPayload } from "../rasd/legal-retrieval.js";

const TEXT = `المادة (12) لا يجوز تجزئة المشتريات بقصد التهرب من الطرح التنافسي أو تجاوز سقف الشراء المباشر. وتعد التجزئة مخالفة توجب المساءلة.
المادة (13) يحظر على الموظف المشاركة في أي إجراء شراء يكون له فيه مصلحة شخصية، ويجب عليه الإفصاح عن تضارب المصالح.
المادة (20) تصرف أجور عمال المياومة بموجب كشوف معتمدة وبحسب أيام العمل الفعلية.`;
const DOCS = [{ id: "d1", name: "نظام المشتريات", text: TEXT, effectiveDate: "2022-01-01" }];

describe("legal retrieval (RAG)", () => {
  it("chunks at article boundaries and reads the article number from the text only", () => {
    const chunks = chunkText(TEXT);
    expect(chunks.map(articleOf)).toEqual(["12", "13", "20"]);
    expect(articleOf("نص بلا رقم مادة في أوله")).toBe("");
    expect(articleOf("مادة ١٥ تنص على")).toBe("15"); // أرقام هندية
  });

  it("ranks the relevant article first, across prefixes and spelling variants", () => {
    const a = retrievePassages(DOCS, "تجزئة المشتريات لتفادي سقف الشراء المباشر");
    expect(a[0].article).toBe("12");
    const b = retrievePassages(DOCS, "المورد هو نفسه موظف وهناك تضارب مصالح");
    expect(b[0].article).toBe("13");
    const c = retrievePassages(DOCS, "أجور عمال المياومة");
    expect(c[0].article).toBe("20");
  });

  it("returns nothing for an unrelated query and for an empty library", () => {
    expect(retrievePassages(DOCS, "كيف أطبخ الأرز")).toHaveLength(0);
    expect(retrievePassages([], "تجزئة المشتريات")).toHaveLength(0);
  });

  it("drops garbled (kashida-corrupted) chunks instead of citing them", () => {
    const bad = [{ id: "x", name: "تالف", text: "المادة (1) تجزههههههئة المشتههههريات ممنوعههههة نظامًا في كل الأحوال ههههه" }];
    expect(retrievePassages(bad, "تجزئة المشتريات")).toHaveLength(0);
  });

  it("builds a richer query for analyze/report from top findings", () => {
    const ctx = { audit: { topFindings: [{ test: "تجزئة مشتريات", detail: "ثلاث عمليات متتالية" }] } };
    expect(buildQuery("حلل", ctx, "chat")).toBe("حلل");
    expect(buildQuery("حلل", ctx, "report")).toContain("تجزئة مشتريات");
  });

  it("payload carries document name, article and effective date, within size limits", () => {
    const p = toPayload(retrievePassages(DOCS, "أجور المياومة"));
    expect(p[0].source).toBe("نظام المشتريات — المادة 20 — نفاذ 2022-01-01");
    expect(p[0].text.length).toBeLessThanOrEqual(1000);
    expect(tokenize("والمشتريات بالتجزئة")).toEqual(["مشتريات", "تجزيه"]);
  });
});
