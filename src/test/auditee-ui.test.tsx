import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ObservationsPanel } from "@/rasd/ObservationsPanel";
import { ReportModelPreview } from "@/rasd/ReportModelPreview";
import { buildReportDocx } from "@/rasd/report-docx";
import { draftObservations, observationLines, type Observation } from "@/rasd/observations";
import { attachResponses, loadResponses } from "@/rasd/auditee-response";

const sev = { high: "مرتفعة", medium: "متوسطة", low: "منخفضة", none: "—" };
const cls = { high: "", medium: "", low: "", none: "" };
const mk = (test: string, severity: "high" | "medium" | "low", n = 2): Observation =>
  draftObservations(
    Array.from({ length: n }, (_, i) => ({
      dataset: "Direct_Purchases_Orders",
      sector: "procurement",
      row: i,
      test,
      ref: `PO-${i + 1}`,
      severity,
    })),
  )[0] as Observation;

const list = (): Observation[] => [
  { ...mk("احتمال تجزئة مشتريات", "high", 3), status: "approved" },
  { ...mk("نقدية غير مودعة", "medium", 2), status: "approved" },
];

const panel = (obs: Observation[]) =>
  render(
    <ObservationsPanel
      observations={obs}
      sevLabel={sev}
      sevClass={cls}
      datasetLabel={(k) => k}
      onToggleApprove={() => {}}
      onDelete={() => {}}
      deletedCount={0}
      onRestore={() => {}}
    />,
  );

describe("محاكي ردود الجهة: الواجهة والتقرير", () => {
  beforeEach(() => localStorage.clear());

  it("لوحة لكل ملاحظة + لوحة دفعة لكل الملاحظات", () => {
    panel(list());
    expect(screen.getAllByTestId("auditee-panel")).toHaveLength(2);
    expect(screen.getByTestId("auditee-bulk")).toBeInTheDocument();
  });

  it("تحليل ثم اعتماد: يُحفظ ويصل التقرير؛ وقبل الاعتماد لا تعقيب", () => {
    const obs = list();
    panel(obs);
    const p = screen.getAllByTestId("auditee-panel")[0]!;
    fireEvent.change(within(p).getByLabelText("رد إدارة الجهة"), {
      target: { value: "لا نوافق على الملاحظة ولا يوجد مخالفة في المشتريات." },
    });
    fireEvent.click(within(p).getByText("حلّل الرد وأبدِ الرأي"));
    expect(within(p).getByTestId("auditee-analysis")).toBeInTheDocument();
    // قبل الاعتماد: نص الرد فقط
    let rec = attachResponses(obs)[0]!;
    expect(rec.auditee?.response).toContain("لا نوافق");
    expect(rec.auditee?.opinion).toBeUndefined();
    fireEvent.click(within(p).getByText("✓ اعتماد الرأي للتقرير"));
    rec = attachResponses(obs)[0]!;
    expect(rec.auditee?.opinion).toBeTruthy();
    expect(loadResponses()[obs[0]!.id]?.decision).toBe("approved");
    expect(
      observationLines(rec, { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" }, 1).join("\n"),
    ).toContain("تعقيب الديوان:");
  });

  it("الدفعة: توزيع وتحليل كل الردود", () => {
    const obs = list();
    panel(obs);
    const bulk = screen.getByTestId("auditee-bulk");
    fireEvent.change(within(bulk).getByLabelText("ملف ردود الجهة"), {
      target: {
        value:
          "1. نوافق وسيتم المعالجة قريباً\n2. نقدية غير مودعة\nتم الإيداع بموجب سند قبض رقم 5 المرفق.",
      },
    });
    fireEvent.click(within(bulk).getByText("توزيع الردود على الملاحظات"));
    fireEvent.click(within(bulk).getByText("حلّل كل الردود"));
    const map = loadResponses();
    expect(Object.keys(map)).toHaveLength(2);
    expect(Object.values(map).every((r) => r.analysis)).toBe(true);
  });

  it("المعاينة تعرض الرد والتعقيب المعتمدين فقط", () => {
    const o = {
      ...list()[0]!,
      auditee: {
        response: "رد الجهة النصي",
        opinion: "تعقيب معتمد",
        actionOwner: "مديرية المالية",
      },
    };
    render(<ReportModelPreview observations={[o]} sevLabel={sev} />);
    const b = screen.getByTestId("model-block");
    expect(b).toHaveTextContent("رد الجهة النصي");
    expect(b).toHaveTextContent("تعقيب معتمد");
    expect(b).toHaveTextContent("مديرية المالية");
  });

  it("Word: يملأ رد الجهة وخطة العمل وتعقيب الديوان في القالب", async () => {
    const template = readFileSync(
      join(__dirname, "../../public/templates/audit-report-template.docx"),
    );
    const o = {
      ...list()[0]!,
      auditee: {
        response: "رد الجهة بالكامل XYZ1",
        opinion: "تعقيب الديوان XYZ2",
        actionDate: "30/06/2027",
        actionOwner: "مديرية المالية XYZ3",
      },
    };
    const bytes = await buildReportDocx(template, {
      date: "2026-11-16",
      observations: [o, list()[1]!],
    });
    const xml = await (await JSZip.loadAsync(bytes)).file("word/document.xml")!.async("string");
    for (const t of ["XYZ1", "XYZ2", "XYZ3", "30/06/2027"]) expect(xml).toContain(t);
    // الملاحظة الثانية بلا رد: لا يظهر شيء من الأولى فيها
    expect(xml.split("XYZ2").length - 1).toBe(1);
  });
});
