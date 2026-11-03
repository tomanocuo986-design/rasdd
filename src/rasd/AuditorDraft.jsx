import { useEffect, useRef, useState } from "react";
import { auditSectors } from "./workspace.jsx";
import { ThinkingIndicator } from "./ThinkingIndicator.jsx";
import { NO_BASIS_TEXT, OBS_LABELS } from "./observations";
import { DELETE_GUIDANCE, SEVERITY_WORD, classifyObservation, compareObservation, loadCorpus } from "./auditor-draft.js";
import { approveChatDraft, discardChatDraft, hasDefaultWording, makeChatDraft, memoFor } from "./chat-draft.js";
import { STATUS_LABEL as BASIS_LABEL, basisStatus } from "./legal-status";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EMPTY = { title: "", text: "", sector: auditSectors[0]?.key ?? "" };
const sectorName = (k) => auditSectors.find((s) => s.key === k)?.label ?? "";
const NO_BASIS = { source: "default", text: NO_BASIS_TEXT, needsVerification: false };

function SevBadge({ level }) {
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
 * مسودة المدقق:
 *  1) يكتب المدقق الملاحظة كما رصدها.
 *  2) يقارنها رصد بملاحظات التقارير السابقة ويصنّفها (مرتفعة / متوسطة / منخفضة) مع أسباب التصنيف.
 *  3) إن لم ترد في التقارير السابقة تُصاغ بعناصر قالب الديوان: الحالة، السند القانوني (من مكتبة الأنظمة فقط)، السبب، الأثر، التوصية.
 *  4) يعتمدها المدقق أو يعدّلها أو يحذفها؛ ولا تدخل أي تقرير قبل الاعتماد النهائي.
 */
