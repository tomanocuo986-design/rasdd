import { trackEvent } from "./audit-trail.js";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  OBS_LABELS,
  clearDrafts,
  diffEdit,
  loadDraft,
  loadEdits,
  loadIds,
  mergeObservations,
  reportable,
  saveEdits,
  saveIds,
  summarize,
  summaryText,
  type Compliance,
  type ObsEdit,
  type Observation,
  type Severity,
} from "./observations";
import { ObservationEditForm } from "./ObservationEditForm";
import { ReportModelPreview } from "./ReportModelPreview";
import { loadReportMeta, saveReportMeta, type ReportMeta } from "./report-docx";
import { clearManualObservations, useManualObservations } from "./manual-observations";
import { BasisConfirm, LegalBadge } from "./LegalBadge";
import { loadOverrides, needsConfirmation, recordOverrides } from "./legal-status";

export interface ExportableReport {
  kind: "audit";
  id: string;
  name: string;
  date: string;
  findings: never[];
  observations: Observation[];
  compliance?: Compliance | undefined;
}

interface SavedReport {
  id: string;
  name: string;
  date: string;
  observations?: Observation[];
  compliance?: Compliance;
}

interface Props {
  Button: ComponentType<{ variant?: string; size?: string; disabled?: boolean; onClick?: () => void; children?: ReactNode }>;
  sevLabel: Record<Severity | "none", string>;
  sevClass: Record<Severity | "none", string>;
  datasetLabel: (key: string) => string;
  loadSaved: () => SavedReport[];
  onExportPdf: (report: ExportableReport) => Promise<void>;
  /** تصدير Word على قالب ديوان المحاسبة. اختياري: يُخفى الزر إن لم يُمرَّر */
  onExportDocx?: (report: ExportableReport, meta: ReportMeta) => Promise<void>;
}

const META_FIELDS: Array<[keyof ReportMeta, string, string]> = [
  ["entity", "اسم الجهة", "بلدية …"],
  ["subject", "موضوع التقرير", "تدقيق …"],
  ["year", "سنة التقرير", "2026"],
  ["from", "فترة التدقيق: من", "dd/mm/yyyy"],
  ["to", "إلى", "dd/mm/yyyy"],
  ["letterNo", "رقم كتاب التكليف", "رقم/تاريخ"],
];

const ORDER = ["condition", "legalBasis", "cause", "effect", "recommendation"] as const;

