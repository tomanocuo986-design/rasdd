import { useState, type ReactNode } from "react";
import { OBS_LABELS, type Observation, type Severity } from "./observations";
import { BasisConfirm, LegalBadge } from "./LegalBadge";
import { loadOverrides, needsConfirmation, recordOverrides } from "./legal-status";

interface Props {
  observations: Observation[];
  sevLabel: Record<Severity | "none", string>;
  sevClass: Record<Severity | "none", string>;
  datasetLabel: (key: string) => string;
  onToggleApprove: (id: string) => void;
  onDelete: (id: string) => void;
  deletedCount: number;
  onRestore: () => void;
  /** آخر قرار مراجعة لكل ملاحظة (معرّف الملاحظة => قرار)، اختياري للتوافق مع الاستعمال القديم */
  decisions?: Record<string, { decision: string; note?: string }>;
  onDecide?: (o: Observation, decision: "confirmed" | "false_positive", note?: string) => void;
}

const FIELDS = ["condition", "legalBasis", "cause", "effect", "recommendation"] as const;

export function ObservationsPanel({ observations, sevLabel, sevClass, datasetLabel, onToggleApprove, onDelete, deletedCount, onRestore, decisions, onDecide }: Props) {
  const [fpFor, setFpFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [approveFor, setApproveFor] = useState<string | null>(null);
  const approved = observations.filter((o) => o.status === "approved").length;
  const textOf = (o: Observation, k: (typeof FIELDS)[number]): ReactNode => {
    if (k !== "legalBasis") return o[k];
    return o.legalBasis.needsVerification ? `${o.legalBasis.text} (يُستكمل رقم المادة من النظام المعتمد)` : o.legalBasis.text;
  };

  return (
    <section className="table-panel stat-card">
      <h3 className="font-semibold">
        الملاحظات الرقابية المصاغة ({observations.length}) · معتمدة {approved}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        تُصاغ تلقائياً من نتائج التحليل وتقييم المخاطر، وتنعكس في التقرير المحفوظ وملف PDF والخلاصة التنفيذية. راجعها
        واعتمدها قبل الاعتماد النهائي.
      </p>
      {deletedCount > 0 && (
        <button type="button" className="mt-2 rounded-md border px-2 py-1 text-xs" onClick={onRestore}>
          استرجاع الملاحظات المحذوفة ({deletedCount})
        </button>
      )}
      {observations.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">لا توجد ملاحظات حالياً.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {observations.map((o, i) => (
            <details key={o.id} className="border rounded-md p-3">
              <summary className="flex flex-wrap items-center gap-2 cursor-pointer">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${sevClass[o.risk.rating]}`}>{sevLabel[o.risk.rating]}</span>
                <b className="text-sm">ملاحظة رقابية {i + 1}: {o.test}</b>
                <span className="text-xs text-muted-foreground">
                  {datasetLabel(o.dataset)} · {o.count} حالة{o.repeated ? " · متكررة" : ""}
                </span>
                <LegalBadge o={o} />
                {o.status === "approved" && <span className="text-xs text-success">✓ معتمدة</span>}
                {decisions?.[o.id]?.decision === "confirmed" && <span className="text-xs text-success">✓ مراجعة: مؤكدة</span>}
                {decisions?.[o.id]?.decision === "false_positive" && <span className="text-xs text-danger">مراجعة: إنذار كاذب</span>}
              </summary>
              <ul className="mt-3 grid gap-2 text-xs">
                {FIELDS.map((k) => (
                  <li key={k}>
                    <b>{OBS_LABELS[k]}: </b>
                    {textOf(o, k)}
                  </li>
                ))}
                <li className="text-muted-foreground">
                  <b>تقييم المخاطر: </b>
                  {o.risk.rationale}
                </li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border px-2 py-1 text-xs"
                  onClick={() => {
                    if (o.status !== "approved" && needsConfirmation(o, loadOverrides())) setApproveFor(o.id);
                    else onToggleApprove(o.id);
                  }}
                >
                  {o.status === "approved" ? "إلغاء الاعتماد" : "اعتماد الملاحظة للتقرير"}
                </button>
                <button type="button" className="rounded-md border px-2 py-1 text-xs text-danger" onClick={() => onDelete(o.id)}>
                  حذف الملاحظة
                </button>
                {onDecide && (
                  <>
                    <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={() => onDecide(o, "confirmed")}>
                      ✓ مؤكدة
                    </button>
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-xs text-danger"
                      onClick={() => {
                        setFpFor(fpFor === o.id ? null : o.id);
                        setReason("");
                      }}
                    >
                      ✗ إنذار كاذب
                    </button>
                  </>
                )}
              </div>
              {approveFor === o.id && (
                <BasisConfirm
                  count={1}
                  action="اعتماد رغم عدم وجود سند من المكتبة"
                  onCancel={() => setApproveFor(null)}
                  onConfirm={() => {
                    recordOverrides([o], "approve");
                    setApproveFor(null);
                    onToggleApprove(o.id);
                  }}
                />
              )}
              {onDecide && fpFor === o.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <input
                    className="min-w-[12rem] flex-1 rounded-md border px-2 py-1"
                    placeholder="سبب اعتبارها إنذارًا كاذبًا (اختياري)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-md border px-2 py-1 text-danger"
                    onClick={() => {
                      onDecide(o, "false_positive", reason.trim());
                      setFpFor(null);
                      setReason("");
                    }}
                  >
                    تأكيد: إنذار كاذب (تُستبعد من التقرير)
                  </button>
                </div>
              )}
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
