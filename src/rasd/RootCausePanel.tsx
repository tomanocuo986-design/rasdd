import { useState } from "react";
import { CONFIDENCE_LABELS, analyzeRootCause, type RootCause, type RootCauseInput } from "./root-cause";
import { requestAiRootCause } from "./root-cause-ai";

interface Props {
  input: RootCauseInput;
  /** الاقتراح المحلي المحسوب مسبقاً مع الملاحظة (يُحسب هنا إن غاب) */
  rootCause?: RootCause | undefined;
  /** نص حقل «السبب» الحالي في الملاحظة، لإخفاء زر الاعتماد إن طابق الاقتراح */
  currentCause?: string | undefined;
  /** يُستدعى باختيار المدقق اعتماد الصياغة كسبب للملاحظة؛ إن غاب لا يظهر الزر */
  onUse?: ((statement: string) => void) | undefined;
  /** لاختبار الواجهة دون شبكة */
  fetchImpl?: typeof fetch | undefined;
}

/** السبب الجذري المقترح للملاحظة: تصنيف محلي بالقواعد مع أدلته، وزر اختياري لتحليل أعمق بالذكاء الاصطناعي. */
export function RootCausePanel({ input, rootCause, currentCause, onUse, fetchImpl }: Props) {
  const [local] = useState<RootCause>(() => rootCause ?? analyzeRootCause(input));
  const [shown, setShown] = useState<RootCause>(local);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function askAi() {
    setBusy(true);
    setErr("");
    try {
      setShown(await requestAiRootCause(input, local, { fetchImpl }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تعذّر التحليل.");
    } finally {
      setBusy(false);
    }
  }

  const applied = (currentCause ?? "").trim() === shown.statement;
  return (
    <div data-testid="root-cause" className="mt-3 grid gap-2 rounded-md border px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <b>السبب الجذري المقترح:</b>
        <span data-testid="root-cause-label" className="rounded-full border px-2 py-0.5 font-semibold">
          {shown.label}
        </span>
        <span className="text-muted-foreground">
          {CONFIDENCE_LABELS[shown.confidence]} · {shown.source === "ai" ? "تحليل الذكاء الاصطناعي" : "قواعد محلية"}
        </span>
      </div>
      <p data-testid="root-cause-statement">{shown.statement}</p>
      <details>
        <summary className="cursor-pointer text-muted-foreground">لماذا هذا السبب؟ (سلسلة «لماذا» والأدلة والمعالجة)</summary>
        <ol className="mt-2 list-decimal pr-5">
          {shown.whys.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>
        <p className="mt-2">
          <b>الأدلة: </b>
          {shown.evidence.join("؛ ")}
        </p>
        <p className="mt-1">
          <b>المعالجة الجذرية: </b>
          {shown.fix}
        </p>
      </details>
      <div className="flex flex-wrap items-center gap-2">
        {onUse && (
          <button
            type="button"
            data-testid="root-cause-use"
            className="rounded-md border px-2 py-1"
            disabled={applied}
            onClick={() => onUse(shown.statement)}
          >
            {applied ? "✓ هذا هو السبب المعتمد في الملاحظة" : "اعتماد كسبب للملاحظة"}
          </button>
        )}
        <button type="button" data-testid="root-cause-ai" className="rounded-md border px-2 py-1" disabled={busy} onClick={askAi}>
          {busy ? "جارٍ التحليل…" : shown.source === "ai" ? "إعادة التحليل بالذكاء الاصطناعي" : "حلّل بالذكاء الاصطناعي"}
        </button>
        {shown.source === "ai" && (
          <button type="button" className="rounded-md border px-2 py-1" onClick={() => setShown(local)}>
            العودة للاقتراح المحلي
          </button>
        )}
      </div>
      {err && (
        <p role="alert" data-testid="root-cause-error" className="text-danger">
          {err}
        </p>
      )}
      <p className="text-muted-foreground">اقتراح يراجعه المدقق: لا يتغير حقل «السبب» إلا باختيارك.</p>
    </div>
  );
}
