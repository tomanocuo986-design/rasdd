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
  { dataset, test, ref = "", decision, by = "", note = "", fingerprint = "", autoHidden = false },
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
      fingerprint,
      autoHidden,
      at: now.toISOString(),
    },
  ];
}

/** بصمة الملاحظة: السجلات المرصودة وعددها. إن تغيّرت البيانات تتغير البصمة ويُعاد النظر في القرار السابق. */
export function observationFingerprint(o) {
  const refs = [...(o?.refs ?? [])].map(String).sort().join(",");
  return `${o?.count ?? 0}#${refs}`;
}

/** آخر قرار مسجَّل لملاحظة (معرّفها dataset|test)، أو undefined. */
export function decisionFor(log, o) {
  const id = `${key(o.dataset, o.test)}|${String(o.id).trim()}`;
  return log.find((e) => e.id === id);
}

/** إنذار كاذب سبق تسجيله لنفس الملاحظة وبنفس البصمة => لا تُعاد في التقارير اللاحقة. */
export function isSuppressed(log, o) {
  const d = decisionFor(log, o);
  return Boolean(d && d.decision === DECISIONS.falsePositive && d.fingerprint === observationFingerprint(o));
}

/** معرّفات الملاحظات التي أخفاها مسار «إنذار كاذب» وتغيّرت بياناتها منذ ذلك فيجب إظهارها من جديد. */
export function staleHiddenIds(log, observations) {
  return observations
    .filter((o) => {
      const d = decisionFor(log, o);
      return d && d.autoHidden && d.decision === DECISIONS.falsePositive && d.fingerprint !== observationFingerprint(o);
    })
    .map((o) => o.id);
}

const THRESHOLD_KEY = "rasd-review-threshold";
export const DEFAULT_THRESHOLD = { noisyRate: 0.6, minReviewed: 10 };

export function loadThreshold(storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(THRESHOLD_KEY) ?? "null");
    const rate = Number(v?.noisyRate);
    const min = Number(v?.minReviewed);
    return {
      noisyRate: rate > 0 && rate <= 1 ? rate : DEFAULT_THRESHOLD.noisyRate,
      minReviewed: Number.isInteger(min) && min >= 1 ? min : DEFAULT_THRESHOLD.minReviewed,
    };
  } catch {
    return { ...DEFAULT_THRESHOLD };
  }
}

export function saveThreshold(t, storage = globalThis.localStorage) {
  try {
    storage.setItem(THRESHOLD_KEY, JSON.stringify(t));
  } catch {
    /* storage full */
  }
}

/** الاختبارات التي تجاوزت نسبة الإنذارات الكاذبة فيها الحد، بعد عدد كافٍ من المراجعات. */
export function noisyRules(log, { noisyRate, minReviewed } = DEFAULT_THRESHOLD) {
  return ruleStats(log).filter((s) => s.reviewed >= minReviewed && s.falsePositiveRate >= noisyRate);
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