export function AuditReport({ Button, sevLabel, sevClass, datasetLabel, loadSaved, onExportPdf, onExportDocx }: Props) {
  const [auditObs, setAuditObs] = useState<Observation[]>([]);
  const [compl, setCompl] = useState<Compliance | undefined>(undefined);
  const [draftDate, setDraftDate] = useState<string | undefined>(undefined);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, ObsEdit>>({});
  const [editFor, setEditFor] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReportMeta>({});
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [source, setSource] = useState("current");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState<{ kind: "approve"; id: string } | { kind: "export" } | { kind: "export-docx" } | null>(null);
  const manual = useManualObservations();

  useEffect(() => {
    setApproved(loadIds("approved"));
    setDeleted(loadIds("deleted"));
    setEdits(loadEdits());
  }, [manual]);

  useEffect(() => {
    const d = loadDraft();
    setAuditObs(d?.observations ?? []);
    setCompl(d?.compliance);
    setDraftDate(d?.date);
    setDeleted(loadIds("deleted"));
    setApproved(loadIds("approved"));
    setEdits(loadEdits());
    setMeta(loadReportMeta());
    setSaved(loadSaved().filter((r) => r.observations?.length));
  }, [loadSaved]);

  const isCurrent = source === "current";
  const picked = isCurrent ? undefined : saved.find((r) => r.id === source);
  const merged = mergeObservations([auditObs, manual], deleted, approved, edits);
  const observations = (isCurrent ? merged : picked?.observations) ?? [];
  const date = (isCurrent ? draftDate : picked?.date) ?? new Date().toISOString().slice(0, 10);
  const compliance = isCurrent ? compl : picked?.compliance;
  // ما يدخل ملف التقرير: الملاحظة الجديدة (لم ترد في تقارير سابقة) لا تُدرج قبل اعتماد المدقق لها
  const exportable = isCurrent ? reportable(observations) : observations;
  const sum = summarize(observations);
  const pendingNew = isCurrent ? observations.filter((o) => o.isNew && o.status !== "approved").length : 0;
  const hasDraft = auditObs.length > 0 || manual.length > 0;

  const remove = (id: string) => {
    const next = new Set(deleted).add(id);
    setDeleted(next);
    saveIds("deleted", next);
  };
  const toggleApprove = (id: string) => {
    const o = observations.find((x) => x.id === id);
    if (o && !approved.has(id) && needsConfirmation(o, loadOverrides())) {
      setPending({ kind: "approve", id });
      return;
    }
    doToggleApprove(id);
  };
  const doToggleApprove = (id: string) => {
    const next = new Set(approved);
    if (!next.delete(id)) next.add(id);
    setApproved(next);
    saveIds("approved", next);
    if (next.has(id)) trackEvent("ui.finding.approve", id);
  };
  const saveEdit = (o: Observation, patch: ObsEdit, approve: boolean) => {
    // نقارن بالمسودة الأصلية (قبل أي تعديل سابق) كي لا يُخزَّن إلا ما يخالفها
    const original = auditObs.find((x) => x.id === o.id) ?? manual.find((x) => x.id === o.id) ?? o;
    const e = diffEdit(original, patch);
    const next = { ...edits };
    if (e) next[o.id] = e;
    else delete next[o.id];
    setEdits(next);
    saveEdits(next);
    trackEvent("ui.finding.edit", o.id, `${o.dataset}|${o.test}`);
    setEditFor(null);
    if (!approve || approved.has(o.id)) return;
    // «حفظ واعتماد» يمرّ بالبوابة القانونية نفسها إن بقي السند من غير المكتبة ولم يعدّله المدقق
    const keepsBasis = (patch.legalBasis ?? "").trim() === o.legalBasis.text;
    if (keepsBasis && needsConfirmation(o, loadOverrides())) setPending({ kind: "approve", id: o.id });
    else doToggleApprove(o.id);
  };
  const restore = () => {
    setDeleted(new Set());
    saveIds("deleted", new Set());
  };
  const clearAll = () => {
    clearDrafts();
    clearManualObservations();
    setAuditObs([]);
    setCompl(undefined);
    setDeleted(new Set());
    setApproved(new Set());
  };

  const lacking = () => exportable.filter((o) => needsConfirmation(o, loadOverrides()));
  function exportPdf() {
    if (lacking().length) {
      setPending({ kind: "export" });
      return Promise.resolve();
    }
    return doExportPdf();
  }
  const reportOf = (): ExportableReport => ({
    kind: "audit",
    id: `audit-${date}`,
    name: `تقرير رقابي ${date}`,
    date,
    findings: [],
    observations: exportable,
    compliance,
  });
  async function doExportPdf() {
    try {
      await onExportPdf(reportOf());
      trackEvent("ui.report.export", `audit-${date}`, `observations=${exportable.length}; approved=${approved.size}`);
      setMsg("تم تنزيل التقرير الرقابي بصيغة PDF");
    } catch {
      setMsg("تعذر إنشاء ملف PDF");
    }
  }
  async function doExportDocx() {
    if (!onExportDocx) return;
    try {
      await onExportDocx(reportOf(), meta);
      trackEvent("ui.report.export_docx", `audit-${date}`, `observations=${exportable.length}`);
      setMsg("تم تنزيل التقرير بصيغة Word على قالب ديوان المحاسبة. عند فتحه وافق على تحديث الحقول ليكتمل جدول المحتويات وأرقام الصفحات.");
    } catch {
      setMsg("تعذر إنشاء ملف Word");
    }
  }
  const setMetaField = (k: keyof ReportMeta, v: string) => {
    const next = { ...meta, [k]: v };
    setMeta(next);
    saveReportMeta(next);
  };
  const exportDocx = () => {
    if (lacking().length) {
      setPending({ kind: "export-docx" });
      return Promise.resolve();
    }
    return doExportDocx();
  };

  return (
    <section className="table-panel stat-card">
      <div className="panel-heading">
        <h3>التقرير الرقابي — الملاحظات الرقابية المصاغة</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="ink" disabled={!exportable.length} onClick={exportPdf}>
            تصدير التقرير PDF
          </Button>
          {onExportDocx && (
            <Button variant="ink" disabled={!exportable.length} onClick={exportDocx}>
              تصدير Word (قالب الديوان)
            </Button>
          )}
        </div>
      </div>
      {pendingNew > 0 && (
        <div role="status" data-testid="pending-new" className="mx-4 mt-2 rounded-md border border-warning px-3 py-2 text-xs">
          {pendingNew} ملاحظة جديدة (لم ترد في التقارير السابقة) صاغها البرنامج وتنتظر قرارك: اعتماد أو تعديل أو حذف. لا تظهر في ملف التقرير (PDF/Word) قبل اعتمادها.
        </div>
      )}
      {onExportDocx && isCurrent && (
        <details className="mx-4 mt-2 text-xs">
          <summary className="cursor-pointer">بيانات الغلاف والمقدمة لملف Word (اختياري)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {META_FIELDS.map(([k, label, ph]) => (
              <label key={k} className="grid gap-1">
                <span>{label}</span>
                <input className="rounded-md border px-2 py-1" aria-label={label} placeholder={ph} value={meta[k] ?? ""} onChange={(e) => setMetaField(k, e.target.value)} />
              </label>
            ))}
          </div>
        </details>
      )}

      {pending?.kind === "export" && (
        <div className="px-4">
          <BasisConfirm
            count={lacking().length}
            action="تصدير التقرير رغم ذلك"
            onCancel={() => setPending(null)}
            onConfirm={() => {
              recordOverrides(lacking(), "export");
              setPending(null);
              void doExportPdf();
            }}
          />
        </div>
      )}
      {pending?.kind === "export-docx" && (
        <div className="px-4">
          <BasisConfirm
            count={lacking().length}
            action="تصدير Word رغم ذلك"
            onCancel={() => setPending(null)}
            onConfirm={() => {
              recordOverrides(lacking(), "export");
              setPending(null);
              void doExportDocx();
            }}
          />
        </div>
      )}
      {pending?.kind === "approve" && (
        <div className="px-4">
          <BasisConfirm
            count={1}
            action="اعتماد رغم عدم وجود سند من المكتبة"
            onCancel={() => setPending(null)}
            onConfirm={() => {
              const o = observations.find((x) => x.id === pending.id);
              if (o) recordOverrides([o], "approve");
              setPending(null);
              doToggleApprove(pending.id);
            }}
          />
        </div>
      )}

      {(saved.length > 0 || hasDraft) && (
        <div className="mt-3 flex flex-wrap gap-2 px-4">
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs ${isCurrent ? "font-semibold" : ""}`}
            onClick={() => setSource("current")}
          >
            التقرير الحالي (مسودة)
          </button>
          {isCurrent && deleted.size > 0 && (
            <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={restore}>
              استرجاع المحذوفة ({deleted.size})
            </button>
          )}
          {isCurrent && hasDraft && (
            <button type="button" className="rounded-md border px-2 py-1 text-xs text-danger" onClick={clearAll}>
              مسح المسودة
            </button>
          )}
          {saved.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`rounded-md border px-2 py-1 text-xs ${source === r.id ? "font-semibold" : ""}`}
              onClick={() => setSource(r.id)}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {!observations.length ? (
        <div className="empty-state">
          <p>
            لا توجد ملاحظات رقابية بعد. من تبويب «تدقيق الأنشطة والعمليات» ارفع بياناتك وسيُجمع هنا كل ما يُصاغ من
            ملاحظات في تقرير رقابي واحد.
          </p>
        </div>
      ) : (
        <div className="p-6">
          <h4 className="font-semibold">تقرير رقابي بتاريخ {date}</h4>
          <section className="stats-grid mt-3">
            {(
              [
                ["إجمالي الملاحظات", sum.total],
                ["مخاطر مرتفعة", sum.high],
                ["مخاطر متوسطة", sum.medium],
                ["مخاطر منخفضة", sum.low],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="stat-card">
                <span className="text-xs text-muted-foreground">{label}</span>
                <strong className="stat-value">{n}</strong>
              </div>
            ))}
          </section>
          <p className="mt-3 text-sm">{summaryText(sum)}</p>
          {compliance?.pct != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              نسبة السجلات الخالية من الملاحظات: {compliance.pct}% ({compliance.total} سجل مفحوص)
            </p>
          )}

          <div className="mt-4 grid gap-4">
            {observations.map((o, i) => (
              <article key={o.id} className="border rounded-md p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm">
                    ملاحظة رقابية {i + 1}: {o.test}
                  </b>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${sevClass[o.risk.rating]}`}>
                    {sevLabel[o.risk.rating]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {datasetLabel(o.dataset)} · {o.count} حالة{o.repeated ? " · متكررة" : ""}
                  </span>
                  <LegalBadge o={o} />
                  {o.isNew && (
                    <span data-testid="new-badge" className="rounded-full border border-warning px-2 py-0.5 text-xs text-warning">
                      جديدة · لم ترد في التقارير السابقة
                    </span>
                  )}
                  {o.edited && <span className="text-xs text-muted-foreground">✎ معدّلة من المدقق</span>}
                  {o.status === "approved" ? (
                    <span className="text-xs text-success">✓ معتمدة</span>
                  ) : (
                    isCurrent && <span className="text-xs text-muted-foreground">بانتظار الاعتماد</span>
                  )}
                </div>
                <ul className="mt-3 grid gap-2 text-xs">
                  {ORDER.map((k) => (
                    <li key={k}>
                      <b>{OBS_LABELS[k]}: </b>
                      {k === "legalBasis"
                        ? o.legalBasis.needsVerification
                          ? `${o.legalBasis.text} (يُستكمل رقم المادة من النظام المعتمد)`
                          : o.legalBasis.text
                        : o[k]}
                    </li>
                  ))}
                </ul>
                {isCurrent && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={() => toggleApprove(o.id)}>
                      {o.status === "approved" ? "إلغاء الاعتماد" : "اعتماد الملاحظة"}
                    </button>
                    <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditFor(editFor === o.id ? null : o.id)}>
                      {editFor === o.id ? "إغلاق التعديل" : "تعديل الصياغة"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-xs text-danger"
                      onClick={() => remove(o.id)}
                    >
                      حذف الملاحظة
                    </button>
                  </div>
                )}
                {isCurrent && editFor === o.id && (
                  <ObservationEditForm observation={o} sevLabel={sevLabel} onCancel={() => setEditFor(null)} onSave={(patch, approve) => saveEdit(o, patch, approve)} />
                )}
              </article>
            ))}
          </div>
          <ReportModelPreview observations={exportable} sevLabel={sevLabel} onDownloadWord={onExportDocx ? exportDocx : undefined} />
        </div>
      )}
      {msg && <p className="px-6 pb-4 text-xs text-muted-foreground">{msg}</p>}
    </section>
  );
}
