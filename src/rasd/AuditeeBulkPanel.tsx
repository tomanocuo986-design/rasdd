import { useState } from "react";
import type { Observation } from "./observations";
import {
  addSampleResponses,
  clearSampleResponses,
  analyzeResponse,
  setResponseText,
  splitBulkResponses,
  summarizeResponses,
  withAnalysis,
  decide,
  type RecordMap,
} from "./auditee-response";

interface Props {
  observations: Observation[];
  map: RecordMap;
  onChange: (next: RecordMap) => void;
}

/** قراءة نص ملف الردود: txt/md مباشرة، وdocx من word/document.xml، وPDF عبر مستخرج المشروع. */
async function readFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) throw new Error("ملف Word غير صالح");
    return xml
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
  }
  if (name.endsWith(".pdf")) {
    const mod = (await import("./pdf-text.js")) as {
      extractPdfText: (f: File, o?: unknown) => Promise<string | { text: string }>;
    };
    const r = await mod.extractPdfText(file);
    return typeof r === "string" ? r : r.text;
  }
  return file.text();
}

/** إدخال ردود الجهة على كل الملاحظات دفعة واحدة، وتحليلها كلها، واعتماد ما يقبله المدقق. */
export function AuditeeBulkPanel({ observations, map, onChange }: Props) {
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState("");
  const s = summarizeResponses(observations, map);

  const importText = (text: string) => {
    const matches = splitBulkResponses(text, observations);
    if (!matches.length) {
      setMsg("لم أجد ردوداً مرقّمة (1. 2. 3.). رقّم كل رد أو الصقه تحت الملاحظة المعنية.");
      return;
    }
    let m = map;
    for (const x of matches) m = setResponseText(m, x.id, x.response);
    onChange(m);
    const byNumber = matches.filter((x) => x.by === "number").length;
    setMsg(
      `وُزّع ${matches.length} رداً على الملاحظات${byNumber ? ` (${byNumber} منها بالرقم فقط: راجع مطابقتها)` : ""}. اضغط «حلّل كل الردود».`,
    );
  };
  const analyzeAll = () => {
    let m = map;
    let n = 0;
    for (const o of observations) {
      const r = m[o.id];
      if (!r || r.analysis) continue;
      m = withAnalysis(m, o.id, analyzeResponse(o, r.response));
      n++;
    }
    onChange(m);
    setMsg(
      n
        ? `حُلّل ${n} رداً. راجع كل رأي ثم اعتمده أو عدّله أو ارفضه.`
        : "لا توجد ردود جديدة تنتظر التحليل.",
    );
  };
  const approveAllAsIs = () => {
    let m = map;
    let n = 0;
    for (const o of observations) {
      const r = m[o.id];
      if (r?.analysis && r.decision === "pending") {
        m = decide(m, o.id, "approved");
        n++;
      }
    }
    onChange(m);
    setMsg(`اعتُمد ${n} رأياً كما اقترحه المحاكي. يمكنك تعديل أي منها لاحقاً.`);
  };

  return (
    <section className="mt-4 rounded-md border p-3 text-xs" data-testid="auditee-bulk">
      <b>محاكي ردود الجهة — لكل الملاحظات</b>
      <p className="mt-1 text-muted-foreground">
        ردود: {s.withResponse}/{s.total} · محلَّلة {s.analyzed} · معتمدة {s.approved} · بانتظار
        قرارك {s.pending}
      </p>
      <textarea
        className="mt-2 min-h-[5rem] w-full rounded-md border px-2 py-1"
        aria-label="ملف ردود الجهة"
        placeholder={
          "الصق كتاب رد الجهة كاملاً. يُفصل بالترقيم:\n1. رد الجهة على الملاحظة الأولى …\n2. رد الجهة على الملاحظة الثانية …"
        }
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border px-2 py-1"
          disabled={!raw.trim()}
          onClick={() => importText(raw)}
        >
          توزيع الردود على الملاحظات
        </button>
        <label className="cursor-pointer rounded-md border px-2 py-1">
          رفع ملف الرد (docx / pdf / txt)
          <input
            type="file"
            accept=".docx,.pdf,.txt,.md"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const t = await readFileText(f);
                setRaw(t);
                importText(t);
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "تعذّرت قراءة الملف");
              }
            }}
          />
        </label>
        <button
          type="button"
          className="rounded-md border px-2 py-1"
          onClick={() => {
            onChange(addSampleResponses(map, observations));
            setMsg("أُدرجت ردود تجريبية (لا تدخل التقرير). اضغط «حلّل كل الردود» لتجربة المحاكي.");
          }}
        >
          إدراج ردود تجريبية
        </button>
        {Object.values(map).some((r) => r.demo) && (
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-danger"
            onClick={() => {
              onChange(clearSampleResponses(map));
              setMsg("حُذفت الردود التجريبية.");
            }}
          >
            حذف الردود التجريبية
          </button>
        )}
        <button
          type="button"
          className="rounded-md border px-2 py-1 font-semibold"
          disabled={!s.withResponse}
          onClick={analyzeAll}
        >
          حلّل كل الردود
        </button>
        <button
          type="button"
          className="rounded-md border px-2 py-1"
          disabled={!s.pending}
          onClick={approveAllAsIs}
        >
          اعتماد كل الآراء المعلّقة كما هي
        </button>
      </div>
      {msg && (
        <p role="status" className="mt-2">
          {msg}
        </p>
      )}
    </section>
  );
}