export function AuditorDraft() {
  const [stage, setStage] = useState("input"); // input | analyzing | review | edit | confirm | delete | deleted | done
  const [input, setInput] = useState(EMPTY);
  const [d, setD] = useState(null); // المسودة المصاغة (الحالة، السند، السبب، الأثر، التوصية، الخطورة، التحليل…)
  const [edit, setEdit] = useState(null);
  const [phase, setPhase] = useState("");
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const run = useRef(0);

  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );

  const setIn = (k) => (e) => setInput((x) => ({ ...x, [k]: e.target.value }));
  const setE = (k) => (e) => setEdit((x) => ({ ...x, [k]: e.target.value }));

  const reset = () => {
    run.current++;
    setInput(EMPTY);
    setD(null);
    setEdit(null);
    setReason("");
    setSure(false);
    setErr("");
    setCopied(false);
    setStage("input");
  };

  /** يقارن ويصنّف ويصوغ. `prev` = مسودة سابقة تُحفظ تعديلات المدقق عليها عند إعادة المقارنة. */
  async function analyze(text, prev) {
    const body = text.trim();
    if (!body) return;
    const id = ++run.current;
    setStage("analyzing");
    setErr("");
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
    const comparison = compareObservation(body, corpus);
    setPhase("يقدّر مستوى الخطورة (مرتفعة / متوسطة / منخفضة)…");
    await sleep(450);
    if (id !== run.current) return;
    const analysis = { comparison, ...classifyObservation(body, comparison) };
    setPhase("يصوغها بعناصر قالب الديوان ويبحث عن سندها في مكتبة الأنظمة…");
    // force: تُصاغ دائمًا هنا؛ وإن وردت سابقًا تُعرض المطابقات للمدقق ليقرر
    const r = await makeChatDraft(body, { force: true, corpus });
    if (id !== run.current) return;
    const keep = !!prev;
    setD({
      ...r,
      analysis,
      severity: analysis.severity,
      statusLabel: analysis.statusLabel,
      title: input.title.trim() || r.title,
      cause: keep ? prev.cause : r.cause,
      effect: keep ? prev.effect : r.effect,
      recommendation: keep ? prev.recommendation : r.recommendation,
      legalBasis: keep && prev.legalBasis?.text && prev.legalBasis.source !== "default" ? prev.legalBasis : r.legalBasis,
    });
    setSure(false);
    setStage("review");
  }

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

  function applyEdit() {
    const basis = edit.basis?.text?.trim() ? edit.basis : NO_BASIS;
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

  function finalApprove() {
    const r = approveChatDraft(d, input.sector, { confirmedNoBasis: sure });
    if (!r.ok) {
      setErr("هذه الملاحظة بلا سند من المكتبة؛ أكّد الاعتماد بلا سند أو عدّل السند أولًا.");
      return;
    }
    setErr("");
    setStage("done");
  }

  function confirmDelete() {
    discardChatDraft(d, reason.trim());
    setStage("deleted");
  }

  const matches = d?.analysis?.comparison?.matches ?? [];
  const basisSource = d?.legalBasis ? basisStatus({ legalBasis: d.legalBasis }) : "none";
  const trusted = basisSource === "library" || basisSource === "auditor";
  const overridden = d && d.severity !== d.analysis.severity;
  const isNew = d?.analysis?.status === "new";
  const memo = d ? memoFor({ ...d, matches }, sectorName(input.sector), reason) : "";

  return (
    <div className="rasd-ad">
      {stage === "input" && (
        <>
          <p className="rasd-ad-hint">
            اكتب الملاحظة كما رصدتها؛ يقارنها رصد بملاحظات التقارير السابقة ويصنّفها (مرتفعة / متوسطة / منخفضة)، ثم تعتمدها
            أو تعدّلها أو تحذفها. وإن لم ترد في التقارير السابقة صاغها بعناصر قالب الديوان (الحالة، السند القانوني، السبب،
            الأثر، التوصية) وصنّفها، ثم تعتمدها أو تعدّلها أو تحذفها.
          </p>
          <label className="rasd-ad-field">
            النشاط
            <select value={input.sector} onChange={setIn("sector")}>
              {auditSectors.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rasd-ad-field">
            عنوان الملاحظة (اختياري)
            <input value={input.title} maxLength={120} onChange={setIn("title")} placeholder="يُستخرج من النص إن تُرك فارغًا" />
          </label>
          <label className="rasd-ad-field">
            نص الملاحظة
            <textarea
              rows={6}
              value={input.text}
              maxLength={4000}
              onChange={setIn("text")}
              placeholder="مثال: لوحظ صرف مبلغ 12,000 دينار لمورد واحد على أوامر شراء متتالية دون عرض أسعار…"
            />
          </label>
          <button type="button" className="rasd-ad-btn rasd-ad-primary" disabled={!input.text.trim()} onClick={() => analyze(input.text)}>
            ✦ حلّل وقارن وصغ ملاحظة رقابية من وصفي
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

      {(stage === "review" || stage === "confirm") && d && (
        <>
          <div className="rasd-ad-card">
            <div className="rasd-ad-row">
              <strong>الخطورة:</strong> <SevBadge level={d.severity} />
              <span className="rasd-ad-chip">{d.statusLabel}</span>
              {isNew && <span className="rasd-ad-chip">جديدة · لم ترد في التقارير السابقة</span>}
            </div>
            {overridden && <p className="rasd-ad-hint">عدّلتَ الخطورة يدويًا (المقترح: {SEVERITY_WORD[d.analysis.severity]}).</p>}
            <ul className="rasd-ad-reasons">
              {d.analysis.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="rasd-ad-card">
            <strong>
              المقارنة بالتقارير السابقة
              <span className="rasd-ad-muted">
                {" "}
                ({d.analysis.comparison.reports} تقرير · {d.analysis.comparison.entries} بند)
              </span>
            </strong>
            {d.analysis.comparison.entries === 0 ? (
              <p className="rasd-ad-hint">لا توجد تقارير سابقة محفوظة بعد (تبويب «التقارير السابقة»)، لذلك صُنّفت بالقواعد فقط.</p>
            ) : matches.length === 0 ? (
              <p className="rasd-ad-hint">لم يُعثر على ملاحظة مشابهة: تُعد ملاحظة جديدة وقد صيغت لك أدناه.</p>
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
            <strong>{d.title}</strong>
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
              <p className="rasd-ad-hint">
                السند مقترح آليًا من مكتبة الأنظمة التي رفعتها (نص المقطع ورقم المادة كما وردا فيه)؛ تحقق من مطابقته قبل الاعتماد.
              </p>
            )}
            {hasDefaultWording(d) && (
              <p className="rasd-ad-hint">لم تطابق الملاحظة قاعدة محددة، فصياغة السبب أو الأثر أو التوصية عامة؛ يُنصح بتعديلها.</p>
            )}
            <span className="rasd-ad-muted">النشاط: {sectorName(input.sector)}</span>
          </div>

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
                عند الاعتماد النهائي تُدرج الملاحظة بخطورة <b>{SEVERITY_WORD[d.severity]}</b> في «التقرير الرقابي» وفي تبويب
                التدقيق للنشاط «{sectorName(input.sector)}»، وتدخل في التقارير المحفوظة والتصدير (Word/PDF). لا تدخل أي تقرير قبل
                ذلك.
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
                <button type="button" className="rasd-ad-btn rasd-ad-primary" disabled={!trusted && !sure} onClick={finalApprove}>
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

      {stage === "edit" && edit && (
        <>
          <label className="rasd-ad-field">
            العنوان
            <input value={edit.title} maxLength={120} onChange={setE("title")} />
          </label>
          <label className="rasd-ad-field">
            الخطورة
            <select value={edit.severity} onChange={setE("severity")}>
              <option value="high">مرتفعة</option>
              <option value="medium">متوسطة</option>
              <option value="low">منخفضة</option>
            </select>
          </label>
          <label className="rasd-ad-field">
            {OBS_LABELS.condition}
            <textarea rows={4} value={edit.condition} maxLength={4000} onChange={setE("condition")} />
          </label>
          <label className="rasd-ad-field">
            النشاط
            <select value={input.sector} onChange={setIn("sector")}>
              {auditSectors.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {d.candidates?.length > 0 && (
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
            <textarea rows={2} value={edit.cause} onChange={setE("cause")} />
          </label>
          <label className="rasd-ad-field">
            {OBS_LABELS.effect}
            <textarea rows={2} value={edit.effect} onChange={setE("effect")} />
          </label>
          <label className="rasd-ad-field">
            {OBS_LABELS.recommendation}
            <textarea rows={2} value={edit.recommendation} onChange={setE("recommendation")} />
          </label>
          <div className="rasd-ad-actions">
            <button type="button" className="rasd-ad-btn rasd-ad-primary" disabled={!edit.condition.trim()} onClick={applyEdit}>
              حفظ التعديلات
            </button>
            <button type="button" className="rasd-ad-btn" disabled={!edit.condition.trim()} onClick={() => analyze(edit.condition, { ...d, cause: edit.cause, effect: edit.effect, recommendation: edit.recommendation, legalBasis: edit.basis })}>
              إعادة المقارنة والتصنيف
            </button>
            <button type="button" className="rasd-ad-btn" onClick={() => setStage("review")}>
              إلغاء
            </button>
          </div>
          <p className="rasd-ad-hint">«إعادة المقارنة» تعيد حساب الخطورة من النص المعدّل وتستبدل الخطورة المختارة، وتُبقي السبب والأثر والتوصية والسند كما عدّلتها.</p>
        </>
      )}

      {stage === "delete" && d && (
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
            تجدها في تبويب «التقرير الرقابي» وفي «نموذج التقرير» وفي تبويب التدقيق للنشاط «{sectorName(input.sector)}»، وتخرج في ملف
            Word وPDF عند التصدير.
          </p>
          <button type="button" className="rasd-ad-btn rasd-ad-primary" onClick={reset}>
            ملاحظة جديدة
          </button>
        </div>
      )}
    </div>
  );
}
