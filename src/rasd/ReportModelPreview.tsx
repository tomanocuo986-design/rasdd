import { useState } from "react";
import { OBS_LABELS, type Observation, type Severity } from "./observations";

const COLOR: Record<Severity, string> = { high: "#C00000", medium: "#FFC000", low: "#92D050" };
const ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const FIELDS = ["condition", "legalBasis", "cause", "effect"] as const;

interface Props {
  /** الملاحظات التي ستدخل التقرير (المعتمدة فقط للجديدة) */
  observations: Observation[];
  sevLabel: Record<Severity | "none", string>;
  /** تنزيل النموذج بصيغة Word على قالب الديوان. يُخفى الزر إن لم يُمرَّر. */
  onDownloadWord?: () => Promise<void> | void;
}

const bar = { background: "#D9D9D9", color: "#000", padding: "4px 8px", fontWeight: 700 } as const;

/** معاينة «نموذج التقرير الرقابي» (قالب ديوان المحاسبة): قائمة الملاحظات ثم الملاحظات المفصلة كما تُصدَّر إلى Word. */
export function ReportModelPreview({ observations, sevLabel, onDownloadWord }: Props) {
  const [busy, setBusy] = useState(false);
  const list = [...observations].sort((a, b) => ORDER[a.risk.rating] - ORDER[b.risk.rating]);
  return (
    <details open data-testid="report-model" className="mt-4 rounded-md border">
      <summary className="cursor-pointer px-3 py-2 font-semibold">نموذج التقرير (قالب ديوان المحاسبة) — ينعكس عليه المعتمد من الملاحظات</summary>
      {list.length === 0 ? (
        <p className="px-3 pb-3 text-xs text-muted-foreground">لا توجد ملاحظات معتمدة بعد. اعتمد الملاحظات (بعد مراجعتها أو تعديلها) لتظهر في النموذج وتُصدَّر.</p>
      ) : (
        <div className="grid gap-4 p-3 text-xs">
          {onDownloadWord && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="model-download-word"
                disabled={busy}
                className="rounded-md border px-3 py-1.5 text-xs font-semibold"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onDownloadWord();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "جارٍ إنشاء الملف…" : "⬇ تحميل نموذج التقرير بصيغة Word"}
              </button>
              <span className="text-muted-foreground">يحمل {list.length} ملاحظة معتمدة على قالب ديوان المحاسبة.</span>
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <b>قائمة الملاحظات</b>
            <table className="mt-1 w-full border-collapse text-center">
              <thead>
                <tr style={{ background: "#595959", color: "#fff" }}>
                  {["#", "عنوان الملاحظة", "التصنيف", "تاريخ التنفيذ", "رقم الصفحة"].map((h) => (
                    <th key={h} className="border px-2 py-1">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((o, i) => (
                  <tr key={o.id}>
                    <td className="border px-2 py-1">{i + 1}</td>
                    <td className="border px-2 py-1 text-right">{o.test}</td>
                    <td className="border px-2 py-1" style={{ background: COLOR[o.risk.rating], color: o.risk.rating === "medium" ? "#000" : "#fff" }}>{sevLabel[o.risk.rating]}</td>
                    <td className="border px-2 py-1">{o.risk.rating === "low" ? "يتقرر لاحقا" : ""}</td>
                    <td className="border px-2 py-1"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <b>الملاحظات المفصلة</b>
          {list.map((o, i) => (
            <article key={o.id} data-testid="model-block" className="border" style={{ borderTop: "4px solid #C18A82" }}>
              <div className="flex items-center justify-between gap-2" style={bar}>
                <span>{i + 1}. {o.test}</span>
                <span style={{ background: COLOR[o.risk.rating], color: o.risk.rating === "medium" ? "#000" : "#fff", padding: "2px 10px" }}>{sevLabel[o.risk.rating]}</span>
              </div>
              <div className="grid gap-2 p-2">
                {FIELDS.map((k) => (
                  <p key={k}>
                    <b>{OBS_LABELS[k]}: </b>
                    {k === "legalBasis" && o.legalBasis.needsVerification ? `${o.legalBasis.text} (يُستكمل رقم المادة من النظام المعتمد)` : k === "legalBasis" ? o.legalBasis.text : o[k]}
                  </p>
                ))}
              </div>
              <div style={bar}>التوصيات</div>
              <p className="p-2">{o.recommendation}</p>
              <div style={bar}>رد إدارة الجهة</div>
              <p className="p-2 text-muted-foreground">—</p>
              <div style={bar}>خطة (خطط) العمل</div>
              <p className="p-2 text-muted-foreground">تاريخ التنفيذ: — · الطرف المسؤول: —</p>
              <div style={bar}>تعقيب الديوان</div>
              <p className="p-2 text-muted-foreground">—</p>
            </article>
          ))}
        </div>
      )}
    </details>
  );
}
