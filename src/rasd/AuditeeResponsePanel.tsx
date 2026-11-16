import { useEffect, useState } from "react";
import type { Observation } from "./observations";
import {
  STANCE_LABELS,
  VERDICT_LABELS,
  analyzeResponse,
  decide,
  loadResponses,
  requestAiAnalysis,
  saveResponses,
  setResponseText,
  withAnalysis,
  RESPONSES_EVENT,
  type RecordMap,
  type Verdict,
} from "./auditee-response";

/** يقرأ ردود الجهة من التخزين ويتحدّث عند أي تغيير (من أي لوحة). */
export function useAuditeeResponses(): [RecordMap, (next: RecordMap) => void] {
  const [map, setMap] = useState<RecordMap>(() => loadResponses());
  useEffect(() => {
    const h = () => setMap(loadResponses());
    window.addEventListener(RESPONSES_EVENT, h);
    return () => window.removeEventListener(RESPONSES_EVENT, h);
  }, []);
  const update = (next: RecordMap) => {
    setMap(next);
    saveResponses(next);
  };
  return [map, update];
}

const TONE: Record<Verdict, string> = {
  accepted: "text-success",
  partially_accepted: "text-warning",
  not_accepted: "text-danger",
  insufficient: "text-muted-foreground",
};

interface Props {
  observation: Observation;
  map: RecordMap;
  onChange: (next: RecordMap) => void;
}

/** رد إدارة الجهة على ملاحظة واحدة: إدخال الرد، تحليل المحاكي، وقرار المدقق (اعتماد/تعديل/رفض). */
export function AuditeeResponsePanel({ observation: o, map, onChange }: Props) {
  const rec = map[o.id];
  const [text, setText] = useState(rec?.response ?? "");
  const [opinion, setOpinion] = useState(rec?.finalOpinion ?? rec?.analysis?.followUp ?? "");
  const [date, setDate] = useState(rec?.actionDate ?? "");
  const [owner, setOwner] = useState(rec?.actionOwner ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // عند تغيّر السجل من الخارج (استيراد مجمّع أو تحليل الكل) نزامن الحقول
  useEffect(() => {
    setText(rec?.response ?? "");
    setOpinion(rec?.finalOpinion ?? rec?.analysis?.followUp ?? "");
    setDate(rec?.actionDate ?? "");
    setOwner(rec?.actionOwner ?? "");
  }, [rec?.response, rec?.analysis, rec?.finalOpinion, rec?.actionDate, rec?.actionOwner]);

  const a = rec?.analysis;
  const dirty = text.trim() !== (rec?.response ?? "");

  const analyze = () => {
    let m = setResponseText(map, o.id, text);
    if (!m[o.id]) return;
    m = withAnalysis(m, o.id, analyzeResponse(o, m[o.id]!.response));
    setErr("");
    onChange(m);
  };
  const askAi = async () => {
    if (!a || !rec) return;
    setBusy(true);
    setErr("");
    try {
      const ai = await requestAiAnalysis(o, rec.response, a);
      onChange(withAnalysis(map, o.id, ai));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر الحصول على رأي الذكاء الاصطناعي.");
    } finally {
      setBusy(false);
    }
  };
  const act = (d: "approved" | "rejected") =>
    onChange(decide(map, o.id, d, { opinion, actionDate: date, actionOwner: owner }));

  return (
    <div className="mt-3 rounded-md border p-3 text-xs" data-testid="auditee-panel">
      <b>رد إدارة الجهة (محاكي الردود)</b>
      <p className="mt-1 text-muted-foreground">
        الصق رد الجهة على هذه الملاحظة. يقارنه المحاكي بالحالة والتوصية ويقترح رأياً؛ لا يدخل «تعقيب
        الديوان» في التقرير إلا بعد اعتمادك له.
      </p>
      <textarea
        className="mt-2 min-h-[5rem] w-full rounded-md border px-2 py-1"
        aria-label="رد إدارة الجهة"
        placeholder="نص رد الجهة…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border px-2 py-1"
          disabled={!text.trim()}
          onClick={analyze}
        >
          {a && !dirty ? "إعادة التحليل" : "حلّل الرد وأبدِ الرأي"}
        </button>
        {a && !dirty && (
          <button
            type="button"
            className="rounded-md border px-2 py-1"
            disabled={busy}
            onClick={askAi}
          >
            {busy ? "جارٍ الاستشارة…" : "رأي ثانٍ بالذكاء الاصطناعي"}
          </button>
        )}
        {rec && (
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-danger"
            onClick={() => onChange(setResponseText(map, o.id, ""))}
          >
            حذف الرد
          </button>
        )}
      </div>
      {err && (
        <p role="alert" className="mt-2 text-danger">
          {err}
        </p>
      )}
      {a && !dirty && (
        <div className="mt-3 grid gap-2" data-testid="auditee-analysis">
          <p>
            <b>موقف الجهة: </b>
            {STANCE_LABELS[a.stance]} ·{" "}
            <b className={TONE[a.verdict]}>{VERDICT_LABELS[a.verdict]}</b>
            <span className="text-muted-foreground">
              {" "}
              · {a.source === "ai" ? "رأي النموذج الذكي" : "بالقواعد المحلية"}
            </span>
          </p>
          <p>
            <b>رأي المحاكي: </b>
            {a.opinion}
          </p>
          {a.reasons.length > 0 && (
            <div>
              <b>أسباب الحكم:</b>
              <ul className="list-disc pr-5">
                {a.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {a.gaps.length > 0 && (
            <div>
              <b>ما لم يعالجه الرد:</b>
              <ul className="list-disc pr-5">
                {a.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="grid gap-1">
            <b>تعقيب الديوان (قابل للتعديل قبل الاعتماد)</b>
            <textarea
              className="min-h-[4rem] rounded-md border px-2 py-1"
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              تاريخ التنفيذ (خطة العمل)
              <input
                className="rounded-md border px-2 py-1"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              الطرف المسؤول
              <input
                className="rounded-md border px-2 py-1"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border px-2 py-1 font-semibold"
              disabled={!opinion.trim()}
              onClick={() => act("approved")}
            >
              ✓ اعتماد الرأي للتقرير
            </button>
            <button
              type="button"
              className="rounded-md border px-2 py-1 text-danger"
              onClick={() => act("rejected")}
            >
              ✗ رفض الرأي (لا يدخل التقرير)
            </button>
            <span data-testid="auditee-decision" className="text-muted-foreground">
              {rec?.decision === "approved" && "✓ معتمد كما اقترح المحاكي"}
              {rec?.decision === "edited" && "✓ معتمد بتعديل المدقق"}
              {rec?.decision === "rejected" && "رُفض الرأي: يدخل نص الرد وحده"}
              {rec?.decision === "pending" && "بانتظار قرارك"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
