import { legalFrameworkOf } from "./legal-framework";
import { isGarbled } from "./arabic-text.js";
import { analyzeRootCause, type RootCause } from "./root-cause";
export type Severity = "high" | "medium" | "low";

export interface RegulationMatch {
  doc: string;
  docId?: string | undefined;
  excerpt: string;
}

export interface AuditFinding {
  dataset: string;
  sector?: string | undefined;
  row?: number | undefined;
  test: string;
  detail?: string | undefined;
  ref?: string | undefined;
  severity: Severity;
  finalSeverity?: Severity | undefined;
  repeat?: { exact: boolean; report: string } | undefined;
  regulation?: RegulationMatch | undefined;
}

export interface RiskAssessment {
  impact: 1 | 2 | 3;
  likelihood: 1 | 2 | 3;
  score: number;
  rating: Severity;
  rationale: string;
}

export interface LegalBasis {
  source: "library" | "framework" | "default" | "auditor";
  text: string;
  /** kept for compatibility; always false now that the basis is taken only from uploaded files */
  needsVerification: boolean;
}

export interface Observation {
  id: string;
  dataset: string;
  sector: string;
  test: string;
  count: number;
  refs: string[];
  repeated: number;
  risk: RiskAssessment;
  condition: string;
  cause: string;
  /** اقتراح السبب الجذري المستنتج محلياً (يراجعه المدقق؛ لا يغيّر حقل السبب إلا باختياره) */
  rootCause?: RootCause | undefined;
  legalBasis: LegalBasis;
  effect: string;
  recommendation: string;
  status: "draft" | "approved";
  /** true when the auditor wrote the observation by hand in the assistant (not produced by the audit engine) */
  manual?: boolean;
  /** true when no finding of this observation appeared in any previous report: it is drafted by the program and waits for the auditor's decision */
  isNew?: boolean;
  /** true when the auditor edited the drafted wording (see ObsEdit) */
  edited?: boolean;
}

interface Rule {
  match: RegExp;
  cause: string;
  effect: string;
  recommendation: string;
}

