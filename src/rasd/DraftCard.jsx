import { useEffect, useRef, useState } from "react";
import { auditSectors } from "./workspace.jsx";
import { ThinkingIndicator } from "./ThinkingIndicator.jsx";
import { DELETE_GUIDANCE, SEVERITY_WORD } from "./auditor-draft.js";
import { approveChatDraft, discardChatDraft, hasDefaultWording, makeChatDraft, memoFor } from "./chat-draft.js";
import { NO_BASIS_TEXT, OBS_LABELS } from "./observations";
import { STATUS_LABEL as BASIS_LABEL, basisStatus } from "./legal-status";

const sectorName = (k) => auditSectors.find((s) => s.key === k)?.label ?? "";

function Sev({ level }) {
  return <span className={`rasd-ad-badge sev-${level}`}>{SEVERITY_WORD[level]}</span>;
}

function Section({ label, children, extra }) {
  return (
    <div className="rasd-ad-sec">
      <b>
        {label}
        {extra}
      </b>
      <p className="rasd-ad-text">{children}</p>
    </div>
  );
}

/**
 * مسودة ملاحظة رقابية داخل المحادثة: الحالة، السند القانوني، السبب، الأثر، التوصية + التصنيف،
 * وقرار المدقق: اعتماد (يدرجها في التقرير الرقابي وقالب التقرير) أو تعديل أو حذف.
 */
