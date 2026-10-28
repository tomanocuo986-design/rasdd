// سجل قرارات المدقق على الملاحظات + إحصاء الإنذارات الكاذبة لكل اختبار.
// الفكرة: بدل تخمين الحدود، يسجّل المدقق «مؤكدة» أو «إنذار كاذب»، ومن السجل نعرف أي قاعدة تُزعج أكثر مما تفيد.
// القرارات لا تغيّر الخطورة تلقائيًا؛ تُعرض كاقتراح يعتمده المدقق.

const KEY = "rasd-review-log";
export const DECISIONS = { confirmed: "confirmed", falsePositive: "false_positive" };

const key = (dataset, test) => `${dataset}|${String(test).trim()}`;

export function loadReviewLog(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** يسجّل قرارًا (آخر قرار لنفس الملاحظة يحل محل السابق). */
export function recordDecision(
  log,
  { dataset, test, ref = "", decision, by = "", note = "" },
  now = new Date(),
) {
  const id = `${key(dataset, test)}|${String(ref).trim()}`;
  const rest = log.filter((e) => e.id !== id);
  return [
    ...rest,
    {
      id,
      dataset,
      test: String(test).trim(),
      ref: String(ref).trim(),
      decision,
      by,
      note,
      at: now.toISOString(),
    },
  ];
}

export function saveReviewLog(log, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* storage full */
  }
}

/** إحصاء لكل اختبار: عدد المراجَع منه، ونسبة الإنذارات الكاذبة. */
export function ruleStats(log) {
  const m = new Map();
  for (const e of log) {
    const k = key(e.dataset, e.test);
    const s = m.get(k) ?? {
      dataset: e.dataset,
      test: e.test,
      reviewed: 0,
      confirmed: 0,
      falsePositive: 0,
    };
    s.reviewed++;
    if (e.decision === DECISIONS.confirmed) s.confirmed++;
    if (e.decision === DECISIONS.falsePositive) s.falsePositive++;
    m.set(k, s);
  }
  return [...m.values()]
    .map((s) => ({ ...s, falsePositiveRate: s.reviewed ? s.falsePositive / s.reviewed : 0 }))
    .sort((a, b) => b.falsePositiveRate - a.falsePositiveRate || b.reviewed - a.reviewed);
}

/**
 * اقتراح لكل اختبار: لا يُقترح شيء قبل minReviewed قرارًا (عينة صغيرة مضللة).
 * rate >= noisyRate => «راجع حد القاعدة أو خفّض خطورتها». rate == 0 مع عينة كافية => «القاعدة مفيدة».
 */
export function suggestions(log, { minReviewed = 10, noisyRate = 0.6 } = {}) {
  return ruleStats(log)
    .filter((s) => s.reviewed >= minReviewed)
    .map((s) => ({
      ...s,
      advice:
        s.falsePositiveRate >= noisyRate
          ? "نسبة الإنذارات الكاذبة مرتفعة: راجع حد القاعدة أو خفّض خطورتها."
          : s.falsePositive === 0
            ? "كل الملاحظات المراجَعة مؤكدة: القاعدة مفيدة."
            : "أداء مقبول.",
    }));
}
