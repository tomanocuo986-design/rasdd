// @ts-nocheck
import { useRef, useState } from "react";
import { extractPdfText } from "./pdf-text";
import { repairArabic } from "./arabic-text.js";
import { CHECKLIST, STATUS_LABEL, reportToText, reviewDocumentRedacted } from "./doc-review.js";

/**
 * مراجعة مستند عطاء بالذكاء الاصطناعي مقابل قائمة تحقق (انظر doc-review.js).
 * النموذج يقترح والكود يتحقق من الاقتباسات والمدقق يقرر: لا يُنشئ هذا اللوحة ملاحظات رقابية ولا يعتمد شيئاً.
 * يُحجب النص أولاً في المتصفح (redact.js: أرقام وطنية، هواتف، IBAN، بريد، أسماء بألقاب، ومصطلحات المدقق) ثم يُرسل مقاطع
 * منه فقط (لا تُخزَّن ولا تُسجَّل). الخادم يرفض المزودين الخارجيين ما لم يسمح المسؤول (DOC_REVIEW_ALLOW_EXTERNAL=1).
 */
async function callServer(chunk, itemIds, index, total, signal) {
  const res = await fetch("/api/doc-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    signal,
    body: JSON.stringify({ text: chunk, itemIds, index, total }),
  });
  if (!res.ok) {
    let msg = "تعذّرت مراجعة المقطع.";
    try {
      msg = (await res.json()).error || msg;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()).text;
}

const TONE = { verified_present: "", unverified_claim: "text-danger", not_found: "text-danger", unclear: "text-muted-foreground" };

export function DocReviewPanel() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [review, setReview] = useState(null);
  const [terms, setTerms] = useState("");
  const abortRef = useRef(null);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setMsg("");
    setReview(null);
    try {
      if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
        setBusy(true);
        setMsg("جارٍ استخراج نص الملف…");
        setText(repairArabic(await extractPdfText(f)));
      } else setText(await f.text());
      setMsg("");
    } catch {
      setMsg("تعذّرت قراءة الملف؛ الصق النص يدوياً.");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setReview(null);
    setMsg("جارٍ المراجعة…");
    let lastErr = "";
    try {
      const r = await reviewDocumentRedacted(
        text,
        async (chunk, ids, i, n) => {
          setMsg(`جارٍ مراجعة المقطع ${i} من ${n}…`);
          try {
            return await callServer(chunk, ids, i, n, controller.signal);
          } catch (e) {
            lastErr = e?.message || "";
            throw e;
          }
        },
        { extraTerms: terms.split("\n") },
      );
      setReview(r);
      setMsg(
        r.chunksTotal === 0
          ? "لا يوجد نص للمراجعة."
          : r.failedChunks
            ? `تعذّرت مراجعة ${r.failedChunks} من ${r.chunksTotal} مقاطع${lastErr ? `: ${lastErr}` : ""}. لا يُجزم بغياب أي بند.`
            : "",
      );
    } catch {
      setMsg("تعذّرت المراجعة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="table-panel stat-card" data-testid="doc-review">
      <h3 className="font-semibold">مراجعة مستند عطاء بالذكاء الاصطناعي ({CHECKLIST.length} بنود)</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        ارفع مستند العطاء (PDF أو نص) أو الصقه. يقترح النموذج، ولا يُقبل «موجود» إلا باقتباس حرفي يجده البرنامج في المستند. «لم يُعثر عليه» ليس مخالفة: هو مؤشر يحتاج تأكيدك.
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <input type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" onChange={onFile} disabled={busy} data-testid="doc-review-file" />
        <button className="rounded-md border px-2 py-1" disabled={busy || !text.trim()} onClick={run} data-testid="doc-review-run">
          راجع المستند
        </button>
        {busy && abortRef.current && (
          <button className="rounded-md border px-2 py-1" onClick={() => abortRef.current?.abort()}>
            إيقاف
          </button>
        )}
      </div>
      <textarea
        className="mt-2 w-full rounded-md border p-2 text-xs"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="نص المستند…"
        data-testid="doc-review-text"
      />
      <label className="mt-2 block text-xs">
        مصطلحات تُحجب قبل الإرسال (أسماء موردين أو موظفين أو شركات، مصطلح في كل سطر):
        <textarea
          className="mt-1 w-full rounded-md border p-2 text-xs"
          rows={2}
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          data-testid="doc-review-terms"
        />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        يُحجب تلقائياً قبل الإرسال: الأرقام الوطنية والهواتف وIBAN والبريد والأسماء المسبوقة بلقب (السيد، المهندس، الدكتور…). اسم بلا لقب لا يُحجب إلا إن كتبته هنا.
      </p>
      {msg && <p className="mt-1 text-xs text-muted-foreground">{msg}</p>}
      {review && review.results.length > 0 && (
        <>
          {review.redaction && <p className="mt-2 text-xs text-muted-foreground" data-testid="doc-review-redaction">{review.redaction.summary}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            روجع {review.chunksReviewed} من {review.chunksTotal} مقاطع{review.truncated ? " (قُطع المستند لطوله فلا يُجزم بغياب أي بند)" : ""}.
          </p>
          <ul className="mt-2 grid gap-2 text-xs" data-testid="doc-review-results">
            {review.results.map((r) => (
              <li key={r.id} className="rounded-md border p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{r.title}</span>
                  <span className={TONE[r.status]}>{STATUS_LABEL[r.status]}</span>
                </div>
                {r.quote && <blockquote className="mt-1 text-muted-foreground">«{r.quote}»</blockquote>}
                {r.status !== "verified_present" && r.explanation && <p className="mt-1 text-muted-foreground">{r.explanation}</p>}
                {r.conflict && <p className="mt-1 text-danger">⚠ ورد في النص ما قد يدل عليه ({r.keywordHits.join("، ")}) فراجعه بنفسك.</p>}
                <p className="mt-1 text-muted-foreground">مرتبط بملاحظة ديوان: {r.seedRef}</p>
              </li>
            ))}
          </ul>
          <button className="mt-2 rounded-md border px-2 py-1 text-xs" onClick={() => navigator.clipboard?.writeText(reportToText(review))}>
            نسخ الملخص
          </button>
        </>
      )}
    </section>
  );
}
