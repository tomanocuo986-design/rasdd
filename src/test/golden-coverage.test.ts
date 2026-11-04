// «الاختبار الذهبي» لملاحظات ديوان المحاسبة المدمجة (seed-reports.js).
// تقريرا الديوان يحتويان نصوص الملاحظات دون بيانات الجداول الأصلية، فلا يمكن تشغيل المحرك عليها ومقارنة ما يلتقطه.
// لذلك يقيس هذا الاختبار شيئاً أضيق وأصدق: لكل ملاحظة، هل يستطيع البرنامج كشفها من جداوله؟ (src/test/golden/seed-coverage.json)
// ويمنع تقادم التصنيف: إضافة ملاحظة أو حقل أو اختبار جديد تُجبر على مراجعة الخريطة.
// التصنيف اجتهاد أولي يراجعه المدقق، وليس حكماً للديوان.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SEED_REPORTS } from "@/rasd/seed-reports.js";
import { auditSectors } from "@/rasd/workspace.jsx";
import { CHECKLIST } from "@/rasd/doc-review.js";
import golden from "./golden/seed-coverage.json";

type Item = {
  report: string;
  n: number;
  title: string;
  category: string;
  tests?: string[];
  data?: [string, string][];
  missing?: [string, string][];
  proposedTest?: string;
  reviewItem?: string;
  needsCrossDocument?: boolean;
  note: string;
};
const items = golden.items as Item[];
const categories = Object.keys(golden.categories);
const engineSource = fs.readFileSync(path.resolve(__dirname, "../rasd/audit-engine.js"), "utf8");
const fieldsOf = new Map<string, Set<string>>(
  (auditSectors as any[]).flatMap((s) => s.datasets).map((d: any) => [d.key, new Set<string>(d.fields.map((f: any) => f.key))]),
);
const has = ([ds, key]: [string, string]) => fieldsOf.get(ds)?.has(key) ?? false;

describe("golden coverage map of Audit Bureau seed observations", () => {
  it("classifies every seed observation exactly once, and nothing else", () => {
    const expected = (SEED_REPORTS as any[]).flatMap((r) => r.findings.map((f: any, i: number) => `${r.id}#${i + 1}|${f.test.slice(0, 60)}`));
    const actual = items.map((o) => `${o.report}#${o.n}|${o.title}`);
    expect(actual.sort()).toEqual(expected.sort());
  });

  it("uses only known categories", () => {
    for (const o of items) expect(categories, `${o.report}#${o.n}`).toContain(o.category);
  });

  it("covered_partially: every cited engine test really exists in the reference engine", () => {
    for (const o of items.filter((x) => x.category === "covered_partially")) {
      expect(o.tests?.length, `${o.report}#${o.n}`).toBeGreaterThan(0);
      for (const t of o.tests!) expect(engineSource.includes(`"${t}"`), `اختبار غير موجود في المحرك: ${t}`).toBe(true);
    }
  });

  it("data_exists_no_test: the data fields are really in the data model, and a test is proposed", () => {
    for (const o of items.filter((x) => x.category === "data_exists_no_test")) {
      expect(o.proposedTest, `${o.report}#${o.n}`).toBeTruthy();
      for (const f of o.data ?? []) expect(has(f), `الحقل غير موجود الآن: ${f.join(".")}`).toBe(true);
    }
  });

  it("needs_new_fields: the fields are still missing (if one was added, reclassify the observation)", () => {
    for (const o of items.filter((x) => x.category === "needs_new_fields")) {
      expect(o.missing?.length, `${o.report}#${o.n}`).toBeGreaterThan(0);
      for (const f of o.missing!) expect(has(f), `الحقل صار موجوداً، أعد تصنيف الملاحظة: ${f.join(".")}`).toBe(false);
    }
  });

  it("every classification carries a reason", () => {
    for (const o of items) expect(o.note.length, `${o.report}#${o.n}`).toBeGreaterThan(10);
  });

  it("document_review: each observation is either handled by a checklist item (that points back at it) or marked as needing several documents", () => {
    for (const o of items.filter((x) => x.category === "document_review")) {
      const tag = `${o.report}#${o.n}`;
      expect(Boolean(o.reviewItem) !== Boolean(o.needsCrossDocument), `${tag}: لازم واحد فقط من reviewItem / needsCrossDocument`).toBe(true);
      if (!o.reviewItem) continue;
      const item = CHECKLIST.find((c) => c.id === o.reviewItem);
      expect(item, `${tag}: بند غير موجود ${o.reviewItem}`).toBeTruthy();
      const short = o.report.includes("quwaira") ? "القويرة" : "رحمة";
      expect(item!.seedRef, tag).toBe(`${short} #${o.n}`);
    }
  });

  it("every checklist item is tied to exactly one seed observation", () => {
    const used = items.map((o) => o.reviewItem).filter(Boolean);
    expect(used.sort()).toEqual(CHECKLIST.map((c) => c.id).sort());
  });
});
