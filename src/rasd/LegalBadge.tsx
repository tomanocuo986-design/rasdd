import { STATUS_LABEL, basisStatus } from "./legal-status";
import type { Observation } from "./observations";

const CLASS = {
  library: "text-success",
  framework: "text-warning",
  none: "text-danger",
} as const;

export function LegalBadge({ o }: { o: Pick<Observation, "legalBasis"> }) {
  const st = basisStatus(o);
  return (
    <span data-testid="legal-badge" data-status={st} className={`rounded-full border px-2 py-0.5 text-xs ${CLASS[st]}`}>
      {STATUS_LABEL[st]}
    </span>
  );
}

/** تأكيد صريح قبل اعتماد/تصدير ملاحظات سندها ليس من المكتبة. */
export function BasisConfirm({
  count,
  action,
  onConfirm,
  onCancel,
}: {
  count: number;
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="alert" data-testid="basis-confirm" className="mt-2 rounded-md border border-danger px-3 py-2 text-xs">
      <p className="text-danger">
        {count === 1 ? "هذه الملاحظة" : `${count} ملاحظات`} بلا سند قانوني من مكتبة الأنظمة والتعليمات (سند مدمج يحتاج تحقق أو بلا سند). ارفع النظام
        ذي العلاقة أو اربط الاختبار بمادة من «تغطية السند القانوني»، أو أكّد المتابعة وسيُسجَّل تأكيدك.
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" className="rounded-md border px-2 py-1 text-danger" onClick={onConfirm}>
          {action}
        </button>
        <button type="button" className="rounded-md border px-2 py-1" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