/** Ordered: first match wins. Basis names are instrument names only, article numbers are left to the auditor. */
const RULES: Rule[] = [
  {
    match: /اختلال توزيع الأرقام الأولى/,
    cause: "احتمال إدخال مبالغ مقدَّرة أو معدَّلة يدويًا بدل تسجيلها من مستندات أصلية، أو غياب مراجعة منتظمة لتوزيع المبالغ المسجلة.",
    effect: "ضعف الثقة في صحة الأرقام المسجلة، واحتمال وجود مبالغ غير حقيقية أو مجزأة لا تظهر في المراجعة الشكلية.",
    recommendation: "سحب عينة من السجلات الأكثر انحرافًا ومطابقتها بالمستندات الأصلية، وتوثيق نتيجة الفحص قبل اعتماد الأرقام.",
  },
  {
    match: /تجمّع مبالغ تحت سقف الصلاحية/,
    cause: "غياب ضبط آلي يرصد تكدس المبالغ دون سقف الصلاحية أو دون الحد الذي يستوجب طرحًا تنافسيًا.",
    effect: "احتمال تفادي سقوف الصلاحيات والطرح التنافسي بتقدير القيم أو تجزئتها، مما يحرم الجهة من أفضل الأسعار.",
    recommendation: "مراجعة الأوامر القريبة من السقف ومبررات تسعيرها، وربط سقف الشراء المباشر بإجمالي المورد وإيقاف المتجاوز آليًا.",
  },
  {
    match: /تكرار مبلغ لنفس المورد/,
    cause: "عدم وجود فحص آلي يمنع تكرار المبلغ نفسه لنفس المورد، وضعف مطابقة أوامر الشراء بالفواتير والسندات.",
    effect: "احتمال ازدواج الصرف أو دفع مبلغ مرتين، وصعوبة استرداد المبالغ إن لم تُكتشف في وقتها.",
    recommendation: "مطابقة الأوامر المكررة بالفواتير وسندات الصرف، واسترداد أي مبلغ دُفع مرتين، وتفعيل منع التكرار عند الإدخال.",
  },
  {
    match: /شذوذ متعدد المتغيرات في سلوك مورد/,
    cause: "اجتماع عدة مؤشرات غير اعتيادية في سلوك مورد واحد (حجم، تركّز، قرب من السقف، تركّز الموافقة، تداخل الإدخال والاستلام) دون مراجعة دورية لأداء الموردين.",
    effect: "احتمال محاباة مورد أو تعامل غير تنافسي أو تداخل في المهام يتيح التلاعب، وارتفاع مخاطر الاعتماد على مورد واحد.",
    recommendation: "فحص ملف المورد وجميع أوامره ومن أدخلها واعتمدها واستلمها، ومقارنة أسعاره بالسوق، وتوسيع قاعدة الموردين.",
  },
  {
    match: /شذوذ متعدد المتغيرات في سجل/,
    cause: "غياب المراجعة التحليلية لسجلات تخرج عن نمط بقية سجلات الجدول في أكثر من سمة معًا.",
    effect: "احتمال خطأ إدخال أو صرف غير معتاد دون مسوغ موثق، لا يظهر في المراجعة الشكلية.",
    recommendation: "مطابقة السجل بمستنداته الأصلية وتوثيق مبرر قيمه غير المعتادة أو تصويبها.",
  },
  {
    match: /درجة شذوذ مرتفعة لمورد/,
    cause: "تراكم أكثر من مؤشر غير اعتيادي لدى مورد واحد (حجم التعامل، التركّز، القرب من السقف، تكرار المبالغ) دون مراجعة دورية لأداء الموردين.",
    effect: "احتمال محاباة مورد أو تعامل غير تنافسي أو تلاعب في المبالغ، وارتفاع مخاطر الاعتماد على مورد واحد.",
    recommendation: "فحص ملف المورد وجميع أوامره، وتقييم التنافسية والأسعار مقارنة بالسوق، وتوسيع قاعدة الموردين.",
  },
  {
    match: /فرق كمية بين نظام المحروقات|صرف في النظام الداخلي غير مؤكد|كمية في المحطة بلا قيد|تعبئة في المحطة بلا أمر|تعبئة في تاريخ|تعبئة بلا أثر|تعبئة مقترنة|صرف محروقات خارج الدوام|تعبئة محروقات لا تطابق|قراءة عداد غير متسلسلة|معدل استهلاك شاذ/,
    cause: "غياب المطابقة الدورية بين نظام المحروقات الداخلي وكشوفات المحطة والبطاقات الذكية وأوامر الحركة ومسارات GPS، وضعف ضبط التعبئة خارج الدوام.",
    effect: "احتمال تعبئة وهمية أو استخدام المحروقات لأغراض غير رسمية وهدر مالي في بند المحروقات.",
    recommendation: "إجراء مطابقة شهرية ثلاثية (النظام الداخلي، كشف المحطة، GPS) وربط كل تعبئة بأمر حركة، وتقييد البطاقات الذكية بأوقات الدوام وطلب مسوغ للاستثناءات.",
  },
  {
    match: /سعر اللتر|قيمة الفاتورة|رقم فاتورة المحطة/,
    cause: "عدم مراجعة فواتير محطة الوقود مقابل الأسعار والشروط المنصوص عليها في العقد المبرم قبل اعتماد الدفع.",
    effect: "دفع مبالغ زائدة عن المستحق التعاقدي أو احتساب فاتورة بقيمة لا تطابق الكمية والسعر.",
    recommendation: "اعتماد مطابقة سعر اللتر والقيمة مع العقد قبل الدفع، ومطالبة المحطة باسترداد الفروقات، ومنع تكرار أرقام الفواتير.",
  },
  {
    match: /تضخم تكلفة صيانة|تكلفة قطع غيار|تكرار إصلاح/,
    cause: "ضعف الرقابة على أوامر الصيانة وعدم مقارنة تكلفة الإصلاح بعمر الآلية وحجم عملها وبمتوسطات الأسطول.",
    effect: "تضخم غير مبرر في تكلفة الصيانة وقطع الغيار أو تكرار إصلاح لنفس العطل دون ضمان.",
    recommendation: "اشتراط عروض أسعار وفحص فني مستقل للإصلاحات المرتفعة، ومتابعة تكلفة الصيانة لكل آلية، ومطالبة الورشة بضمان الإصلاحات المتكررة.",
  },
  {
    match: /رخصة آلية|بوليصة تأمين|تأمين غير ساري|برخصة منتهية/,
    cause: "غياب جدول متابعة آلي لتواريخ انتهاء الرخص وبوالص التأمين وتنبيه مسبق قبل الانتهاء.",
    effect: "غرامات ومخالفات مرورية وعدم تغطية تأمينية للآلية والسائق عند وقوع حادث.",
    recommendation: "إنشاء تنبيه مسبق قبل انتهاء الرخصة والتأمين بمدة كافية، وعدم السماح بتشغيل آلية منتهية الترخيص أو التأمين.",
  },
  {
    match: /تجاوز الحد المسموح/,
    cause: "ضعف الرقابة المسبقة على الالتزام بالسقوف والمخصصات المعتمدة وعدم تفعيل تنبيهات التجاوز.",
    effect: "صرف يتجاوز المخصصات المعتمدة ومخاطر مخالفة الموازنة وتحمل التزامات غير مغطاة.",
    recommendation: "تفعيل منع تلقائي أو تنبيه عند بلوغ السقف، وطلب مسوغ رسمي موثق لكل تجاوز.",
  },
  {
    match: /قيمة شاذة إحصائياً/,
    cause: "غياب المراجعة التحليلية للقيم غير المعتادة وضعف التحقق من الحالات الخارجة عن النمط.",
    effect: "احتمال وجود خطأ أو صرف غير معتاد دون مسوغ موثق.",
    recommendation: "مراجعة القيم الشاذة مع الجهة المعنية وتوثيق مبرراتها أو تصويبها.",
  },
  {
    match: /قيد مكرر/,
    cause: "عدم وجود فحص آلي يمنع تكرار القيد بنفس البيانات والتاريخ.",
    effect: "ازدواج في القيود وإمكانية احتساب المبلغ مرتين.",
    recommendation: "إلغاء القيد المكرر بقيد موثق وتفعيل منع التكرار عند الإدخال.",
  },
  {
    match: /تجزئة/,
    cause: "غياب ضبط آلي مسبق يرصد تكرار الشراء أو الصرف لنفس الجهة ضمن فترة قصيرة.",
    effect: "تجاوز سقوف الصلاحيات والهروب من الطرح التنافسي، وحرمان الجهة من أفضل الأسعار.",
    recommendation: "ربط سقف الشراء المباشر بإجمالي المورد خلال الفترة وإيقاف الأمر المتجاوز آلياً.",
  },
  {
    match: /فصل الصلاحيات|معتمد الصرف هو نفسه|الموافق على الشراء هو نفسه|أمين الصندوق هو من|معد التسوية هو نفسه|صرف دون معتمد/,
    cause: "عدم توزيع مهام الإدخال والاعتماد والتنفيذ على أشخاص مختلفين أو ضعف صلاحيات النظام المالي.",
    effect: "إمكانية الخطأ أو التلاعب دون كشفه، وفقدان الضبط الداخلي على الصرف.",
    recommendation: "تعديل مصفوفة الصلاحيات في النظام بحيث لا يجمع شخص واحد بين مهمتين متعارضتين.",
  },
  {
    match: /مؤشر احتيال|تطابق الرقم الوطني|رقم وطني مشترك|تطابق رقم هاتف|تطابق حساب بنكي|حساب بنكي مشترك|الموافق على الشراء هو نفسه المورد|موظف وهمي|اسم مكرر/,
    cause: "عدم مطابقة بيانات الموردين والموظفين مع بعضها قبل التعاقد أو الصرف.",
    effect: "تعرض الجهة لتضارب مصالح أو صرف غير مستحق، وقد يستدعي تحقيقاً مفصلاً.",
    recommendation: "فتح تحقق مستقل في الحالات المرصودة وتفعيل مطابقة دورية لبيانات الموردين والموظفين.",
  },
  {
    match: /مزدوج|ازدواج|مكرر|تداخل/,
    cause: "غياب فحص آلي للتكرار على رقم المستند أو المستفيد والفترة عند الإدخال.",
    effect: "صرف أو قبض مكرر يرتب مبالغ مستردة أو قيوداً غير صحيحة.",
    recommendation: "تفعيل منع التكرار على رقم المستند والمستفيد والفترة، ومراجعة الحالات وتسوية المكرر.",
  },
  {
    match: /إيداع|توريد النقدية|شيك|قبض|نقدية غير مودعة/,
    cause: "ضعف المتابعة اليومية لتوريد المقبوضات النقدية والشيكات وتسجيل إشعارات الإيداع.",
    effect: "مخاطر فقد أو سوء استخدام النقدية وتأخر إثبات الإيراد في الدفاتر.",
    recommendation: "إلزام الإيداع خلال المهلة المحددة وربط كل إيداع برقم إشعار بنكي ومطابقته يومياً.",
  },
  {
    match: /تسوية|فرق|عمولات|الرصيد الختامي|ميزان|بنك/,
    cause: "عدم إجراء التسويات والمطابقات الدورية أو إجراؤها دون مراجعة مستقلة.",
    effect: "أرصدة غير موثوقة في القوائم المالية وفروقات غير مفسرة قد تخفي أخطاء أو تلاعباً.",
    recommendation: "إعداد التسويات شهرياً بمراجعة مستقلة وتحليل الفروقات وتصويبها بقيود موثقة.",
  },
  {
    match: /عهدة|جرد|استعاضة|مستندات غير مسواة|سلف|صندوق/,
    cause: "ضعف الجرد المفاجئ والاستعاضة الدورية وعدم متابعة تسوية السلف والعهد.",
    effect: "مخاطر عجز أو زيادة في العهد وبقاء سلف مفتوحة دون تسوية.",
    recommendation: "جدولة جرد مفاجئ دوري، وتسوية السلف المتقادمة، وربط الاستعاضة بسقف العهدة المعتمد.",
  },
  {
    match: /إضافي|مكافأة|براءة ذمة|تقرير إنجاز/,
    cause: "عدم ربط الصرف بمستندات إثبات مسبقة (اعتماد الساعات، البصمة، تقرير الإنجاز).",
    effect: "صرف مبالغ دون استحقاق موثق وهدر في بند الرواتب والأجور.",
    recommendation: "اشتراط اعتماد مسبق وإثبات بصمة وتقرير إنجاز قبل أي صرف إضافي.",
  },
  {
    match: /راتب|درجة|ترقية|علاوة|تعيين|وظيف|متقاعد|إجازة|أجر|عامل|موظف|الرقم الوطني|الرقم الوظيفي|شواغر/,
    cause: "عدم مطابقة كشف الرواتب مع جدول التشكيلات وقرارات التعيين والترقية والإحالة.",
    effect: "صرف رواتب أو علاوات بخلاف الاستحقاق النظامي وفروقات مالية واجبة الاسترداد.",
    recommendation: "مطابقة الكشف مع قرارات التعيين والترقية والتشكيلات شهرياً وتصويب الفروقات.",
  },
  {
    match: /تاريخ|قيمة رقمية|حقل جوهري|لم يُدخل|غير مدخل|غير مسجل|ناقص|تسلسل/,
    cause: "ضعف ضوابط إدخال البيانات والتحقق من اكتمالها وصحتها في النظام.",
    effect: "عدم إمكانية الاعتماد على السجلات وصعوبة التتبع والمساءلة.",
    recommendation: "جعل الحقول الجوهرية إلزامية وإضافة تحقق آلي من التواريخ والقيم عند الإدخال.",
  },
];

