// @ts-nocheck
/**
 * الإطار التشريعي المرفق تلقائياً بكل مخالفة.
 *
 * ملاحظات مهمة:
 *  - الأسماء الواردة هي أسماء الصكوك (قانون/نظام/تعليمات) دون أرقام مواد؛ رقم المادة يُستكمل من النسخة المعتمدة
 *    لدى البلدية، لذلك يبقى needsVerification = true في كل سند مدمج.
 *  - إن رُفع نظام أو تعليمات في «مكتبة الأنظمة» وطابقت المخالفة، فسندها المرفوع (library) له الأولوية على هذا الإطار.
 *  - النسخ الرسمية تتغير بالتعديل؛ عدّل القائمة أدناه (أو أضف صكاً) بما يوافق التشريع النافذ لدى بلديتك.
 */
export const INSTRUMENTS = {
  procurement: "نظام المشتريات الحكومية رقم (8) لسنة 2022 وتعليمات تنظيم إجراءات المشتريات الحكومية لسنة 2022",
  municipalLaw: "قانون البلديات رقم (41) لسنة 2015 وتعديلاته",
  municipalFinance: "النظام المالي للبلديات رقم (142) لسنة 2016 وتعديلاته",
  municipalStaff: "نظام موظفي البلديات المعمول به وتعليمات التعيين الصادرة بموجبه",
  civilService: "نظام الخدمة المدنية المعمول به (فيما لم يرد فيه نص خاص)",
  integrity: "قانون النزاهة ومكافحة الفساد رقم (13) لسنة 2016 وتعديلاته",
  publicFunds: "قانون تحصيل الأموال العامة رقم (6) لسنة 1952 وتعديلاته",
  audit: "قانون ديوان المحاسبة رقم (28) لسنة 1952 وتعديلاته",
  vehicles: "التعليمات الناظمة لاستخدام مركبات الجهات العامة وصرف المحروقات المعمول بها لدى البلدية",
  worksContracts: "وثائق العقد والشروط العامة لعقود الأشغال والمقاولات المعتمدة",
  stores: "التعليمات الناظمة للمستودعات واللوازم والجرد والشطب في البلديات",
};

/**
 * قواعد مرتبة؛ أول قاعدة تطابق تُعتمد.
 * match: على نص الاختبار، datasets: قائمة أو بادئة جداول، instruments: مفاتيح INSTRUMENTS بالترتيب.
 */
const RULES = [
  { id: "conflict", match: /تضارب مصالح|تعارض مصالح|مؤشر احتيال|تطابق .* بين مورد وموظف|الموافق على الشراء هو نفسه المورد|عضو لجنة/, instruments: ["integrity", "procurement", "municipalFinance"], note: "تضارب المصالح وحماية المال العام" },
  { id: "sod", match: /فصل الصلاحيات|معتمد الصرف هو نفسه|أمين المستودع هو نفسه/, instruments: ["municipalFinance", "integrity"], note: "مبدأ فصل المهام والرقابة الداخلية" },
  { id: "splitting", match: /تجزئة|سقف|تركّز المشتريات|تآكل/, instruments: ["procurement", "municipalFinance"], note: "حدود الشراء المباشر والطرح التنافسي" },
  { id: "tender", datasets: ["Tenders_Records"], match: /./, instruments: ["procurement", "municipalLaw"], note: "إجراءات العطاءات وإحالتها" },
  { id: "direct-purchase", datasets: ["Direct_Purchases_Orders"], match: /./, instruments: ["procurement", "municipalFinance"], note: "الشراء المباشر وصلاحيات الموافقة" },
  { id: "engineering", datasets: "Engineering_", match: /./, instruments: ["worksContracts", "procurement", "municipalFinance"], note: "تنفيذ عقود الأشغال والمستخلصات والغرامات" },
  { id: "fleet", datasets: "Fleet_", match: /./, instruments: ["vehicles", "municipalFinance"], note: "استخدام الآليات وصرف المحروقات والصيانة" },
  { id: "hr-wagers", datasets: ["HR_Daily_Wagers"], match: /./, instruments: ["municipalStaff", "municipalFinance"], note: "استخدام عمال المياومة وصرف أجورهم" },
  { id: "hr", datasets: "HR_", match: /./, instruments: ["municipalStaff", "civilService", "municipalFinance"], note: "التعيين والرواتب والعلاوات والعمل الإضافي" },
  { id: "aging", match: /تقادم ذمة|ذمة متأخرة|قسط إيجار متأخر|عقد منتهٍ بذمة|مستحقة غير محصلة/, instruments: ["publicFunds", "municipalLaw", "municipalFinance"], note: "تحصيل الإيرادات والذمم والحجز التحفظي" },
  { id: "revenue", datasets: "Revenue_", match: /./, instruments: ["municipalLaw", "municipalFinance", "publicFunds"], note: "الإيرادات والرسوم والعوائد" },
  { id: "advances", datasets: "Advances_", match: /./, instruments: ["municipalFinance"], note: "السلف المؤقتة والمستديمة وتسويتها" },
  { id: "stores", datasets: ["Warehouse_Master_List", "Warehouses_"], match: /./, instruments: ["stores", "municipalFinance"], note: "عهد المستودعات والجرد والشطب" },
  { id: "cash", datasets: ["Receipt_Vouchers", "Payment_Vouchers", "Bank_Reconciliations", "Petty_Cash", "Clearing_Accounts", "Adjustments", "Trial_Balance"], match: /./, instruments: ["municipalFinance", "audit"], note: "النقدية والقيود والتسويات" },
];

const inDatasets = (spec, key) =>
  !spec || (Array.isArray(spec) ? spec.some((s) => key === s || (s.endsWith("_") && key.startsWith(s))) : key.startsWith(spec));

const matchesRule = (rule, test, dataset) => inDatasets(rule.datasets, dataset) && rule.match.test(test);

/**
 * السند القانوني المدمج لمخالفة.
 * يُرجع { ruleId, instruments, note, article, text, needsVerification } أو undefined.
 */
export function legalFrameworkOf(finding) {
  const test = String(finding?.test ?? "");
  const dataset = String(finding?.dataset ?? "");
  // القواعد العامة (بلا جداول) تُفحص أولاً بالاختبار، ثم القواعد الخاصة بالجدول
  const rule = RULES.find((r) => matchesRule(r, test, dataset));
  if (!rule) return undefined;
  const instruments = rule.instruments.map((k) => INSTRUMENTS[k]);
  return {
    ruleId: rule.id,
    instruments,
    note: rule.note,
    article: "المادة (…) — تُستكمل من النسخة المعتمدة",
    text: `${instruments.join(" ؛ ")} — ${rule.note}`,
    needsVerification: true,
  };
}

/** نص موجز للسند يوضع أمام المخالفة (جدول/تصدير). المكتبة المرفوعة أولاً ثم الإطار المدمج. */
export function legalTextOf(finding) {
  if (finding?.regulation) return `${finding.regulation.doc}: ${finding.regulation.excerpt}`;
  const fw = finding?.legal ?? legalFrameworkOf(finding);
  return fw ? fw.text : "";
}
