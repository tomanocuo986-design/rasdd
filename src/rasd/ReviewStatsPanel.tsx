// @ts-nocheck
import { noisyRules, ruleStats } from "./review-log.js";

interface Props {
  log: any[];
  threshold: { noisyRate: number; minReviewed: number };
  onThresholdChange: (t: { noisyRate: number; minReviewed: number }) => void;
  datasetLabel: (key: string) => string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** لوحة الإنذارات الكاذبة: نسبتها لكل اختبار مع تنبيه عند تجاوز الحد الذي يحدده المدقق. */
export function ReviewStatsPanel({ log, threshold, onThresholdChange, datasetLabel }: Props) {
  const stats = ruleStats(log);
  const noisy = noisyRules(log, threshold);
  const isNoisy = (s) => noisy.some((n) => n.dataset === s.dataset && n.test === s.test);

  return (
    <section className="table-panel stat-card" data-testid="review-stats">
      <h3 className="font-semibold">جودة الاختبارات: الإنذارات الكاذبة ({log.length} قرار)</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        يسجّل المدقق «مؤكدة» أو «إنذار كاذب» لكل ملاحظة، ومنها تُحسب نسبة الإنذارات الكاذبة لكل اختبار. لا تتغير الخطورة
        تلقائيًا؛ التنبيه اقتراح لمراجعة حد القاعدة.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          حد التنبيه (%)
          <input
            type="number"
            min={1}
            max={100}
            className="w-16 rounded-md border px-1 py-0.5"
            value={Math.round(threshold.noisyRate * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              if (v > 0 && v <= 1) onThresholdChange({ ...threshold, noisyRate: v });
            }}
          />
        </label>
        <label className="flex items-center gap-1">
          أقل عدد مراجعات
          <input
            type="number"
            min={1}
            className="w-16 rounded-md border px-1 py-0.5"
            value={threshold.minReviewed}
            onChange={(e) => {
              const v = Math.floor(Number(e.target.value));
              if (v >= 1) onThresholdChange({ ...threshold, minReviewed: v });
            }}
          />
        </label>
      </div>
      {noisy.length > 0 && (
        <p role="alert" className="mt-3 rounded-md border border-danger px-2 py-1 text-xs text-danger">
          تنبيه: {noisy.length} اختبار(ات) تجاوزت نسبة الإنذارات الكاذبة فيها {pct(threshold.noisyRate)} — راجع حدودها:{" "}
          {noisy.map((s) => s.test).join("، ")}
        </p>
      )}
      {stats.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">لا توجد قرارات مراجعة بعد.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-right">
                <th className="p-1">الاختبار</th>
                <th className="p-1">الجدول</th>
                <th className="p-1">المراجَع</th>
                <th className="p-1">مؤكدة</th>
                <th className="p-1">إنذار كاذب</th>
                <th className="p-1">النسبة</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={`${s.dataset}|${s.test}`} className={isNoisy(s) ? "text-danger" : ""}>
                  <td className="p-1">{s.test}</td>
                  <td className="p-1">{s.dataset === "manual" ? "ملاحظة يدوية" : datasetLabel(s.dataset)}</td>
                  <td className="p-1">{s.reviewed}</td>
                  <td className="p-1">{s.confirmed}</td>
                  <td className="p-1">{s.falsePositive}</td>
                  <td className="p-1">{pct(s.falsePositiveRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