/** The legal basis comes only from regulations and instructions the user uploaded; nothing is built in. */
export const NO_BASIS_TEXT = "لا يوجد سند مطابق في الأنظمة والتعليمات المرفوعة — ارفع النظام أو التعليمات ذات العلاقة ثم أعد التحليل.";
export const DEFAULT_CAUSE = "ضعف الضوابط الرقابية المسبقة على هذه العملية أو عدم تطبيقها بصورة منتظمة.";
export const DEFAULT_EFFECT = "مخاطر مالية وإدارية محتملة تستوجب المراجعة والتصويب.";
export const DEFAULT_REC = "مراجعة الحالات المرصودة مع الإدارة المعنية ومعالجة السبب الجذري.";

/** New observations with no matching rule: wording built from the test title and the table instead of one generic sentence. */
export function contextualCause(test: string, datasetLabel: string): string {
  return `عدم كفاية الضوابط الرقابية المسبقة والمطابقة الدورية على «${test}» في ${datasetLabel}، وعدم وجود إجراء يمنع تكرار هذه الحالة أو يكشفها فور حدوثها.`;
}
export function contextualEffect(test: string, count: number): string {
  return `استمرار ${count > 1 ? `${count} حالات` : "حالة"} من «${test}» دون معالجة، مع مخاطر مالية وإدارية محتملة وصعوبة في المساءلة وتتبع المسؤولية.`;
}

