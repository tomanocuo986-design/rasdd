import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildReportDocx, conclusionLevel } from "@/rasd/report-docx";
import { draftObservations, type Observation } from "@/rasd/observations";

const template = readFileSync(join(__dirname, "../../public/templates/audit-report-template.docx"));

const mk = (test: string, severity: "high" | "medium" | "low", n = 1, extra: Record<string, unknown> = {}) =>
  draftObservations(
    Array.from({ length: n }, (_, i) => ({ dataset: "Direct_Purchases_Orders", sector: "procurement", row: i, test, ref: `PO-${i + 1}`, severity, ...extra })),
  )[0] as Observation;

const sample = (): Observation[] => [
  { ...mk("احتمال تجزئة مشتريات", "high", 6), status: "approved" },
  { ...mk("إضافي بلا اعتماد مسبق للساعات", "medium", 2), status: "approved" },
  { ...mk("تاريخ غير مدخل في أمر الشراء", "low", 1), status: "approved" },
];

async function build(list: Observation[], meta = {}) {
  const bytes = await buildReportDocx(template, { date: "2026-11-03", observations: list }, meta);
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")!.async("string");
  return { bytes, zip, xml };
}

describe("Word report on the Audit Bureau template", () => {
  it("clones one detail table per observation and fills condition, basis, cause, effect and recommendation", async () => {
    const list = sample();
    const { xml, bytes } = await build(list);
    if (process.env["RASD_DOCX_OUT"]) writeFileSync(process.env["RASD_DOCX_OUT"], bytes);
    for (const o of list) {
      expect(xml).toContain(o.test);
      expect(xml).toContain(o.cause.slice(0, 20));
      expect(xml).toContain(o.effect.slice(0, 20));
      expect(xml).toContain(o.recommendation.slice(0, 20));
    }
    for (const label of ["الحالة: ", "السند القانوني: ", "السبب: ", "الأثر: "]) expect(xml.split(label).length - 1).toBe(3);
    // جداول الملاحظات المفصلة: واحد لكل ملاحظة بدل الثلاثة النموذجية
    expect(xml.split("تعقيب الديوان").length - 1).toBe(3);
    expect(xml).toContain("_RasdObs3");
  });

  it("lists the observations in the summary table and drops the template samples", async () => {
    const { xml } = await build(sample());
    expect(xml).not.toContain("يتقرر لاحقا</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w=\"916\"".repeat(2));
    expect((xml.match(/PAGEREF _RasdObs/g) ?? []).length).toBe(3);
  });

  it("selects the general conclusion by the template rule and removes instruction paragraphs", async () => {
    const list = sample();
    expect(conclusionLevel(list)).toBe(3); // 1 من 3 مرتفعة = 33% > 25%
    const { xml } = await build(list);
    expect(xml).toContain("لم يتم تصميمها بشكل كاف");
    expect(xml).not.toContain("في حاجة إلى التحسين");
    expect(xml).not.toContain("تم تصميمها بشكل كاف وتعمل");
    expect(xml).not.toContain("هذه الفقرة مناسبة في حال وجود عدد 3");
    expect(conclusionLevel([{ ...mk("تاريخ غير مدخل", "low") }])).toBe(1);
    expect(conclusionLevel([mk("احتمال تجزئة مشتريات", "high"), ...Array.from({ length: 5 }, () => mk("تاريخ غير مدخل", "low"))])).toBe(2);
  });

  it("fills the cover and scope placeholders only with what the auditor entered", async () => {
    const { xml } = await build(sample(), { entity: "بلدية القويرة", subject: "تدقيق العطاءات", year: "2026", from: "01/01/2026", to: "30/06/2026" });
    expect(xml).toContain("بلدية القويرة / تقرير تدقيق – تدقيق العطاءات");
    expect(xml).toContain("01/01/2026");
    expect(xml).toContain("30/06/2026");
    const bare = await build(sample());
    // بلا بيانات يبقى نص القالب كما هو (الغلاف مجزّأ على عدة مقاطع في XML)
    expect(bare.xml).toContain("موضوع التقرير");
    expect(bare.xml).not.toContain("بلدية القويرة");
  });

  it("refreshes the table of contents when Word opens the file", async () => {
    const { zip } = await build(sample());
    expect(await zip.file("word/settings.xml")!.async("string")).toContain("w:updateFields");
  });

  it("refuses an empty report", async () => {
    await expect(buildReportDocx(template, { date: "2026-11-03", observations: [] })).rejects.toThrow();
  });
});
