import { trackEvent } from "./audit-trail.js";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  OBS_LABELS,
  clearDrafts,
  loadDraft,
  loadIds,
  mergeObservations,
  saveIds,
  summarize,
  summaryText,
  type Compliance,
  type Observation,
  type Severity,
} from "./observations";
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
}

const ORDER = ["condition", "legalBasis", "cause", "effect", "recommendation"] as const;

export function AuditReport({ Button, sevLabel, sevClass, datasetLabel, loadSaved, onExportPdf }: Props) {
  const [auditObs, setAuditObs] = useState<Observation[]>([]);
  const [compl, setCompl] = useState<Compliance | undefined>(undefined);
  const [draftDate, setDraftDate] = useState<string | undefined>(undefined);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [source, setSource] = useState("current");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState<{ kind: "approve"; id: string } | { kind: "export" } | null>(null);
  const manual = useManualObservations();

  useEffect(() => {
    setApproved(loadIds("approved"));
    setDeleted(loadIds("deleted"));
  }, [manual]);

  useEffect(() => {
    const d = loadDraft();
    setAuditObs(d?.observations ?? []);
    setCompl(d?.compliance);
    setDraftDate(d?.date);
    setDeleted(loadIds("deleted"));
    setApproved(loadIds("approved"));
    setSaved(loadSaved().filter((r) => r.observations?.length));
  }, [loadSaved]);

  const isCurrent = source === "current";
  const picked = isCurrent ? undefined : saved.find((r) => r.id === source);
  const merged = mergeObservations([auditObs, manual], deleted, approved);
  const observations = (isCurrent ? merged : picked?.observations) ?? [];
  const date = (isCurrent ? draftDate : picked?.date) ?? new Date().toISOString().slice(0, 10);
  const compliance = isCurrent ? compl : picked?.compliance;
  const sum = summarize(observations);
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

  const lacking = () => observations.filter((o) => needsConfirmation(o, loadOverrides()));
  function exportPdf() {
    if (lacking().length) {
      setPending({ kind: "export" });
      return Promise.resolve();
    }
    return doExportPdf();
  }
  async function doExportPdf() {
    try {
      await onExportPdf({
        kind: "audit",
        id: `audit-${date}`,
        name: `تقرير رقابي ${date}`,
        date,
        findings: [],
        observations,
        compliance,
      });
      trackEvent("ui.report.export", `audit-${date}`, `observations=${observations.length}; approved=${approved.size}`);
      setMsg("تم تنزيل التقرير الرقابي بصيغة PDF");
    } catch {
      setMsg("تعذر إنشاء ملف PDF");
    }
  }

  return (
    <section className="table-panel stat-card">
      <div className="panel-heading">
        <h3>التقرير الرقابي — الملاحظات الرقابية المصاغة</h3>
        <Button variant="ink" disabled={!observations.length} onClick={exportPdf}>
          تصدير التقرير PDF
        </Button>
      </div>

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
                  {o.status === "approved" && <span className="text-xs text-success">✓ معتمدة</span>}
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
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-xs text-danger"
                      onClick={() => remove(o.id)}
                    >
                      حذف الملاحظة
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {msg && <p className="px-6 pb-4 text-xs text-muted-foreground">{msg}</p>}
    </section>
  );
}