/** Cause / effect / recommendation wording for a test title (same rules the audit engine uses). */
export function ruleFor(test: string): { cause: string; effect: string; recommendation: string } {
  const r = RULES.find((x) => x.match.test(test));
  return {
    cause: r?.cause ?? DEFAULT_CAUSE,
    effect: r?.effect ?? DEFAULT_EFFECT,
    recommendation: r?.recommendation ?? DEFAULT_REC,
  };
}

const SEV_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const sevOf = (f: AuditFinding): Severity => f.finalSeverity ?? f.severity;

/** Impact from the worst finding, likelihood from how many records are affected; repetition adds one point. */
export function assessRisk(group: AuditFinding[], totalRecords = 0): RiskAssessment {
  const worst = group.reduce<number>((m, f) => Math.max(m, SEV_RANK[sevOf(f)]), 1);
  const impact = worst as 1 | 2 | 3;
  const share = totalRecords > 0 ? group.length / totalRecords : 0;
  const likelihood: 1 | 2 | 3 = group.length >= 5 || share >= 0.1 ? 3 : group.length >= 2 ? 2 : 1;
  const repeated = group.some((f) => f.repeat !== undefined);
  const score = impact * likelihood + (repeated ? 1 : 0);
  // the rating never drops below the worst finding's own severity; spread and repetition can only raise it
  const byScore: Severity = score >= 6 ? "high" : score >= 3 ? "medium" : "low";
  const floor: Severity = impact === 3 ? "high" : impact === 2 ? "medium" : "low";
  const rating: Severity = SEV_RANK[floor] >= SEV_RANK[byScore] ? floor : byScore;
  const labels = { 1: "منخفض", 2: "متوسط", 3: "مرتفع" } as const;
  return {
    impact,
    likelihood,
    score,
    rating,
    rationale: `الأثر ${labels[impact]}، والاحتمال ${labels[likelihood]} (${group.length} حالة)${repeated ? "، وملاحظة متكررة من تقارير سابقة" : ""}.`,
  };
}

