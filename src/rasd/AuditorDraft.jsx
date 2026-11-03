import { useEffect, useRef, useState } from "react";
import { auditSectors } from "./workspace.jsx";
import { ThinkingIndicator } from "./ThinkingIndicator.jsx";
import { addManualObservation } from "./manual-observations";
import { loadIds, saveIds, ruleFor } from "./observations";
import {
  DELETE_GUIDANCE,
  SEVERITY_WORD,
  classifyObservation,
  compareObservation,
  deriveTitle,
  buildObservation,
  loadCorpus,
  reviewMemo,
} from "./auditor-draft.js";
import { trackEvent } from "./audit-trail.js";
import { DECISIONS, loadReviewLog, recordDecision, saveReviewLog } from "./review-log.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EMPTY = { title: "", text: "", sector: auditSectors[0]?.key ?? "", severity: "medium", cause: "", effect: "", recommendation: "" };
const sectorName = (k) => auditSectors.find((s) => s.key === k)?.label ?? "";

function SevBadge({ level }) {
  return <span className={`rasd-ad-badge sev-${level}`}>{SEVERITY_WORD[level]}</span>;
}

export function AuditorDraft() {
  const [stage, setStage] = useState("input"); // input | analyzing | review | edit | confirm | delete | deleted | done
  const [draft, setDraft] = useState(EMPTY);
  const [analysis, setAnalysis] = useState(null);
  const [phase, setPhase] = useState("");
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);
  const run = useRef(0);

  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const reset = () => {
    run.current++;
    setDraft(EMPTY);
    setAnalysis(null);
    setReason("");
    setCopied(false);
    setStage("input");
  };

  async function analyze(keepFields = false) {
    const text = draft.text.trim();
    if (!text) return;
    const id = ++run.current;
    setStage("analyzing");
    setPhase("يقرأ الملاحظة ويحلّل صياغتها…");
    await sleep(450);
    if (id !== run.current) return;
    const corpus = loadCorpus();
    const reports = new Set(corpus.map((e) => e.reportId)).size;
    setPhase(
      reports
        ? `يقارنها بملاحظات ${reports} تقرير سابق (${corpus.length} بند)…`
        : "لا توجد تقارير سابقة محفوظة، يكتفي بالتصنيف بالقواعد…",
    );
    await sleep(600);
    if (id !== run.current) return;
    const comparison = compareObservation(text, corpus);
    setPhase("يقدّر مستوى الخطورة (مرتفعة / متوسطة / منخفضة)…");
    await sleep(450);
    if (id !== run.current) return;
    const result = { comparison, ...classifyObservation(text, comparison) };
    const title = draft.title.trim() || deriveTitle(text);
    const rule = ruleFor(title);
    setAnalysis(result);
    setDraft((d) => ({
      ...d,
      title,
      severity: result.severity,
      cause: keepFields && d.cause ? d.cause : rule.cause,
      effect: keepFields && d.effect ? d.effect : rule.effect,
      recommendation: keepFields && d.recommendation ? d.recommendation : comparison.matches[0]?.recommendation || rule.recommendation,
    }));
    setStage("review");
  }

  function logDecision(decision, note = "") {
    saveReviewLog(
      recordDecision(loadReviewLog(), { dataset: "manual", test: draft.title || deriveTitle(draft.text), decision, note }),
    );
  }

  function finalApprove() {
    const o = buildObservation({ ...draft, analysis });
    saveIds("approved", new Set([...loadIds("approved"), o.id]));
    addManualObservation(o);
    logDecision(DECISIONS.confirmed);
    trackEvent("ui.draft.approve", o.id, draft.title || deriveTitle(draft.text));
    setStage("done");
  }

  function confirmDelete() {
    logDecision(DECISIONS.falsePositive, reason.trim());
    trackEvent("ui.draft.delete", "", draft.title || deriveTitle(draft.text));
    setStage("deleted");
  }

  const matches = analysis?.comparison?.matches ?? [];
  const memo = reviewMemo({ ...draft, sector: sectorName(draft.sector), reason, matches });
  const overridden = analysis && draft.severity !== analysis.severity;

  return (
    <div className="rasd-ad">
      {stage === "input" && (
        <>
          <p className="rasd-ad-hint">
            اكتب الملاحظة كما رصدتها؛ يقارنها رصد بملاحظات التقارير السابقة ويصنّفها (مرتفعة / متوسطة / منخفضة)، ثم تعتمدها
            أو تعدّلها أو تحذفها.
          </p>
          <label className="rasd-ad-field">
            النشاط
            <select value={draft.sector} onChange={set("sector")}>
              {auditSectors.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rasd-ad-field">
            عنوان الملاحظة (اختياري)
            <input value={draft.title} maxLength={120} onChange={set("title")} placeholder="يُستخرج من النص إن تُرك فارغًا" />
          </label>
          <label className="rasd-ad-field">
            نص الملاحظة
            <textarea
              rows={6}
              value={draft.text}
              maxLength={4000}
              onChange={set("text")}
              placeholder="مثال: لوحظ صرف مبلغ 12,000 دينار لمورد واحد على أوامر شراء متتالية دون عرض أسعار…"
            />
          </label>
          <button type="button" className="rasd-ad-btn rasd-ad-primary" disabled={!draft.text.trim()} onClick={() => analyze(false)}>
            ✦ حلّل وقارن بالتقارير السابقة
          </button>
        </>
      )}

      {stage === "analyzing" && (
        <div className="rasd-ad-card">
          <ThinkingIndicator label={phase} />
          <button
            type="button"
            className="rasd-ad-btn"
            onClick={() => {
              run.current++;
              setStage("input");
            }}
          >
            إلغاء
          </button>
        </div>
      )}

      {(stage === "review" || stage === "confirm") && analysis && (
        <>
          <div className="rasd-ad-card">
            <div className="rasd-ad-row">
              <strong>الخطورة:</strong> <SevBadge level={draft.severity} />
              <span className="rasd-ad-chip">{analysis.statusLabel}</span>
            </div>
            {overridden && (
              <p className="rasd-ad-hint">عدّلتَ الخطورة يدويًا (المقترح: {SEVERITY_WORD[analysis.severity]}).</p>
            )}
            <ul className="rasd-ad-reasons">
              {analysis.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="rasd-ad-card">
            <strong>
              المقارنة بالتقارير السابقة
              <span className="rasd-ad-muted">
                {" "}
                ({analysis.comparison.reports} تقرير · {analysis.comparison.entries} بند)
              </span>
            </strong>
            {analysis.comparison.entries === 0 ? (
              <p className="rasd-ad-hint">لا توجد تقارير سابقة محفوظة بعد (تبويب «التقارير السابقة»)، لذلك صُنّفت بالقواعد فقط.</p>
            ) : matches.length === 0 ? (
              <p className="rasd-ad-hint">لم يُعثر على ملاحظة مشابهة: تُعد ملاحظة جديدة.</p>
            ) : (
              <ul className="rasd-ad-matches">
                {matches.map((m) => (
                  <li key={m.id}>
                    <div className="rasd-ad-row">
                      <b>{m.title}</b>
                      <SevBadge level={m.severity} />
                      <span className="rasd-ad-muted">{Math.round(m.score * 100)}% تشابه</span>
                    </div>
                    <span className="rasd-ad-muted">
                      {m.report}
                      {m.date ? ` · ${m.date}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rasd-ad-card">
            <strong>{draft.title}</strong>
            <p className="rasd-ad-text">{draft.text}</p>
            <span className="rasd-ad-muted">النشاط: {sectorName(draft.sector)}</span>
          </div>

          {stage === "review" ? (
            <div className="rasd-ad-actions">
              <button type="button" className="rasd-ad-btn rasd-ad-primary" onClick={() => setStage("confirm")}>
                ✓ اعتماد
              </button>
              <button type="button" className="rasd-ad-btn" onClick={() => setStage("edit")}>
                ✎ تعديل
              </button>
              <button type="button" className="rasd-ad-btn rasd-ad-danger" onClick={() => setStage("delete")}>
                🗑 حذف
              </button>
            </div>
          ) : (
            <div className="rasd-ad-card rasd-ad-confirm">
              <p>
                عند الاعتماد النهائي تُدرج الملاحظة بخطورة <b>{SEVERITY_WORD[draft.severity]}</b> في «التقرير الرقابي» وفي تبويب
                التدقيق للنشاط «{sectorName(draft.sector)}»، وتدخل في التقارير المحفوظة والتصدير.
              </p>
              <div className="rasd-ad-actions">
                <button type="button" className="rasd-ad-btn rasd-ad-primary" onClick={finalApprove}>
                  اعتماد نهائي وإدراجها في التقارير
                </button>
                <button type="button" className="rasd-ad-btn" onClick={() => setStage("review")}>
                  رجوع
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {stage === "edit" && (
        <>
          <label className="rasd-ad-field">
            العنوان
            <input value={draft.title} maxLength={120} onChange={set("title")} />
          </label>
          <label className="rasd-ad-field">
            نص الملاحظة
            <textarea rows={5} value={draft.text} maxLength={4000} onChange={set("text")} />
          </label>
          <label className="rasd-ad-field">
            الخطورة
            <select value={draft.severity} onChange={set("severity")}>
              <option value="high">مرتفعة</option>
              <option value="medium">متوسطة</option>
              <option value="low">منخفضة</option>
            </select>
          </label>
          <label className="rasd-ad-field">
            النشاط
            <select value={draft.sector} onChange={set("sector")}>
              {auditSectors.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rasd-ad-field">
            السبب
            <textarea rows={2} value={draft.cause} onChange={set("cause")} />
          </label>
          <label className="rasd-ad-field">
            الأثر
            <textarea rows={2} value={draft.effect} onChange={set("effect")} />
          </label>
          <label className="rasd-ad-field">
            التوصية
            <textarea rows={2} value={draft.recommendation} onChange={set("recommendation")} />
          </label>
          <div className="rasd-ad-actions">
            <button type="button" className="rasd-ad-btn rasd-ad-primary" disabled={!draft.text.trim()} onClick={() => setStage("review")}>
              حفظ التعديلات
            </button>
            <button type="button" className="rasd-ad-btn" disabled={!draft.text.trim()} onClick={() => analyze(true)}>
              إعادة المقارنة والتصنيف
            </button>
          </div>
          <p className="rasd-ad-hint">«إعادة المقارنة» تعيد حساب الخطورة من النص المعدّل وتستبدل الخطورة المختارة.</p>
        </>
      )}

      {stage === "delete" && (
        <>
          <div className="rasd-ad-card rasd-ad-warn">
            <strong>توجيه: مذكرة مراجعة بالملاحظة</strong>
            <p>{DELETE_GUIDANCE}</p>
          </div>
          <label className="rasd-ad-field">
            سبب الحذف (مطلوب لتوثيقه في المذكرة)
            <textarea rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </label>
          <label className="rasd-ad-field">
            مسودة مذكرة المراجعة
            <textarea rows={9} readOnly value={memo} />
          </label>
          <div className="rasd-ad-actions">
            <button
              type="button"
              className="rasd-ad-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(memo);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "تم النسخ ✓" : "نسخ المذكرة"}
            </button>
            <button type="button" className="rasd-ad-btn rasd-ad-danger" disabled={!reason.trim()} onClick={confirmDelete}>
              تأكيد الحذف
            </button>
            <button type="button" className="rasd-ad-btn" onClick={() => setStage("review")}>
              تراجع
            </button>
          </div>
        </>
      )}

      {stage === "deleted" && (
        <div className="rasd-ad-card">
          <strong>حُذفت المسودة ولم تُدرج في التقارير.</strong>
          <p className="rasd-ad-hint">لا تنسَ توجيه مذكرة المراجعة بالملاحظة إلى الجهة المعنية لتوثيق الاستبعاد.</p>
          <button type="button" className="rasd-ad-btn rasd-ad-primary" onClick={reset}>
            ملاحظة جديدة
          </button>
        </div>
      )}

      {stage === "done" && (
        <div className="rasd-ad-card rasd-ad-ok">
          <strong>✓ اعتُمدت الملاحظة وأُدرجت في التقارير.</strong>
          <p className="rasd-ad-hint">
            تجدها في تبويب «التقرير الرقابي» وفي تبويب التدقيق للنشاط «{sectorName(draft.sector)}»، وتدخل في أي تقرير تحفظه بعد
            الآن.
          </p>
          <button type="button" className="rasd-ad-btn rasd-ad-primary" onClick={reset}>
            ملاحظة جديدة
          </button>
        </div>
      )}
    </div>
  );
}
