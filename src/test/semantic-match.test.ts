import { describe, it, expect } from "vitest";
import { SEED_REPORTS } from "@/rasd/seed-reports.js";
import { buildCorpus, compareObservation, compareObservationSemantic, THRESHOLDS } from "@/rasd/auditor-draft.js";
import { conceptsOf, arTokens } from "@/rasd/semantic-match.js";
import { tokens } from "@/rasd/auditor-draft.js";

const corpus = buildCorpus(SEED_REPORTS);
const idOf = (i: number) => corpus[i].id;

describe("semantic comparison", () => {
  it("stemmer stays identical to the lexical one", () => {
    for (const t of ["الشراء بأسلوب استدراج العروض دون مبررات", "تجزئة أوامر الشراء لمورد واحد"]) expect(arTokens(t)).toEqual(tokens(t));
  });
  it("maps synonyms to the same concept", () => {
    expect([...conceptsOf("تقسيم المشتريات")]).toContain("split");
    expect([...conceptsOf("تجزئة الأوامر")]).toContain("split");
  });
  it("reaches the 'recurring' threshold for a paraphrase the lexical score misses", () => {
    const q = "تم الاتفاق مع المقاول على دفع تعويض مقطوع وإعفائه من غرامة التأخير";
    const lex = compareObservation(q, corpus).all.find((m: any) => m.id === idOf(17));
    const sem = compareObservationSemantic(q, corpus).all.find((m: any) => m.id === idOf(17));
    expect(lex?.score ?? 0).toBeLessThan(THRESHOLDS.recurring);
    expect(sem.score).toBeGreaterThanOrEqual(THRESHOLDS.recurring);
    expect(sem.semantic.lifted).toBe(true);
  });
  it("never lowers a lexical score and keeps unrelated text below the pattern threshold", () => {
    const q = "الشراء بأسلوب استدراج العروض دون مبررات";
    const a = compareObservation(q, corpus).matches[0];
    const b = compareObservationSemantic(q, corpus).matches[0];
    expect(b.score).toBeGreaterThanOrEqual(a.score);
    for (const u of ["تعبئة محروقات لآلية خارج أوقات الدوام الرسمي دون أمر حركة", "صرف ساعات عمل إضافي تزيد عن الحد المسموح للموظف", "وجود فروقات في جرد المستودع بين الرصيد الدفتري والفعلي"])
      expect(compareObservationSemantic(u, corpus).matches[0]?.score ?? 0).toBeLessThan(THRESHOLDS.pattern);
  });
  it("falls back safely on empty input", () => {
    expect(compareObservationSemantic("أي ملاحظة", []).matches).toEqual([]);
  });
});
