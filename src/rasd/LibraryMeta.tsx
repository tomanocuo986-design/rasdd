// @ts-nocheck
import { useState } from "react";
import { docFreshness } from "./legal-status";

/** تاريخ نفاذ النسخة ومصدرها لكل ملف في مكتبة الأنظمة، مع تحذير عند غياب التاريخ أو قِدمه. */
export function LibraryMeta({ doc, onChange }) {
  const f = docFreshness(doc);
  const [note, setNote] = useState(doc.sourceNote ?? "");
  return (
    <div className="basis-full grid gap-1 text-xs" data-testid="library-meta">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          تاريخ نفاذ النسخة
          <input
            type="date"
            className="rounded-md border px-1 py-0.5"
            value={doc.effectiveDate ?? ""}
            onChange={(e) => onChange({ effectiveDate: e.target.value })}
          />
        </label>
        <label className="flex flex-1 items-center gap-1">
          مصدر النسخة
          <input
            className="min-w-[10rem] flex-1 rounded-md border px-2 py-0.5"
            placeholder="مثال: الجريدة الرسمية عدد … / موقع الجهة"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (doc.sourceNote ?? "") && onChange({ sourceNote: note })}
          />
        </label>
      </div>
      {f.state !== "ok" && (
        <p className={f.state === "old" ? "text-danger" : "text-warning"} role="status">
          {f.label}
        </p>
      )}
    </div>
  );
}