export function DraftCard({ source }) {
  const [stage, setStage] = useState("loading"); // loading | exists | review | edit | confirm | delete | deleted | done | error
  const [d, setD] = useState(null);
  const [edit, setEdit] = useState(null);
  const [sector, setSector] = useState(auditSectors[0]?.key ?? "");
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const run = useRef(0);

  async function draftIt(force) {
    const id = ++run.current;
    setStage("loading");
    try {
      const r = await makeChatDraft(source, { force });
      if (id !== run.current) return;
      setD(r);
      setStage(r.exists ? "exists" : "review");
    } catch {
      if (id === run.current) setStage("error");
    }
  }

  useEffect(() => {
    draftIt(false);
    return () => {
      run.current++;
    };
  }, [source]);

  const basisSource = d?.legalBasis ? basisStatus({ legalBasis: d.legalBasis }) : "none";
  const trusted = basisSource === "library" || basisSource === "auditor";
  const setE = (k) => (e) => setEdit((x) => ({ ...x, [k]: e.target.value }));

  function startEdit() {
    setEdit({
      title: d.title,
      severity: d.severity,
      condition: d.condition,
      cause: d.cause,
      effect: d.effect,
      recommendation: d.recommendation,
      basis: d.legalBasis,
    });
    setStage("edit");
  }

  function saveEdit() {
    const basis = edit.basis?.text?.trim() ? edit.basis : { source: "default", text: NO_BASIS_TEXT, needsVerification: false };
    setD((x) => ({
      ...x,
      title: edit.title.trim() || x.title,
      severity: edit.severity,
      condition: edit.condition.trim() || x.condition,
      cause: edit.cause.trim() || x.cause,
      effect: edit.effect.trim() || x.effect,
      recommendation: edit.recommendation.trim() || x.recommendation,
      legalBasis: basis,
    }));
    setStage("review");
  }

  function approve() {
    const r = approveChatDraft(d, sector, { confirmedNoBasis: sure });
    if (!r.ok) {
      setErr("هذه الملاحظة بلا سند من المكتبة؛ أكّد الاعتماد بلا سند أو عدّل السند أولًا.");
      return;
    }
    setErr("");
    setStage("done");
  }

  if (stage === "loading")
    return (
      <div className="rasd-ad rasd-ad-inchat">
        <ThinkingIndicator label="يقارنها بالتقارير السابقة ويصوغها…" />
      </div>
    );

  if (stage === "error")
    return (
      <div className="rasd-ad rasd-ad-inchat">
        <p className="rasd-ad-hint">تعذّرت صياغة الملاحظة. أعد المحاولة أو استخدم تبويب «مسودة مدقق».</p>
        <button type="button" className="rasd-ad-btn" onClick={() => draftIt(false)}>
          إعادة المحاولة
        </button>
      </div>
    );

  if (stage === "exists")
    return (
      <div className="rasd-ad rasd-ad-inchat">
        <div className="rasd-ad-card rasd-ad-warn">
          <strong>وردت ملاحظة مشابهة في تقارير سابقة، فلم أعد صياغتها كملاحظة جديدة:</strong>
          <ul className="rasd-ad-matches">
            {d.matches.map((m) => (
              <li key={m.id}>
                <div className="rasd-ad-row">
                  <b>{m.title}</b>
                  <Sev level={m.severity} />
                  <span className="rasd-ad-muted">{Math.round(m.score * 100)}% تشابه</span>
                </div>
                <span className="rasd-ad-muted">
                  {m.report}
                  {m.date ? ` · ${m.date}` : ""}
                </span>
                {m.semantic?.lifted && (
                  <p className="rasd-ad-hint">
                    مطابقة بالمعنى لا باللفظ{m.semantic.shared.length ? ` — مفاهيم مشتركة: ${m.semantic.shared.join("، ")}` : ""}
                  </p>
                )}
                {m.recommendation && <p className="rasd-ad-hint">التوصية السابقة: {m.recommendation}</p>}
              </li>
            ))}
          </ul>
        </div>
        <button type="button" className="rasd-ad-btn" onClick={() => draftIt(true)}>
          صغها كملاحظة جديدة على أي حال
        </button>
      </div>
    );

  if (stage === "deleted")
    return (
      <div className="rasd-ad rasd-ad-inchat">
        <div className="rasd-ad-card">
          <strong>حُذفت المسودة ولم تُدرج في أي تقرير.</strong>
          <p className="rasd-ad-hint">وُثّق القرار في سجل المراجعة. وجّه مذكرة المراجعة إلى الجهة المعنية لتوثيق الاستبعاد.</p>
        </div>
      </div>
    );

  if (stage === "done")
    return (
      <div className="rasd-ad rasd-ad-inchat">
        <div className="rasd-ad-card rasd-ad-ok">
          <strong>✓ اعتُمدت الملاحظة وأُدرجت في التقرير الرقابي.</strong>
          <p className="rasd-ad-hint">
            تجدها في تبويب «التقرير الرقابي» وفي «نموذج التقرير» (قالب ديوان المحاسبة)، وتخرج في ملف Word وPDF عند التصدير.
          </p>
        </div>
      </div>
    );

  if (stage === "edit")
    return (
      <div className="rasd-ad rasd-ad-inchat">
        <label className="rasd-ad-field">
          عنوان الملاحظة
          <input value={edit.title} maxLength={120} onChange={setE("title")} />
        </label>
        <label className="rasd-ad-field">
          التصنيف
          <select value={edit.severity} onChange={setE("severity")}>
            <option value="high">مرتفعة</option>
            <option value="medium">متوسطة</option>
            <option value="low">منخفضة</option>
          </select>
        </label>
        <label className="rasd-ad-field">
          {OBS_LABELS.condition}
          <textarea rows={3} value={edit.condition} onChange={setE("condition")} />
        </label>
        {d.candidates.length > 0 && (
          <label className="rasd-ad-field">
            اختيار السند من المكتبة
            <select
              value=""
              onChange={(e) => {
                const c = d.candidates[Number(e.target.value)];
                if (c) setEdit((x) => ({ ...x, basis: c.basis }));
              }}
            >
              <option value="">— مقاطع مقترحة من مكتبة الأنظمة —</option>
              {d.candidates.map((c, i) => (
                <option key={i} value={i}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="rasd-ad-field">
          {OBS_LABELS.legalBasis}
          <textarea
            rows={4}
            value={edit.basis?.text === NO_BASIS_TEXT ? "" : (edit.basis?.text ?? "")}
            placeholder="اكتب السند (الصك والمادة) أو اتركه فارغًا لتبقى الملاحظة بلا سند"
            onChange={(e) => {
              const v = e.target.value;
              setEdit((x) => ({ ...x, basis: { source: v.trim() ? "auditor" : "default", text: v, needsVerification: false } }));
            }}
          />
        </label>
        <label className="rasd-ad-field">
          {OBS_LABELS.cause}
          <textarea rows={3} value={edit.cause} onChange={setE("cause")} />
        </label>
        <label className="rasd-ad-field">
          {OBS_LABELS.effect}
          <textarea rows={3} value={edit.effect} onChange={setE("effect")} />
        </label>
        <label className="rasd-ad-field">
          {OBS_LABELS.recommendation}
          <textarea rows={3} value={edit.recommendation} onChange={setE("recommendation")} />
        </label>
        <div className="rasd-ad-actions">
          <button type="button" className="rasd-ad-btn rasd-ad-primary" onClick={saveEdit}>
            حفظ التعديلات
          </button>
          <button type="button" className="rasd-ad-btn" onClick={() => setStage("review")}>
            إلغاء
          </button>
        </div>
      </div>
    );

  if (stage === "delete") {
    const memo = memoFor(d, sectorName(sector), reason);
    return (
      <div className="rasd-ad rasd-ad-inchat">
        <div className="rasd-ad-card rasd-ad-warn">
          <strong>توجيه: مذكرة مراجعة بالملاحظة</strong>
          <p>{DELETE_GUIDANCE}</p>
        </div>
        <label className="rasd-ad-field">
          سبب الحذف (مطلوب لتوثيقه)
          <textarea rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </label>
        <label className="rasd-ad-field">
          مسودة مذكرة المراجعة
          <textarea rows={7} readOnly value={memo} />
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
          <button
            type="button"
            className="rasd-ad-btn rasd-ad-danger"
            disabled={!reason.trim()}
            onClick={() => {
              discardChatDraft(d, reason.trim());
              setStage("deleted");
            }}
          >
            تأكيد الحذف
          </button>
          <button type="button" className="rasd-ad-btn" onClick={() => setStage("review")}>
            تراجع
          </button>
        </div>
      </div>
    );
  }

  // review | confirm
  return (
    <div className="rasd-ad rasd-ad-inchat">
      <div className="rasd-ad-card">
        <div className="rasd-ad-row">
          <strong>{d.title}</strong>
        </div>
        <div className="rasd-ad-row">
          <span className="rasd-ad-muted">التصنيف:</span>
          <Sev level={d.severity} />
          <span className="rasd-ad-chip">{d.statusLabel}</span>
          {d.severity !== d.analysis.severity && <span className="rasd-ad-muted">(عدّلته؛ المقترح: {SEVERITY_WORD[d.analysis.severity]})</span>}
        </div>
        {d.analysis.reasons?.length > 0 && (
          <details className="rasd-ad-muted">
            <summary>لماذا هذا التصنيف؟</summary>
            <ul className="rasd-ad-reasons">
              {d.analysis.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </details>
        )}
        {d.matches.length > 0 && (
          <details className="rasd-ad-muted">
            <summary>ملاحظات سابقة تشبهها ({d.matches.length})</summary>
            <ul className="rasd-ad-matches">
              {d.matches.map((m) => (
                <li key={m.id}>
                  {m.title} — {m.report} ({Math.round(m.score * 100)}%)
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="rasd-ad-card">
        <Section label={OBS_LABELS.condition}>{d.condition}</Section>
        <Section
          label={OBS_LABELS.legalBasis}
          extra={<span className={`rasd-ad-chip rasd-ad-basis-${basisSource}`}> {BASIS_LABEL[basisSource]}</span>}
        >
          {d.legalBasis.text}
        </Section>
        <Section label={OBS_LABELS.cause}>{d.cause}</Section>
        <Section label={OBS_LABELS.effect}>{d.effect}</Section>
        <Section label={OBS_LABELS.recommendation}>{d.recommendation}</Section>
        {basisSource === "library" && (
          <p className="rasd-ad-hint">السند مقترح آليًا من مكتبة الأنظمة التي رفعتها (نص المقطع ورقم المادة كما وردا فيه)؛ تحقق من مطابقته قبل الاعتماد.</p>
        )}
        {hasDefaultWording(d) && <p className="rasd-ad-hint">لم تطابق الملاحظة قاعدة محددة، فصياغة السبب أو الأثر أو التوصية عامة؛ يُنصح بتعديلها.</p>}
      </div>

      <label className="rasd-ad-field">
        النشاط (يُدرج الملاحظة في تبويب التدقيق لهذا النشاط)
        <select value={sector} onChange={(e) => setSector(e.target.value)}>
          {auditSectors.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {stage === "review" ? (
        <div className="rasd-ad-actions">
          <button type="button" className="rasd-ad-btn rasd-ad-primary" onClick={() => setStage("confirm")}>
            ✓ اعتماد
          </button>
          <button type="button" className="rasd-ad-btn" onClick={startEdit}>
            ✎ تعديل
          </button>
          <button type="button" className="rasd-ad-btn rasd-ad-danger" onClick={() => setStage("delete")}>
            🗑 حذف
          </button>
        </div>
      ) : (
        <div className="rasd-ad-card rasd-ad-confirm">
          <p>
            عند الاعتماد تُدرج الملاحظة بتصنيف <b>{SEVERITY_WORD[d.severity]}</b> في «التقرير الرقابي» وفي قالب التقرير وملف Word/PDF
            للنشاط «{sectorName(sector)}». لا تدخل أي تقرير قبل ذلك.
          </p>
          {!trusted && (
            <label className="rasd-ad-check">
              <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
              أؤكد اعتماد الملاحظة بلا سند من المكتبة (سأستكمل السند لاحقًا)
            </label>
          )}
          {err && (
            <p className="rasd-ai-error" role="alert">
              {err}
            </p>
          )}
          <div className="rasd-ad-actions">
            <button type="button" className="rasd-ad-btn rasd-ad-primary" disabled={!trusted && !sure} onClick={approve}>
              اعتماد نهائي وإدراجها في التقرير
            </button>
            <button type="button" className="rasd-ad-btn" onClick={() => setStage("review")}>
              رجوع
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