function legalBasisOf(group: AuditFinding[]): LegalBasis {
  const reg = group.find((f) => f.regulation)?.regulation;
  if (reg && !isGarbled(`${reg.doc} ${reg.excerpt}`)) return { source: "library", text: `${reg.doc}: ${reg.excerpt}`, needsVerification: false };
  const fw = legalFrameworkOf(group[0] as never) as { text: string } | undefined;
  if (fw) return { source: "framework", text: fw.text, needsVerification: true };
  return { source: "default", text: NO_BASIS_TEXT, needsVerification: false };
}

function conditionOf(group: AuditFinding[], test: string, datasetLabel: string, refs: string[]): string {
  const details = [...new Set(group.map((f) => f.detail?.trim()).filter((d): d is string => !!d))].slice(0, 2);
  const parts = [`رُصدت ${group.length} حالة بعنوان «${test}» في ${datasetLabel}`];
  if (refs.length) parts.push(`أمثلة: ${refs.join("، ")}`);
  if (details.length) parts.push(`التفاصيل: ${details.join("؛ ")}`);
  return `${parts.join(" — ")}.`;
}

export interface DraftOptions {
  datasetLabel?: (key: string) => string;
  totalRecords?: number;
  approved?: ReadonlySet<string>;
}

/** Analysis output -> risk assessment -> structured observation (condition, cause, legal basis, effect). */
export function draftObservations(findings: AuditFinding[], opts: DraftOptions = {}): Observation[] {
  const label = opts.datasetLabel ?? ((k: string) => k);
  const groups = new Map<string, AuditFinding[]>();
  for (const f of findings) {
    const k = `${f.dataset}|${f.test.trim()}`;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  const out: Observation[] = [];
  groups.forEach((group, id) => {
    const first = group[0];
    if (!first) return;
    const rule = RULES.find((r) => r.match.test(first.test));
    const refs = [...new Set(group.map((f) => f.ref?.trim()).filter((r): r is string => !!r))].slice(0, 3);
    const condition = conditionOf(group, first.test, label(first.dataset), refs);
    const repeated = group.filter((f) => f.repeat !== undefined).length;
    out.push({
      id,
      dataset: first.dataset,
      sector: first.sector ?? "",
      test: first.test,
      count: group.length,
      refs,
      repeated,
      risk: assessRisk(group, opts.totalRecords ?? 0),
      condition,
      cause: rule?.cause ?? contextualCause(first.test, label(first.dataset)),
      legalBasis: legalBasisOf(group),
      effect: rule?.effect ?? contextualEffect(first.test, group.length),
      recommendation: rule?.recommendation ?? DEFAULT_REC,
      rootCause: analyzeRootCause({ test: first.test, condition, count: group.length, repeated }),
      status: opts.approved?.has(id) ? "approved" : "draft",
      isNew: group.every((f) => f.repeat === undefined),
    });
  });
  return out.sort((a, b) => b.risk.score - a.risk.score || b.count - a.count);
}

export const OBS_LABELS = {
  condition: "الحالة",
  cause: "السبب",
  legalBasis: "السند القانوني",
  effect: "الأثر",
  recommendation: "التوصية",
} as const;

/** Plain lines used by the PDF and the executive summary. */
export function observationLines(o: Observation, riskWord: Record<Severity, string>, n?: number): string[] {
  const basis = o.legalBasis.needsVerification ? `${o.legalBasis.text} (يُستكمل رقم المادة)` : o.legalBasis.text;
  return [
    `${n !== undefined ? `ملاحظة رقابية ${n}: ` : ""}${o.test} — مخاطر ${riskWord[o.risk.rating]}${o.repeated ? " (متكررة)" : ""}`,
    `${OBS_LABELS.condition}: ${o.condition}`,
    `${OBS_LABELS.legalBasis}: ${basis}`,
    `${OBS_LABELS.cause}: ${o.cause}`,
    `${OBS_LABELS.effect}: ${o.effect}`,
    `${OBS_LABELS.recommendation}: ${o.recommendation}`,
  ];
}

export interface Compliance {
  total: number;
  affected: number;
  pct: number | null;
}

/** The consolidated audit report draft shared between the audit tab and the Reports tab. */
export interface AuditDraft {
  date: string;
  observations: Observation[];
  compliance?: Compliance | undefined;
}

const DRAFT_KEY = "rasd-audit-current";

function readDraft(key: string): AuditDraft | undefined {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (v && typeof v === "object" && Array.isArray((v as AuditDraft).observations)) return v as AuditDraft;
  } catch {
    /* storage unavailable or corrupt */
  }
  return undefined;
}

