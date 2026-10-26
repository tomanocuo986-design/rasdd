// @ts-nocheck
/**
 * معايرة الخطورة النهائية (finalSeverity).
 *
 * الدرجة = الخطورة الأساسية (1 منخفضة، 2 متوسطة، 3 مرتفعة)
 *        + وزن التكرار من التقارير السابقة
 *        + وزن الأثر المالي بالنسبة لحدود البلدية.
 * ثم تُقرَّب وتُقيَّد بين 1 و3. المعايرة لا تخفض الخطورة الأساسية أبداً، فقط ترفعها.
 *
 * الحدود المالية تختلف بحسب حجم البلدية، ولذلك تُعرَّف ملفات جاهزة (profiles) قابلة للتعديل الحر.
 * الأرقام الافتراضية نقطة انطلاق تقديرية بالدينار، وليست حدوداً نظامية، ويجب على المدقق مراجعتها.
 */
export const CALIBRATION_PROFILES = {
  large: { label: "بلدية كبرى (موازنة مرتفعة)", highImpact: 50000, mediumImpact: 10000 },
  medium: { label: "بلدية متوسطة", highImpact: 20000, mediumImpact: 5000 },
  small: { label: "بلدية صغيرة", highImpact: 5000, mediumImpact: 1000 },
  custom: { label: "حدود مخصصة", highImpact: 20000, mediumImpact: 5000 },
};

export const defaultCalibration = {
  profile: "medium",
  highImpact: CALIBRATION_PROFILES.medium.highImpact,
  mediumImpact: CALIBRATION_PROFILES.medium.mediumImpact,
  /** وزن كل مرة تكررت فيها المخالفة بعينها في تقرير سابق */
  recurrenceWeight: 1,
  /** وزن تكرار نمط الاختبار نفسه (مع اختلاف السجل) */
  patternWeight: 0.4,
  /** سقف ما يضيفه التكرار مهما تكرر */
  recurrenceCap: 2,
  /** مضاعف وزن الأثر المالي (0 يعطله) */
  impactWeight: 1,
};

export const calibrationFields = [
  { key: "highImpact", label: "حد الأثر المالي المرتفع (دينار)", min: 0 },
  { key: "mediumImpact", label: "حد الأثر المالي المتوسط (دينار)", min: 0 },
  { key: "recurrenceWeight", label: "وزن تكرار نفس المخالفة من تقرير سابق", min: 0 },
  { key: "patternWeight", label: "وزن تكرار نمط الاختبار بسجل مختلف", min: 0 },
  { key: "recurrenceCap", label: "أقصى زيادة يضيفها التكرار (درجات)", min: 0 },
  { key: "impactWeight", label: "وزن الأثر المالي (0 = معطل)", min: 0 },
];

/** تطبيق ملف جاهز: يضبط الحدين ويبقي بقية الأوزان كما هي. */
export function applyProfile(calibration, profile) {
  const p = CALIBRATION_PROFILES[profile];
  if (!p || profile === "custom") return { ...calibration, profile };
  return { ...calibration, profile, highImpact: p.highImpact, mediumImpact: p.mediumImpact };
}

const LEVEL = { low: 1, medium: 2, high: 3 };
const NAME = { 1: "low", 2: "medium", 3: "high" };
const WORD = { low: "منخفضة", medium: "متوسطة", high: "مرتفعة" };

/**
 * @param base       الخطورة الأساسية: low | medium | high
 * @param ctx        { exactCount, patternCount, amount }
 * @param calibration
 * @returns { severity, score, recurrenceBoost, impactBoost, explain }
 */
export function calibrateSeverity(base, ctx = {}, calibration = defaultCalibration) {
  const c = { ...defaultCalibration, ...calibration };
  const baseLevel = LEVEL[base] ?? 1;

  const exact = Math.max(0, Number(ctx.exactCount) || 0);
  const pattern = ctx.patternCount ? Math.max(0, Number(ctx.patternCount) || 0) : 0;
  const recurrenceBoost = Math.min(c.recurrenceCap, exact * c.recurrenceWeight + (exact ? 0 : pattern ? c.patternWeight : 0));

  const amount = Math.abs(Number(ctx.amount) || 0);
  let impactBoost = 0;
  if (c.impactWeight > 0) {
    if (c.highImpact > 0 && amount >= c.highImpact) impactBoost = 1 * c.impactWeight;
    else if (c.mediumImpact > 0 && amount >= c.mediumImpact) impactBoost = 0.5 * c.impactWeight;
  }

  const score = baseLevel + recurrenceBoost + impactBoost;
  const level = Math.min(3, Math.max(baseLevel, Math.round(score + 1e-9)));
  const parts = [`الأساسية ${WORD[base] ?? base}`];
  if (recurrenceBoost) parts.push(exact ? `تكرار ${exact}× (+${recurrenceBoost})` : `نمط متكرر (+${recurrenceBoost})`);
  if (impactBoost) parts.push(`أثر مالي ${amount.toLocaleString("en-US")} (+${impactBoost})`);
  return {
    severity: NAME[level],
    score,
    recurrenceBoost,
    impactBoost,
    explain: parts.length > 1 ? `${parts.join(" ")} ⇒ ${WORD[NAME[level]]}` : `${parts[0]} ⇒ ${WORD[NAME[level]]}`,
  };
}

/** يقرأ الأثر المالي لمخالفة: القيمة التي حددها الاختبار، وإلا قيمة السجل الأساسية. */
export function impactAmount(finding, row, valueKey) {
  if (Number.isFinite(finding?.amount)) return Math.abs(finding.amount);
  if (!row || !valueKey) return 0;
  const x = Number(String(row[valueKey] ?? "").replaceAll(",", "").trim());
  return Number.isFinite(x) ? Math.abs(x) : 0;
}

export function loadCalibration() {
  try {
    const v = JSON.parse(localStorage.getItem("rasd-audit-calibration") ?? "null");
    if (v && typeof v === "object") return { ...defaultCalibration, ...v };
  } catch {
    /* storage unavailable or corrupt */
  }
  return defaultCalibration;
}

export function saveCalibration(c) {
  try {
    localStorage.setItem("rasd-audit-calibration", JSON.stringify(c));
  } catch {
    /* storage unavailable */
  }
}
