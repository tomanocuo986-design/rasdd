import { useState } from "react";
import type { ObsEdit, Observation, Severity } from "./observations";

const SEV_OPTIONS: Severity[] = ["high", "medium", "low"];

interface FormState {
  test: string;
  condition: string;
  legalBasis: string;
  cause: string;
  effect: string;
  recommendation: string;
  rating: Severity;
}

const formOf = (o: Observation): FormState => ({
  test: o.test,
  condition: o.condition,
  legalBasis: o.legalBasis.text,
  cause: o.cause,
  effect: o.effect,
  recommendation: o.recommendation,
  rating: o.risk.rating,
});

const FIELDS: Array<[keyof Omit<FormState, "rating">, string, number]> = [
  ["test", "عنوان الملاحظة", 1],
  ["condition", "الحالة", 3],
  ["legalBasis", "السند القانوني", 3],
  ["cause", "السبب", 3],
  ["effect", "الأثر", 3],
  ["recommendation", "التوصية", 3],
];

interface Props {
  observation: Observation;
  sevLabel: Record<Severity | "none", string>;
  /** approve=true: «حفظ واعتماد» (البوابة القانونية تُطبَّق عند المستدعي إن لزم). */
  onSave: (patch: ObsEdit, approve: boolean) => void;
  onCancel: () => void;
}

/** نموذج تعديل صياغة الملاحظة المصاغة (الحالة · السند القانوني · السبب · الأثر · التوصية · التصنيف). */
export function ObservationEditForm({ observation: o, sevLabel, onSave, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(() => formOf(o));
  const set = (k: keyof FormState, v: string) => setForm({ ...form, [k]: v });
  return (
    <div data-testid="edit-form" className="mt-3 grid gap-2 rounded-md border p-3 text-xs">
      {FIELDS.map(([k, label, rows]) => (
        <label key={k} className="grid gap-1">
          <b>{label}</b>
          {rows === 1 ? (
            <input className="rounded-md border px-2 py-1" aria-label={label} value={form[k]} onChange={(e) => set(k, e.target.value)} />
          ) : (
            <textarea className="rounded-md border px-2 py-1" aria-label={label} rows={rows} value={form[k]} onChange={(e) => set(k, e.target.value)} />
          )}
        </label>
      ))}
      <label className="grid gap-1">
        <b>التصنيف</b>
        <select className="rounded-md border px-2 py-1" aria-label="التصنيف" value={form.rating} onChange={(e) => set("rating", e.target.value)}>
          {SEV_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {sevLabel[v]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-md border px-2 py-1" onClick={() => onSave(form, false)}>
          حفظ التعديل
        </button>
        <button type="button" className="rounded-md border px-2 py-1 text-success" onClick={() => onSave(form, true)}>
          حفظ واعتماد
        </button>
        <button type="button" className="rounded-md border px-2 py-1" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