function writeDraft(key: string, d: AuditDraft): void {
  try {
    localStorage.setItem(key, JSON.stringify(d));
  } catch {
    /* storage unavailable */
  }
}

export const loadDraft = (): AuditDraft | undefined => readDraft(DRAFT_KEY);
export const saveDraft = (d: AuditDraft): void => writeDraft(DRAFT_KEY, d);


const IDS_KEY = { deleted: "rasd-obs-deleted", approved: "rasd-obs-approved" } as const;

export function loadIds(kind: keyof typeof IDS_KEY): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(IDS_KEY[kind]) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveIds(kind: keyof typeof IDS_KEY, ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(IDS_KEY[kind], JSON.stringify([...ids]));
  } catch {
    /* storage unavailable */
  }
}

/** Wording the auditor changed on a drafted observation; keyed by observation id so it survives re-running the analysis. */
export interface ObsEdit {
  test?: string;
  condition?: string;
  legalBasis?: string;
  cause?: string;
  effect?: string;
  recommendation?: string;
  rating?: Severity;
  at?: string;
}
const EDITS_KEY = "rasd-obs-edits";

export function loadEdits(): Record<string, ObsEdit> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(EDITS_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, ObsEdit>) : {};
  } catch {
    return {};
  }
}

export function saveEdits(e: Record<string, ObsEdit>): void {
  try {
    localStorage.setItem(EDITS_KEY, JSON.stringify(e));
  } catch {
    /* storage unavailable */
  }
}

/** Keeps only the fields the auditor really changed (trimmed, non-empty); returns undefined when nothing differs from the draft. */
export function diffEdit(o: Observation, v: ObsEdit, now = new Date()): ObsEdit | undefined {
  const out: ObsEdit = {};
  const t = (x?: string) => (x ?? "").trim();
  if (t(v.test) && t(v.test) !== o.test) out.test = t(v.test);
  if (t(v.condition) && t(v.condition) !== o.condition) out.condition = t(v.condition);
  if (t(v.legalBasis) && t(v.legalBasis) !== o.legalBasis.text) out.legalBasis = t(v.legalBasis);
  if (t(v.cause) && t(v.cause) !== o.cause) out.cause = t(v.cause);
  if (t(v.effect) && t(v.effect) !== o.effect) out.effect = t(v.effect);
  if (t(v.recommendation) && t(v.recommendation) !== o.recommendation) out.recommendation = t(v.recommendation);
  if (v.rating && v.rating !== o.risk.rating) out.rating = v.rating;
  return Object.keys(out).length ? { ...out, at: now.toISOString() } : undefined;
}

export function applyEdit(o: Observation, e: ObsEdit | undefined): Observation {
  if (!e) return o;
  const risk = e.rating ? { ...o.risk, rating: e.rating, rationale: `${o.risk.rationale} (التصنيف عدّله المدقق)` } : o.risk;
  return {
    ...o,
    test: e.test ?? o.test,
    condition: e.condition ?? o.condition,
    cause: e.cause ?? o.cause,
    effect: e.effect ?? o.effect,
    recommendation: e.recommendation ?? o.recommendation,
    // a basis typed by the auditor is his own responsibility: it is labelled as such, never as a library basis
    legalBasis: e.legalBasis ? { source: "auditor", text: e.legalBasis, needsVerification: false } : o.legalBasis,
    risk,
    edited: true,
  };
}

export function applyEdits(list: Observation[], edits: Record<string, ObsEdit>): Observation[] {
  return list.map((o) => applyEdit(o, edits[o.id]));
}

/**
 * What reaches the report files (PDF / Word): a new observation (not in any previous report) only after the auditor approved it;
 * observations already present in previous reports and the ones the auditor wrote himself keep flowing as before.
 */
export const reportable = (list: Observation[]): Observation[] => list.filter((o) => !o.isNew || o.status === "approved");

export function clearDrafts(): void {
  try {
    [DRAFT_KEY, IDS_KEY.deleted, IDS_KEY.approved, EDITS_KEY].forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}

/** One consolidated list: audit-tab observations, with the user's delete and approve choices applied. */
export function mergeObservations(
  lists: Observation[][],
  deleted: ReadonlySet<string>,
  approved: ReadonlySet<string>,
  edits: Record<string, ObsEdit> = {},
): Observation[] {
  const seen = new Set<string>();
  const out: Observation[] = [];
  for (const o of lists.flat()) {
    if (seen.has(o.id) || deleted.has(o.id)) continue;
    seen.add(o.id);
    out.push(applyEdit({ ...o, status: approved.has(o.id) ? "approved" : "draft" }, edits[o.id]));
  }
  return out.sort((a, b) => b.risk.score - a.risk.score || b.count - a.count);
}

export function currentObservations(): Observation[] {
  return mergeObservations(
    [loadDraft()?.observations ?? []],
    loadIds("deleted"),
    loadIds("approved"),
    loadEdits(),
  );
}

export interface ReportSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  approved: number;
  repeated: number;
  datasets: number;
  /** new observations (not in previous reports) still waiting for the auditor's decision */
  pendingNew: number;
}

export function summarize(list: Observation[]): ReportSummary {
  const n = (s: Severity) => list.filter((o) => o.risk.rating === s).length;
  return {
    total: list.length,
    high: n("high"),
    medium: n("medium"),
    low: n("low"),
    approved: list.filter((o) => o.status === "approved").length,
    repeated: list.filter((o) => o.repeated > 0).length,
    datasets: new Set(list.map((o) => o.dataset)).size,
    pendingNew: list.filter((o) => o.isNew && o.status !== "approved").length,
  };
}

export function summaryText(s: ReportSummary): string {
  if (!s.total) return "لا توجد ملاحظات رقابية في هذا التقرير.";
  return `أسفر الفحص عن ${s.total} ملاحظة رقابية في ${s.datasets} جدول: ${s.high} مرتفعة المخاطر و${s.medium} متوسطة و${s.low} منخفضة${s.repeated ? `، منها ${s.repeated} متكررة من تقارير سابقة` : ""}. المعتمد منها ${s.approved} والباقي مسودات قيد المراجعة.`;
}
