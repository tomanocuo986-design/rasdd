// @ts-nocheck
/* eslint-disable */
// محرك التدقيق (JS): تعريفات الأنشطة `auditSectors` والجداول `allDatasets` والمعاملات `defaultParams` ودالة `runAudit` وكل اختباراتها.
// استُخرج حرفياً من workspace.jsx (بلا أي تغيير في المنطق) ليُختبر ويُراجَع بمعزل عن واجهة React.
// workspace.jsx ما زال يُصدّر هذه الأسماء نفسها فلا تتغير أي استيرادات قائمة. يقابله محرك Python في python/audit_engine.py (انظر docs/ENGINE.ar.md).
import { sodFindings, fraudFindings } from "./advanced";
import { advancedFindings } from "./advanced-queries";
import { statisticalFindings } from "./statistical-tests.js";
import { multivariateFindings } from "./multivariate-anomaly.js";
import { parseDateMs } from "./dates";

var f = (key, label, type = "text") => ({
  key,
  label,
  type,
});
var auditSectors = [
  {
    key: "finance",
    label: "الأنشطة والعمليات المالية والمحاسبية",
    en: "Financial & Accounting Activities & Operations",
    goal: "إحكام الرقابة على النقدية، الحسابات، والتسويات المصرفية.",
    datasets: [
      {
        key: "Receipt_Vouchers",
        label: "سندات القبض",
        fields: [
          f("voucher_no", "رقم سند القبض"),
          f("date", "تاريخ القبض", "date"),
          f("amount", "المبلغ المقبوض", "number"),
          f("payer", "المقبوض منه"),
          f("revenue_type", "نوع الإيراد / الغرض"),
          f("credit_account", "الحساب الدائن"),
          f("method", "طريقة القبض (نقدي / شيك / تحويل)"),
          f("cheque_no", "رقم الشيك"),
          f("cheque_status", "حالة الشيك (معلق / محصل / مرتجع / بدون رصيد)"),
          f("deposit_date", "تاريخ الإيداع البنكي", "date"),
          f("deposited_amount", "المبلغ المودع", "number"),
          f("deposit_ref", "رقم إشعار الإيداع"),
          f("status", "حالة السند (معتمد / ملغى)"),
          f("cancel_reason", "سبب الإلغاء"),
        ],
      },
      {
        key: "Payment_Vouchers",
        label: "سندات الصرف",
        fields: [
          f("voucher_no", "رقم سند الصرف"),
          f("date", "التاريخ", "date"),
          f("amount", "المبلغ", "number"),
          f("payee", "الحساب المدفوع له"),
          f("budget_item", "بند الموازنة المقابل"),
          f("method", "طريقة الصرف"),
          f("support_doc", "رقم المستند المعزز"),
          f("approver", "معتمد الصرف"),
          f("status", "حالة السند (معتمد / ملغى)"),
          f("cancel_reason", "سبب الإلغاء"),
          f("entered_by", "مُدخل السند"),
          f("paid_by", "منفّذ الصرف"),
        ],
      },
      {
        key: "Trial_Balance",
        label: "ميزان المراجعة",
        fields: [
          f("account_no", "رقم الحساب"),
          f("account_name", "اسم الحساب"),
          f("opening", "رصيد أول المدة", "number"),
          f("debit", "حركات المدين", "number"),
          f("credit", "حركات الدائن", "number"),
          f("closing", "الرصيد الختامي", "number"),
          f("nature", "طبيعة الرصيد"),
        ],
      },
      {
        key: "Adjustments",
        label: "قيود التسوية",
        fields: [
          f("entry_no", "رقم قيد التسوية"),
          f("date", "التاريخ", "date"),
          f("debit_account", "الحساب المدين"),
          f("credit_account", "الحساب الدائن"),
          f("amount", "قيمة التعديل", "number"),
          f("reason", "سبب التسوية"),
          f("requester", "الجهة الطالبة"),
        ],
      },
      {
        key: "Bank_Reconciliations",
        label: "التسويات البنكية",
        fields: [
          f("bank_account", "اسم البنك ورقم الحساب"),
          f("statement_date", "تاريخ الكشف", "date"),
          f("bank_balance", "الرصيد حسب البنك", "number"),
          f("book_balance", "الرصيد حسب الدفاتر", "number"),
          f("outstanding_checks", "الشيكات المعلقة", "number"),
          f("oldest_check_date", "تاريخ أقدم شيك معلق", "date"),
          f("deposits_in_transit", "الإيداعات بالطريق", "number"),
          f("bank_charges", "عمولات ومصاريف بنكية غير مسجلة", "number"),
          f("unrecorded_credits", "إيداعات بنكية غير مسجلة بالدفاتر", "number"),
          f("difference", "فروقات التسوية", "number"),
          f("prepared_by", "معد التسوية"),
          f("reviewed_by", "مراجع التسوية"),
        ],
      },
      {
        key: "Petty_Cash",
        label: "الصناديق والعهد النقدية",
        fields: [
          f("box", "رقم الصندوق / أمين الصندوق"),
          f("approved", "قيمة العهدة المعتمدة", "number"),
          f("actual", "الرصيد الفعلي بالصندوق", "number"),
          f("unsettled_docs", "المستندات غير المسواة", "number"),
          f("last_replenish", "تاريخ آخر استعاضة", "date"),
          f("last_count", "تاريخ آخر جرد مفاجئ", "date"),
          f("counted_by", "القائم بالجرد"),
        ],
      },
      {
        key: "Clearing_Accounts",
        label: "الحسابات الوسيطة",
        fields: [
          f("account_no", "رقم الحساب الوسيط"),
          f("account_name", "اسم الحساب"),
          f("date", "تاريخ الحركة", "date"),
          f("amount", "المبلغ", "number"),
          f("reason", "سبب التعليق"),
          f("target_close", "تاريخ الإغلاق المستهدف", "date"),
        ],
      },
      {
        key: "Revenue_Profession_Licenses",
        label: "رخص المهن والصناعات",
        fields: [
          f("license_no", "رقم الرخصة"),
          f("date", "تاريخ الإصدار", "date"),
          f("owner", "اسم صاحب المنشأة"),
          f("profession", "المهنة / الصناعة"),
          f("fee_due", "الرسوم المستحقة", "number"),
          f("fee_paid", "الرسوم المحصلة", "number"),
          f("receipt_no", "رقم سند القبض"),
          f("bank_deposit", "المبلغ الواصل للحساب البنكي", "number"),
          f("status", "حالة الرخصة"),
        ],
      },
      {
        key: "Revenue_Property_Taxes_Regulation",
        label: "عوائد التنظيم والتعبيد والمسقفات",
        fields: [
          f("parcel_no", "رقم القطعة / المكلف"),
          f("owner", "اسم المكلف"),
          f("tax_type", "نوع العائد (تنظيم / تعبيد / مسقفات / أبراضي)"),
          f("year", "السنة المالية"),
          f("amount_due", "المبلغ المستحق", "number"),
          f("amount_paid", "المبلغ المحصل", "number"),
          f("receipt_no", "رقم سند القبض"),
          f("bank_deposit", "المبلغ الواصل للحساب البنكي", "number"),
          f("last_payment", "تاريخ آخر تحصيل", "date"),
        ],
      },
      {
        key: "Revenue_Municipal_Properties_Leases",
        label: "عقود تأجير الأملاك البلدية",
        fields: [
          f("contract_no", "رقم العقد"),
          f("property", "العقار (محل / مخزن / كشك / سوق)"),
          f("tenant", "المستأجر"),
          f("start_date", "تاريخ بدء العقد", "date"),
          f("end_date", "تاريخ انتهاء العقد", "date"),
          f("installment", "قيمة القسط", "number"),
          f("due_date", "تاريخ استحقاق القسط", "date"),
          f("paid_date", "تاريخ السداد الفعلي", "date"),
          f("paid_amount", "المبلغ المسدد", "number"),
          f("receipt_no", "رقم سند القبض"),
        ],
      },
      {
        key: "Revenue_Daily_Fees",
        label: "رسوم الخدمات اليومية",
        fields: [
          f("date", "التاريخ", "date"),
          f("service", "الخدمة (مسلخ / سوق مركزي / أذونات حفر / مواقف)"),
          f("receipt_book", "رقم الوصل / الدفتر"),
          f("amount_due", "المبلغ المستحق", "number"),
          f("amount_collected", "المبلغ المحصل", "number"),
          f("collector", "المحصّل"),
          f("deposit_date", "تاريخ التوريد", "date"),
          f("deposited_amount", "المبلغ المورد", "number"),
        ],
      },
    ],
  },
  {
    key: "hr",
    label: "أنشطة وعمليات الموارد البشرية والرواتب",
    en: "HR & Payroll Activities & Operations",
    goal: "التحقق من قانونية التعيينات، الرواتب، الإجازات، ومكافآت نهاية الخدمة.",
    datasets: [
      {
        key: "HR_Establishment_Table",
        label: "جدول التشكيلات المعتمد",
        fields: [
          f("position_no", "رقم الوظيفة"),
          f("title", "المسمى الوظيفي المعتمد"),
          f("grade", "الدرجة المقررة"),
          f("department", "القسم / المديرية"),
          f("annual_allocation", "المخصص المالي السنوي", "number"),
          f("notes", "ملاحظات"),
        ],
      },
      {
        key: "HR_Payroll_Sheets",
        label: "كشوفات الرواتب",
        fields: [
          f("employee_no", "الرقم الوظيفي"),
          f("name", "اسم الموظف"),
          f("national_id", "الرقم الوطني"),
          f("position_no", "رقم الوظيفة"),
          f("title", "المسمى الوظيفي الفعلي"),
          f("grade", "الدرجة الممنوحة"),
          f("hire_date", "تاريخ التعيين", "date"),
          f("appointment_decision", "رقم قرار التعيين"),
          f("status", "حالة الموظف (على رأس العمل / منقطع / موقوف ...)"),
          f("attendance_days", "أيام الحضور الفعلية", "number"),
          f("bank_account", "رقم الحساب البنكي / IBAN"),
          f("basic", "الراتب الأساسي", "number"),
          f("allowances", "إجمالي العلاوات", "number"),
          f("net", "الصافي", "number"),
          f("phone", "رقم الهاتف"),
          f("address", "العنوان"),
        ],
      },
      {
        key: "HR_Overtime_Bonuses",
        label: "العمل الإضافي والمكافآت",
        fields: [
          f("employee_no", "رقم الموظف"),
          f("name", "اسم الموظف"),
          f("department", "القسم"),
          f("project", "المشروع"),
          f("period", "الفترة (شهر/سنة)"),
          f("hours", "ساعات العمل الإضافي", "number"),
          f("approved_hours", "الساعات المعتمدة مسبقاً", "number"),
          f("biometric_hours", "ساعات الإضافي المثبتة بالبصمة", "number"),
          f("overtime_pay", "قيمة الإضافي المصروفة", "number"),
          f("report", "تقرير الإنجاز"),
          f("bonus", "قيمة المكافأة المصروفة", "number"),
        ],
      },
      {
        key: "HR_Leaves_Records",
        label: "سجلات الإجازات",
        fields: [
          f("employee_no", "رقم الموظف"),
          f("name", "اسم الموظف"),
          f("type", "نوع الإجازة"),
          f("start", "تاريخ البداية", "date"),
          f("end", "تاريخ النهاية", "date"),
          f("balance", "رصيد الإجازات المتبقي", "number"),
        ],
      },
      {
        key: "HR_Daily_Wagers",
        label: "عمال المياومة والعقود المؤقتة",
        fields: [
          f("id_no", "الرقم التعريفي"),
          f("name", "اسم العامل"),
          f("project", "المشروع / القسم"),
          f("period", "الفترة (شهر/سنة)"),
          f("days", "أيام العمل الفعلية", "number"),
          f("daily_wage", "الأجر اليومي", "number"),
          f("total", "إجمالي المستحق", "number"),
          f("completion_report", "تقرير الإنجاز / شهادة الإنجاز"),
          f("phone", "رقم الهاتف"),
          f("address", "العنوان"),
          f("bank_account", "رقم الحساب البنكي / IBAN"),
        ],
      },
      {
        key: "HR_Promotions_Increments",
        label: "الترقيات والعلاوات",
        fields: [
          f("employee_no", "رقم الموظف"),
          f("name", "اسم الموظف"),
          f("old_grade", "الدرجة السابقة"),
          f("new_grade", "الدرجة الجديدة"),
          f("due_date", "تاريخ الاستحقاق", "date"),
          f("decision_no", "رقم قرار الترقية"),
          f("increment_amount", "قيمة العلاوة", "number"),
        ],
      },
      {
        key: "HR_Retirees_Settlements",
        label: "المتقاعدون والتسويات",
        fields: [
          f("retiree_no", "رقم الموظف / التقاعدي"),
          f("name", "اسم المتقاعد"),
          f("retire_date", "تاريخ الإحالة للتقاعد", "date"),
          f("reason", "سبب التقاعد"),
          f("gratuity", "مكافأة نهاية الخدمة / بدل الإجازات", "number"),
          f("clearance_no", "رقم براءة الذمة"),
        ],
      },
    ],
  },
  {
    key: "fleet",
    label: "أنشطة وعمليات الحركة والمحروقات والصيانة",
    en: "Fleet, Fuel & Maintenance Activities & Operations",
    goal: "مراقبة الآليات، رصد استهلاك الوقود عبر الأنظمة الذكية، والتتبع القانوني.",
    datasets: [
      {
        key: "Fleet_Movement_Orders",
        label: "أوامر الحركة",
        fields: [
          f("order_no", "رقم أمر الحركة"),
          f("date", "تاريخ الخروج", "date"),
          f("driver", "اسم السائق"),
          f("vehicle", "رقم الآلية"),
          f("route", "خط سير الرحلة"),
          f("purpose", "الغرض الرسمي"),
        ],
      },
      {
        key: "Fleet_GPS_Tracking_Logs",
        label: "نظام التتبع الذكي",
        fields: [
          f("vehicle", "رقم الآلية"),
          f("datetime", "تاريخ ووقت الحركة"),
          f("actual_route", "مسار الرحلة الفعلي (GPS)"),
          f("off_hours", "تشغيل خارج الدوام / العطل"),
          f("geofence", "تجاوز النطاق الجغرافي"),
        ],
      },
      {
        key: "Fleet_Fuel_System_Logs",
        label: "نظام المحروقات الآلي",
        fields: [
          f("vehicle", "رقم الآلية"),
          f("liters", "كمية المحروقات (نظام المحروقات)", "number"),
          f("odometer", "قراءة العداد عند التعبئة", "number"),
          f("rate", "معدل الاستهلاك المحسوب", "number"),
          f("order_match", "مطابقة أمر الحركة"),
        ],
      },
      {
        key: "Fleet_Station_Fuel_Statements",
        label: "كشوفات البطاقة الذكية",
        fields: [
          f("vehicle", "رقم الآلية"),
          f("card_no", "رقم البطاقة الذكية"),
          f("datetime", "تاريخ ووقت التعبئة"),
          f("liters", "الكمية المؤكدة (كشف المحطة)", "number"),
          f("unit_price", "سعر اللتر (فاتورة المحطة)", "number"),
          f("amount", "القيمة المالية للفاتورة", "number"),
          f("contract_price", "سعر اللتر حسب العقد", "number"),
          f("invoice_no", "رقم الفاتورة"),
        ],
      },
      {
        key: "Fleet_Maintenance",
        label: "الصيانة وقطع الغيار",
        fields: [
          f("vehicle", "رقم الآلية"),
          f("date", "تاريخ الصيانة", "date"),
          f("description", "وصف الإصلاح"),
          f("parts_cost", "تكلفة قطع الغيار", "number"),
          f("workshop", "ورشة الإصلاح"),
          f("invoice_no", "رقم الفاتورة"),
        ],
      },
      {
        key: "Fleet_Licensing_Insurance",
        label: "الترخيص والتأمين",
        fields: [
          f("plate", "رقم الآلية / اللوحة"),
          f("model", "نوع الآلية والموديل"),
          f("prev_expiry", "تاريخ انتهاء الرخصة السابقة", "date"),
          f("new_license", "تاريخ الترخيص الجديد ورقم الإيصال"),
          f("fees", "تكلفة الرسوم والتأمين", "number"),
          f("insurance_status", "حالة التأمين"),
          f("insurance_expiry", "تاريخ انتهاء بوليصة التأمين", "date"),
        ],
      },
    ],
  },
  {
    key: "warehouses",
    label: "أنشطة وعمليات المستودعات والعهد",
    en: "Warehouses & Inventory Activities & Operations",
    goal: "إدارة المخزون، ضبط السندات، مراقبة الجرد الفعلي، ومعالجة المواد الراكدة.",
    datasets: [
      {
        key: "Warehouse_Master_List",
        label: "كشف محتويات المستودع الشامل",
        fields: [
          f("item_no", "رقم الصنف"),
          f("description", "وصف الصنف التفصيلي"),
          f("category", "تصنيف الصنف"),
          f("unit", "وحدة القياس"),
          f("reorder", "حد التطلب (الحد الأدنى)", "number"),
          f("cost", "التكلفة التقديرية", "number"),
          f("location", "موقع التخزين"),
          f("notes", "ملاحظات"),
        ],
      },
      {
        key: "Warehouses_Inbound_Vouchers",
        label: "سندات الإدخال",
        fields: [
          f("voucher_no", "رقم سند الإدخال"),
          f("date", "التاريخ", "date"),
          f("supplier", "اسم المورد"),
          f("po_no", "رقم أمر الشراء"),
          f("item_no", "رقم الصنف"),
          f("qty", "الكمية الواردة", "number"),
          f("total", "القيمة الإجمالية", "number"),
          f("received_by", "أمين المستودع المستلم"),
        ],
      },
      {
        key: "Warehouses_Outbound_Vouchers",
        label: "سندات الإخراج",
        fields: [
          f("voucher_no", "رقم سند الإخراج"),
          f("date", "التاريخ", "date"),
          f("department", "القسم المستفيد"),
          f("receiver", "اسم المستلم"),
          f("item_no", "رقم الصنف"),
          f("qty", "الكمية المصروفة", "number"),
          f("purpose", "الغرض"),
        ],
      },
      {
        key: "Warehouses_Physical_Stocktaking",
        label: "نتائج الجرد الفعلي",
        fields: [
          f("item_no", "رقم الصنف"),
          f("name", "اسم المادة"),
          f("unit", "وحدة القياس"),
          f("book", "الرصيد الدفتري", "number"),
          f("physical", "الرصيد الفعلي (الجرد)", "number"),
          f("variance_value", "قيمة الفروقات (عجز/زيادة)", "number"),
          f("reasons", "أسباب الفروقات"),
        ],
      },
      {
        key: "Warehouses_Obsolete",
        label: "المواد الراكدة والتالفة",
        fields: [
          f("item_no", "رقم الصنف"),
          f("name", "اسم المادة"),
          f("in_date", "تاريخ الإدخال", "date"),
          f("qty", "الكمية الراكدة/التالفة", "number"),
          f("book_value", "القيمة الدفترية", "number"),
          f("reasons", "أسباب الركود والتلف"),
          f("writeoff", "قرار الشطب"),
        ],
      },
    ],
  },
  {
    key: "advances",
    label: "أنشطة وعمليات السلف المالية",
    en: "Financial Advances Activities & Operations",
    goal: "متابعة الذمم، السلف المؤقتة والمستديمة، وضمان تسويتها القانونية.",
    datasets: [
      {
        key: "Advances_Temporary",
        label: "السلف المؤقتة",
        fields: [
          f("advance_no", "رقم السلفة / السند"),
          f("employee", "اسم الموظف المستفيد"),
          f("department", "القسم"),
          f("purpose", "الغرض من السلفة"),
          f("amount", "المبلغ المصروف", "number"),
          f("paid_date", "تاريخ الصرف", "date"),
          f("due_date", "تاريخ الاستحقاق القانوني", "date"),
        ],
      },
      {
        key: "Advances_Settlements",
        label: "تسويات السلف",
        fields: [
          f("advance_no", "رقم السلفة الأصلية"),
          f("date", "تاريخ تقديم التسوية", "date"),
          f("invoices", "قيمة الفواتير والمستندات", "number"),
          f("refund", "قيمة الفائض المرتجع", "number"),
          f("receipt_no", "رقم سند القبض للفائض"),
          f("remaining", "رصيد السلفة المتبقي", "number"),
        ],
      },
      {
        key: "Advances_Permanent_Petty",
        label: "السلف المستديمة",
        fields: [
          f("advance_no", "رقم السلفة المستديمة"),
          f("custodian", "أمين الصندوق المسؤول"),
          f("approved", "القيمة المعتمدة", "number"),
          f("spent", "إجمالي المصروف خلال الشهر", "number"),
          f("cash", "رصيد النقدية", "number"),
          f("replenish_date", "تاريخ طلب الاستعاضة", "date"),
        ],
      },
      {
        key: "Advances_Overdue_Outstanding",
        label: "الذمم المتأخرة",
        fields: [
          f("advance_no", "رقم السلفة"),
          f("beneficiary", "اسم المستفيد"),
          f("amount", "المبلغ المتأخر", "number"),
          f("days", "عدد أيام التأخير", "number"),
          f("actions", "الإجراءات القانونية والإدارية المتخذة"),
        ],
      },
    ],
  },
  {
    key: "procurement",
    label: "أنشطة وعمليات المشتريات وأوامر الشراء",
    en: "Procurement & Purchase Orders Activities & Operations",
    goal: "ضبط أوامر الشراء والمشتريات المباشرة وصلاحيات الموافقة عليها.",
    datasets: [
      {
        key: "Direct_Purchases_Orders",
        label: "أوامر الشراء والمشتريات المباشرة",
        fields: [
          f("po_no", "رقم أمر الشراء"),
          f("date", "التاريخ", "date"),
          f("supplier", "اسم المورد"),
          f("nature", "طبيعة المشتريات / المواد"),
          f("value", "القيمة", "number"),
          f("method", "طريقة الشراء"),
          f("approver", "صاحب الصلاحية الموافق"),
          f("entered_by", "مُدخل أمر الشراء"),
          f("received_by", "مستلم المواد"),
          f("supplier_phone", "هاتف المورد"),
          f("supplier_address", "عنوان المورد"),
          f("supplier_bank", "الحساب البنكي للمورد"),
          f("supplier_national_id", "الرقم الوطني للمورد (إن كان فرداً)"),
        ],
      },
    ],
  },
  {
    key: "tenders",
    label: "أنشطة وعمليات العطاءات",
    en: "Tenders Activities & Operations",
    goal: "متابعة سجلات العطاءات والمشتريات الكبرى وسلامة إجراءات الطرح والإحالة.",
    datasets: [
      {
        key: "Tenders_Records",
        label: "سجلات العطاءات والمشتريات الكبرى",
        fields: [
          f("tender_no", "رقم العطاء"),
          f("date", "تاريخ الطرح", "date"),
          f("subject", "موضوع العطاء"),
          f("estimated_value", "القيمة التقديرية", "number"),
          f("awarded_value", "قيمة الإحالة", "number"),
          f("winner", "الجهة المحال عليها"),
          f("bidders", "عدد المتقدمين", "number"),
          f("committee", "لجنة العطاءات"),
          f("status", "الحالة"),
          f("winner_phone", "هاتف الجهة المحال عليها"),
          f("winner_address", "عنوان الجهة المحال عليها"),
          f("winner_bank", "الحساب البنكي للجهة المحال عليها"),
          f("winner_national_id", "الرقم الوطني للجهة المحال عليها (إن كانت فرداً)"),
        ],
      },
      {
        key: "Engineering_BoQ_Master",
        label: "جداول الكميات والأسعار (BoQ)",
        fields: [
          f("project_no", "رقم المشروع"),
          f("project_name", "اسم المشروع"),
          f("item_no", "رقم البند"),
          f("description", "وصف البند"),
          f("unit", "الوحدة"),
          f("quantity", "الكمية الأصلية", "number"),
          f("unit_price", "سعر الوحدة", "number"),
          f("total", "إجمالي البند", "number"),
          f("contract_value", "قيمة العقد", "number"),
        ],
      },
      {
        key: "Engineering_Site_Handover_Minutes",
        label: "محاضر تسليم الموقع",
        fields: [
          f("project_no", "رقم المشروع"),
          f("contractor", "المقاول"),
          f("handover_date", "تاريخ تسليم الموقع", "date"),
          f("commencement_date", "تاريخ المباشرة العقدية", "date"),
          f("contract_days", "مدة العقد (يوم)", "number"),
          f("minutes_no", "رقم المحضر"),
          f("signed_by", "الموقعون على المحضر"),
        ],
      },
      {
        key: "Engineering_Progress_Payments",
        label: "المستخلصات الهندسية",
        fields: [
          f("project_no", "رقم المشروع"),
          f("payment_no", "رقم المستخلص"),
          f("date", "تاريخ المستخلص", "date"),
          f("type", "نوع المستخلص (مرحلي / نهائي)"),
          f("item_no", "رقم بند الكميات"),
          f("executed_qty", "الكمية المنفذة", "number"),
          f("paid_amount", "المبلغ المصروف", "number"),
          f("cumulative_paid", "المصروف التراكمي", "number"),
          f("progress_pct", "نسبة الإنجاز الفعلي %", "number"),
          f("delay_penalty", "غرامة التأخير المحتسبة", "number"),
          f("engineer", "المهندس المشرف"),
        ],
      },
      {
        key: "Engineering_Time_Extensions_Variations",
        label: "تمديدات المدة وأوامر التغيير",
        fields: [
          f("project_no", "رقم المشروع"),
          f("request_no", "رقم الطلب / أمر التغيير"),
          f("type", "النوع (تمديد مدة / أمر تغيير)"),
          f("date", "التاريخ", "date"),
          f("extension_days", "أيام التمديد", "number"),
          f("variation_value", "قيمة أمر التغيير", "number"),
          f("approved", "معتمد (نعم / لا)"),
          f("approved_by", "جهة الاعتماد"),
          f("reason", "السبب"),
        ],
      },
    ],
  },
];
var allDatasets = auditSectors.flatMap((s) =>
  s.datasets.map((d) => ({
    ...d,
    sector: s.key,
  })),
);
var defaultParams = {
  depositGraceDays: 1,
  staleChequeDays: 180,
  materialityPct: 1,
  reviewIntervalDays: 90,
  overtimeMaxHours: 0,
  fuelTolerancePct: 2,
  contractFuelPrice: 0,
  workStartHour: 7,
  workEndHour: 15,
  licenseWarnDays: 30,
  maintenanceMultiple: 3,
  directPurchaseCeiling: 0,
  extensionMaxPct: 0,
  splitWindowDays: 7,
  concentrationPct: 25,
  committeeRotationMax: 3,
  stagnantMonths: 12,
  overtimeConcentrationPct: 30,
};
var n = (v) => {
  const x = Number(
    String(v ?? "")
      .replaceAll(",", "")
      .trim(),
  );
  return String(v ?? "").trim() === "" || !Number.isFinite(x) ? void 0 : x;
};
var d = (v) => parseDateMs(v);
var empty = (v) => !String(v ?? "").trim();
var yes = (v) =>
  /^(نعم|yes|y|true|1|نعم يوجد|يوجد|متجاوز|تجاوز)$/i.test(
    String(v ?? "").trim(),
  );
var no = (v) =>
  /^(لا|no|n|false|0|غير مطابق|لا يطابق)$/i.test(String(v ?? "").trim());
var DAY = 864e5;
var near = (a, b) => Math.abs(a - b) < 0.005;
var norm$1 = (s) =>
  String(s ?? "")
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
var days = (a, b) => Math.floor((a - b) / DAY);
var isCash = (v) => /نقد|cash/i.test(String(v ?? ""));
var isCheque = (v) => /شيك|cheque|check/i.test(String(v ?? ""));
var isCancelled = (r) => /ملغ|[اإ]لغ|cancel|void/i.test(String(r.status ?? ""));
var isReturned = (v) =>
  /بدون رصيد|رصيد غير كاف|مرتج|راجع|مرتد|مرفوض|return|bounc|nsf|dishonou?r/i.test(
    String(v ?? ""),
  );
var inactiveStatus = (v) =>
  /منقطع|موقوف|مستقيل|متقاعد|مفصول|متوف|terminated|resigned|retired|suspended|absent|deceased/i.test(
    String(v ?? ""),
  );
var placeholder = (v) =>
  /^(-+|—|لا يوجد|لايوجد|تم|تم الانجاز|تم الإنجاز|منجز|نفذ|ok|n\/?a|na|none|null)$/i.test(
    String(v ?? "").trim(),
  );
var tier = (amount, base, pct) => {
  if (!(base > 0)) return "high";
  const r = (Math.abs(amount) / base) * 100;
  return r <= pct ? "low" : r <= pct * 5 ? "medium" : "high";
};
var atLeast = (s, min) =>
  ({
    low: 0,
    medium: 1,
    high: 2,
  })[s] >=
  {
    low: 0,
    medium: 1,
    high: 2,
  }[min]
    ? s
    : min;
var quart = (s, p) => {
  const pos = (s.length - 1) * p,
    lo = Math.floor(pos),
    hi = Math.ceil(pos);
  return (s[lo] ?? 0) + ((s[hi] ?? 0) - (s[lo] ?? 0)) * (pos - lo);
};
var fences = (vals) => {
  if (vals.length < 4) return void 0;
  const s = [...vals].sort((a, b) => a - b),
    q1 = quart(s, 0.25),
    q3 = quart(s, 0.75),
    iqr = q3 - q1;
  return iqr > 0
    ? {
        mid: q3 + 1.5 * iqr,
        far: q3 + 3 * iqr,
      }
    : void 0;
};
var outlier = (v, f) =>
  f ? (v > f.far ? "high" : v > f.mid ? "medium" : void 0) : void 0;
var groupBy = (items, key) => {
  const m = /* @__PURE__ */ new Map();
  items.forEach((x) => {
    const k = key(x);
    if (k) m.set(k, [...(m.get(k) ?? []), x]);
  });
  return m;
};
var val = (r, k) => r[k];
function duplicates(rows, key, push, label) {
  const seen = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const k = String(val(r, key) ?? "").trim();
    if (!k) return;
    if (seen.has(k))
      push(
        i,
        "high",
        `تكرار ${label}`,
        `الرقم ${k} مكرر مع السجل ${seen.get(k) + 1}`,
      );
    else seen.set(k, i);
  });
}
function required(rows, keys, push, severity = "medium") {
  rows.forEach((r, i) =>
    keys.forEach(([k, l]) => {
      if (empty(r[k])) push(i, severity, "حقل جوهري ناقص", `لم يُدخل: ${l}`);
    }),
  );
}
function sequence(rows, push, label) {
  groupBy(
    rows.flatMap((r, i) => {
      const m = /^(.*?)(\d+)\s*$/.exec(String(r.voucher_no ?? "").trim());
      return m
        ? [
            {
              i,
              prefix: norm$1(m[1]),
              num: Number(m[2]),
              t: d(r.date),
            },
          ]
        : [];
    }),
    (x) => `p:${x.prefix}`,
  ).forEach((list) => {
    const sorted = [...list].sort((a, b) => a.num - b.num || a.i - b.i);
    let lastDate;
    sorted.forEach((cur, k) => {
      const prev = sorted[k - 1];
      if (prev && cur.num > prev.num + 1) {
        const gap = cur.num - prev.num - 1;
        push(
          cur.i,
          gap >= 3 ? "high" : "medium",
          `انقطاع في تسلسل ${label}`,
          `مفقود ${gap} سند بين ${prev.num} و ${cur.num}`,
        );
      }
      if (cur.t !== void 0) {
        if (lastDate !== void 0 && cur.t < lastDate) {
          const back = Math.round((lastDate - cur.t) / DAY);
          push(
            cur.i,
            back <= 1 ? "low" : "medium",
            "تاريخ السند أسبق من سند أقل رقماً",
            `${back} يوم`,
          );
        }
        lastDate = Math.max(lastDate ?? cur.t, cur.t);
      }
    });
  });
}
function cancellations(rows, push, label, party) {
  rows.forEach((r, i) => {
    if (!isCancelled(r)) return;
    if (empty(r.cancel_reason))
      push(i, "high", `سند ${label} ملغى دون سبب موثق`, r.voucher_no ?? "");
    else push(i, "low", `سند ${label} ملغى`, r.cancel_reason);
  });
  groupBy(
    rows.flatMap((r, i) =>
      isCancelled(r)
        ? [
            {
              i,
              k: norm$1(party(r)),
            },
          ]
        : [],
    ),
    (x) => x.k,
  ).forEach((list) => {
    if (list.length >= 2)
      list
        .slice(1)
        .forEach((x) =>
          push(
            x.i,
            "medium",
            `تكرار إلغاء سندات ${label} لنفس الطرف`,
            `${list.length} سندات ملغاة`,
          ),
        );
  });
}
function receipts(rows, push, p, today, by) {
  const tb = by("Trial_Balance"),
    clearing = by("Clearing_Accounts");
  duplicates(rows, "voucher_no", push, "رقم سند القبض");
  sequence(rows, push, "سندات القبض");
  cancellations(rows, push, "القبض", (r) => r.payer);
  rows.forEach((r, i) => {
    if (
      isCancelled(r) &&
      (!empty(r.deposit_date) || (n(r.deposited_amount) ?? 0) > 0)
    )
      push(i, "high", "سند قبض ملغى له إيداع مسجل", r.deposit_date ?? "");
  });
  const live = rows.flatMap((r, i) =>
    isCancelled(r)
      ? []
      : [
          {
            r,
            i,
          },
        ],
  );
  live.forEach(({ r, i }) => {
    if (n(r.amount) === void 0) push(i, "medium", "حقل جوهري ناقص", "لم يُدخل: المبلغ المقبوض");
    if (empty(r.date)) push(i, "medium", "حقل جوهري ناقص", "لم يُدخل: تاريخ القبض");
    if (empty(r.payer)) push(i, "medium", "حقل جوهري ناقص", "لم يُدخل: المقبوض منه");
    if (empty(r.method)) push(i, "medium", "طريقة القبض غير مسجلة", "");
  });
  const grace = Math.max(1, Math.floor(p.depositGraceDays) || 1);
  live.forEach(({ r, i }) => {
    const cash = isCash(r.method),
      chq = isCheque(r.method);
    const t = d(r.date),
      dd = d(r.deposit_date),
      am = n(r.amount),
      da = n(r.deposited_amount);
    if ((cash || chq) && t !== void 0)
      if (dd !== void 0 && dd < t)
        push(
          i,
          "high",
          "تاريخ الإيداع يسبق تاريخ القبض",
          `${r.deposit_date} قبل ${r.date}`,
        );
      else {
        const delay = days(dd ?? today, t);
        if (delay > grace)
          push(
            i,
            delay <= grace * 2 ? "low" : delay <= grace * 5 ? "medium" : "high",
            dd === void 0
              ? cash
                ? "نقدية غير مودعة بعد تجاوز المهلة"
                : "شيك غير مودع بعد تجاوز المهلة"
              : cash
                ? "تأخر توريد النقدية للبنك"
                : "تأخر إيداع الشيك",
            `${delay} يوم والمهلة ${grace}`,
          );
      }
    if (dd !== void 0 || da !== void 0) {
      if (da === void 0) push(i, "low", "مبلغ الإيداع غير مسجل", "");
      else {
        if (dd === void 0)
          push(i, "medium", "مبلغ مودع دون تاريخ إيداع", String(da));
        if (am !== void 0 && !near(am, da))
          if (da < am)
            push(
              i,
              atLeast(tier(am - da, am, p.materialityPct), "medium"),
              "نقص في المبلغ المودع عن المقبوض",
              `المقبوض ${am} والمودع ${da}`,
            );
          else
            push(
              i,
              "medium",
              "المبلغ المودع يزيد عن المقبوض",
              `المقبوض ${am} والمودع ${da}`,
            );
      }
      if (dd !== void 0 && empty(r.deposit_ref))
        push(i, "low", "إيداع بلا رقم إشعار بنكي", "");
    }
  });
  live.forEach(({ r, i }) => {
    if (isCheque(r.method) && empty(r.cheque_no))
      push(i, "medium", "قبض بشيك دون رقم الشيك", "");
    if (!isCheque(r.method) && !empty(r.cheque_no))
      push(i, "low", "رقم شيك مسجل مع طريقة قبض مختلفة", r.method ?? "");
  });
  groupBy(
    live.filter(({ r }) => !empty(r.cheque_no)),
    ({ r }) => norm$1(r.cheque_no),
  ).forEach((list) => {
    list
      .slice(1)
      .forEach(({ i }) =>
        push(
          i,
          "high",
          "رقم الشيك مستخدم في أكثر من سند",
          `${list.length} سندات`,
        ),
      );
  });
  groupBy(
    live.filter(
      ({ r }) => !empty(r.payer) && !empty(r.amount) && !empty(r.date),
    ),
    ({ r }) => `${norm$1(r.payer)}|${n(r.amount)}|${r.date}`,
  ).forEach((list) => {
    list
      .slice(1)
      .forEach(({ i }) =>
        push(
          i,
          "high",
          "احتمال قبض مزدوج",
          `نفس المقبوض منه والمبلغ والتاريخ مع السجل ${list[0].i + 1}`,
        ),
      );
  });
  const returnedByPayer = groupBy(
    rows.flatMap((r, i) =>
      isReturned(r.cheque_status) && !empty(r.payer)
        ? [
            {
              r,
              i,
            },
          ]
        : [],
    ),
    ({ r }) => norm$1(r.payer),
  );
  rows.forEach((r, i) => {
    if (!isReturned(r.cheque_status)) return;
    const k = norm$1(r.payer),
      count = k ? (returnedByPayer.get(k)?.length ?? 1) : 1,
      t = d(r.date) ?? 0,
      am = n(r.amount) ?? 0;
    const settled =
      Boolean(k) &&
      live.some(
        ({ r: o, i: j }) =>
          j !== i &&
          norm$1(o.payer) === k &&
          !isReturned(o.cheque_status) &&
          (d(o.date) ?? 0) >= t &&
          (n(o.amount) ?? 0) >= am,
      );
    push(
      i,
      count >= 2 ? "high" : isCancelled(r) || settled ? "low" : "medium",
      "شيك مرتجع أو بدون رصيد",
      count >= 2
        ? `تكرر ${count} مرات لنفس الساحب`
        : settled
          ? "سُوّي بسند لاحق"
          : isCancelled(r)
            ? "أُلغي السند"
            : "لم يُلغَ أثره ولم تتم تسويته",
    );
  });
  live.forEach(({ r, i }) => {
    if (!isCheque(r.method) || isReturned(r.cheque_status)) return;
    const k = norm$1(r.payer),
      t = d(r.date);
    if (!k || t === void 0) return;
    const prior = rows.filter(
      (o, j) =>
        j !== i &&
        norm$1(o.payer) === k &&
        isReturned(o.cheque_status) &&
        (d(o.date) ?? Infinity) < t,
    ).length;
    if (prior > 0)
      push(
        i,
        prior >= 2 ? "high" : "medium",
        "قبول شيك جديد من ساحب سبق ارتداد شيكه",
        `${prior} شيك مرتجع سابق`,
      );
  });
  const cashRe = /صندوق|نقدي|خزين|بنك|مصرف|cash|bank/i,
    suspRe = /وسيط|معلق|مؤقت|تسوية|clearing|suspense|temporary/i,
    personalRe = /سلف|عهد|موظف|شخصي|advance|employee|personal/i;
  const tbKeys = new Set(
    tb
      .flatMap((t) => [norm$1(t.account_no), norm$1(t.account_name)])
      .filter(Boolean),
  );
  const clrKeys = new Set(
    clearing
      .flatMap((c) => [norm$1(c.account_no), norm$1(c.account_name)])
      .filter(Boolean),
  );
  live.forEach(({ r, i }) => {
    const a = r.credit_account ?? "";
    if (empty(a)) {
      push(i, "high", "قبض دون حساب دائن", "");
      return;
    }
    const k = norm$1(a);
    if (clrKeys.has(k) || suspRe.test(a))
      push(i, "high", "تحويل المقبوض إلى حساب وسيط أو معلق", a);
    else if (cashRe.test(a))
      push(i, "high", "الحساب الدائن هو حساب نقدية أو بنك", a);
    else if (personalRe.test(a) && !personalRe.test(r.revenue_type ?? ""))
      push(i, "medium", "تحويل المقبوض إلى حساب سلف أو ذمم أشخاص دون مبرر", a);
    if (tb.length && !tbKeys.has(k))
      push(i, "medium", "الحساب الدائن غير موجود في ميزان المراجعة", a);
  });
  groupBy(
    live.filter(({ r }) => !empty(r.revenue_type) && !empty(r.credit_account)),
    ({ r }) => norm$1(r.revenue_type),
  ).forEach((list) => {
    if (list.length < 3) return;
    const counts = /* @__PURE__ */ new Map();
    list.forEach(({ r }) => {
      const k = norm$1(r.credit_account);
      counts.set(k, {
        n: (counts.get(k)?.n ?? 0) + 1,
        raw: counts.get(k)?.raw ?? r.credit_account,
      });
    });
    const [topKey, top] = [...counts.entries()].sort(
      (a, b) => b[1].n - a[1].n,
    )[0];
    const share = top.n / list.length;
    if (share < 0.5) return;
    list.forEach(({ r, i }) => {
      if (norm$1(r.credit_account) !== topKey)
        push(
          i,
          share >= 0.75 ? "medium" : "low",
          "حساب دائن مخالف للمعتاد لنفس نوع الإيراد",
          `المعتاد ${top.raw} بنسبة ${Math.round(share * 100)}%`,
        );
    });
  });
}
function payments(rows, push) {
  duplicates(rows, "voucher_no", push, "رقم سند الصرف");
  sequence(rows, push, "سندات الصرف");
  cancellations(rows, push, "الصرف", (r) => r.payee);
  required(
    rows,
    [
      ["payee", "الحساب المدفوع له"],
      ["budget_item", "بند الموازنة المقابل"],
      ["support_doc", "رقم المستند المعزز"],
    ],
    push,
  );
  const live = rows.flatMap((r, i) =>
    isCancelled(r)
      ? []
      : [
          {
            r,
            i,
          },
        ],
  );
  live.forEach(({ r, i }) => {
    const t = d(r.date);
    if (t !== void 0 && [5, 6].includes(new Date(t).getUTCDay()))
      push(i, "medium", "صرف في يوم عطلة", r.date);
    if (empty(r.approver)) push(i, "high", "صرف دون معتمد", "");
    else if (!empty(r.payee) && norm$1(r.approver) === norm$1(r.payee))
      push(i, "high", "معتمد الصرف هو نفسه المستفيد", r.approver);
  });
  groupBy(
    live.filter(({ r }) => !empty(r.payee) && !empty(r.amount)),
    ({ r }) => `${norm$1(r.payee)}|${n(r.amount)}|${r.date}`,
  ).forEach((list) => {
    list
      .slice(1)
      .forEach(({ i }) =>
        push(
          i,
          "high",
          "احتمال صرف مزدوج",
          `نفس المستفيد والمبلغ والتاريخ مع السجل ${list[0].i + 1}`,
        ),
      );
  });
  groupBy(
    live.filter(({ r }) => !empty(r.payee) && !empty(r.date)),
    ({ r }) => `${norm$1(r.payee)}|${r.date}`,
  ).forEach((list) => {
    if (list.length > 1 && new Set(list.map(({ r }) => n(r.amount))).size > 1)
      list.forEach(({ i }) =>
        push(
          i,
          "medium",
          "احتمال تجزئة الصرف",
          `${list.length} سندات لنفس المستفيد في نفس اليوم`,
        ),
      );
  });
}
function bankReconciliations(rows, push, p, today, by) {
  rows.forEach((r, i) => {
    const bank = n(r.bank_balance),
      book = n(r.book_balance),
      oc = n(r.outstanding_checks) ?? 0,
      dit = n(r.deposits_in_transit) ?? 0;
    const charges = n(r.bank_charges) ?? 0,
      credits = n(r.unrecorded_credits) ?? 0,
      diff = n(r.difference);
    const base = Math.abs(bank ?? book ?? 0);
    if (bank !== void 0 && book !== void 0) {
      const u = bank - oc + dit - (book + credits - charges);
      if (!near(u, 0))
        push(
          i,
          tier(u, base, p.materialityPct),
          "فرق تسوية غير مبرر",
          `الرصيد المعدل للبنك يختلف عن الدفاتر بمقدار ${u.toFixed(2)}`,
        );
      if (diff !== void 0 && !near(diff, u))
        push(
          i,
          "medium",
          "الفرق المسجل لا يطابق المحسوب",
          `المسجل ${diff} والمحسوب ${u.toFixed(2)}`,
        );
    } else if (diff !== void 0 && !near(diff, 0))
      push(
        i,
        tier(diff, base, p.materialityPct),
        "فروقات تسوية قائمة",
        String(diff),
      );
    if (oc > 0) {
      const od = d(r.oldest_check_date);
      if (od === void 0) push(i, "low", "تاريخ أقدم شيك معلق غير مدخل", "");
      else {
        const age = days(today, od);
        if (age > p.staleChequeDays)
          push(
            i,
            age > p.staleChequeDays * 2 ? "high" : "medium",
            "شيكات معلقة متقادمة",
            `${age} يوم`,
          );
      }
    }
    if (charges > 0)
      push(
        i,
        "low",
        "عمولات ومصاريف بنكية غير مسجلة بالدفاتر",
        String(charges),
      );
    if (credits > 0)
      push(
        i,
        atLeast(tier(credits, base, p.materialityPct), "medium"),
        "إيداعات بنكية غير مسجلة بالدفاتر",
        String(credits),
      );
    if (empty(r.reviewed_by)) push(i, "medium", "تسوية دون مراجعة", "");
    else if (
      !empty(r.prepared_by) &&
      norm$1(r.prepared_by) === norm$1(r.reviewed_by)
    )
      push(i, "high", "معد التسوية هو نفسه المراجع", r.prepared_by);
  });
  groupBy(
    rows.filter((r) => !empty(r.bank_account) && !empty(r.statement_date)),
    (r) => `${norm$1(r.bank_account)}|${r.statement_date}`,
  ).forEach((list) => {
    list
      .slice(1)
      .forEach((r) =>
        push(
          rows.indexOf(r),
          "medium",
          "تسوية مكررة لنفس الحساب والتاريخ",
          r.bank_account ?? "",
        ),
      );
  });
  const rc = by("Receipt_Vouchers");
  if (rc.length)
    groupBy(
      rows.flatMap((r, i) =>
        d(r.statement_date) !== void 0
          ? [
              {
                r,
                i,
              },
            ]
          : [],
      ),
      ({ r }) => String(d(r.statement_date)),
    ).forEach((list, key) => {
      const cut = Number(key);
      const transit = list.reduce(
        (a, { r }) => a + (n(r.deposits_in_transit) ?? 0),
        0,
      );
      const pending = rc.reduce((a, r) => {
        const t = d(r.date);
        if (
          isCancelled(r) ||
          t === void 0 ||
          t > cut ||
          !(isCash(r.method) || isCheque(r.method))
        )
          return a;
        const dd = d(r.deposit_date);
        return dd === void 0 || dd > cut ? a + (n(r.amount) ?? 0) : a;
      }, 0);
      if (!near(transit, pending))
        push(
          list[0].i,
          tier(transit - pending, Math.max(transit, pending), p.materialityPct),
          "الإيداعات بالطريق لا تطابق المقبوضات غير المودعة في سندات القبض",
          `بالتسوية ${transit} وبسندات القبض ${pending}`,
        );
    });
}
function pettyCash(rows, push, p, today) {
  duplicates(rows, "box", push, "رقم الصندوق");
  rows.forEach((r, i) => {
    const ap = n(r.approved),
      ac = n(r.actual),
      un = n(r.unsettled_docs) ?? 0;
    if (ap !== void 0 && ac !== void 0) {
      const diff = ac + un - ap;
      if (!near(diff, 0)) {
        const s = tier(diff, ap, p.materialityPct);
        push(
          i,
          diff < 0 ? s : s === "high" ? "medium" : s,
          diff < 0 ? "عجز في العهدة النقدية" : "زيادة في العهدة النقدية",
          `الفعلي + المستندات = ${ac + un} مقابل المعتمد ${ap}`,
        );
      }
      if (ac > ap) push(i, "medium", "الرصيد الفعلي يتجاوز المعتمد", "");
      if (un > ap)
        push(
          i,
          "high",
          "المستندات غير المسواة تتجاوز العهدة المعتمدة",
          `${un} مقابل ${ap}`,
        );
    }
    const lc = d(r.last_count);
    if (empty(r.last_count)) push(i, "medium", "لا يوجد جرد مفاجئ مسجل", "");
    else if (lc !== void 0) {
      const age = days(today, lc);
      if (age < 0) push(i, "high", "تاريخ جرد مستقبلي", r.last_count);
      else if (age > p.reviewIntervalDays)
        push(
          i,
          age > p.reviewIntervalDays * 2 ? "high" : "medium",
          "جرد مفاجئ متأخر",
          `${age} يوم`,
        );
      if (empty(r.counted_by)) push(i, "low", "القائم بالجرد غير مسجل", "");
      else if (
        norm$1(r.box).includes(norm$1(r.counted_by)) &&
        norm$1(r.counted_by).length >= 3
      )
        push(i, "high", "أمين الصندوق هو من أجرى الجرد", r.counted_by);
    }
    const lr = d(r.last_replenish);
    if (un > 0) {
      if (lr === void 0)
        push(i, "low", "لا توجد استعاضة مسجلة رغم وجود مستندات غير مسواة", "");
      else if (days(today, lr) > p.reviewIntervalDays)
        push(
          i,
          "medium",
          "مستندات غير مسواة دون استعاضة ضمن المدة",
          `${days(today, lr)} يوم`,
        );
    }
  });
}
function payroll(rows, push, p, today, by) {
  const est = by("HR_Establishment_Table"),
    promos = by("HR_Promotions_Increments");
  duplicates(rows, "employee_no", push, "الرقم الوظيفي (موظف وهمي أو مكرر)");
  const sameOther = (key, label, severity) =>
    groupBy(
      rows.flatMap((r, i) =>
        empty(val(r, key))
          ? []
          : [
              {
                r,
                i,
              },
            ],
      ),
      ({ r }) => norm$1(val(r, key)),
    ).forEach((list) => {
      const firstNo = norm$1(list[0].r.employee_no);
      list.slice(1).forEach(({ r, i }) => {
        if (norm$1(r.employee_no) !== firstNo)
          push(i, severity, label, `نفس القيمة مع السجل ${list[0].i + 1}`);
      });
    });
  sameOther("national_id", "الرقم الوطني مرتبط بأكثر من رقم وظيفي", "high");
  sameOther("bank_account", "حساب بنكي مشترك بين أكثر من موظف", "high");
  sameOther("name", "اسم مكرر بأرقام وظيفية مختلفة", "medium");
  rows.forEach((r, i) => {
    const b = n(r.basic),
      a = n(r.allowances) ?? 0,
      net = n(r.net),
      att = n(r.attendance_days),
      hd = d(r.hire_date);
    if (empty(r.appointment_decision))
      push(i, "high", "تعيين بلا قرار تعيين", "");
    if (empty(r.national_id)) push(i, "medium", "الرقم الوطني غير مدخل", "");
    if (empty(r.bank_account)) push(i, "medium", "الحساب البنكي غير مدخل", "");
    if (empty(r.hire_date)) push(i, "medium", "تاريخ التعيين غير مدخل", "");
    else if (hd !== void 0 && hd > today)
      push(i, "high", "تاريخ تعيين مستقبلي", r.hire_date);
    if (inactiveStatus(r.status) && (net ?? 0) > 0)
      push(i, "high", "صرف راتب لموظف حالته غير نشطة", r.status);
    if (att === 0 && (net ?? 0) > 0)
      push(i, "high", "راتب دون أي أيام حضور", "");
    else if (att === void 0) push(i, "low", "أيام الحضور غير مسجلة", "");
    if (b !== void 0 && net !== void 0 && net > b + a)
      push(i, "high", "الصافي أعلى من الأساسي + العلاوات", `${net} > ${b + a}`);
    if (a > 0 && (b === void 0 || b <= 0))
      push(i, "medium", "علاوات دون راتب أساسي", String(a));
  });
  groupBy(
    rows.flatMap((r, i) =>
      norm$1(r.grade) && (n(r.basic) ?? 0) > 0
        ? [
            {
              r,
              i,
            },
          ]
        : [],
    ),
    ({ r }) => norm$1(r.grade),
  ).forEach((list) => {
    const ratios = list.map(({ r }) => (n(r.allowances) ?? 0) / n(r.basic)),
      rf = fences(ratios),
      bf = fences(list.map(({ r }) => n(r.basic)));
    list.forEach(({ r, i }, k) => {
      const rs = outlier(ratios[k], rf),
        bs = outlier(n(r.basic), bf);
      if (rs)
        push(
          i,
          rs,
          "نسبة العلاوات إلى الأساسي شاذة مقارنة بنفس الدرجة",
          `${(ratios[k] * 100).toFixed(1)}%`,
        );
      if (bs)
        push(
          i,
          "medium",
          "الراتب الأساسي أعلى من نظرائه في نفس الدرجة",
          String(r.basic),
        );
    });
  });
  const promoByEmp = groupBy(promos, (x) => norm$1(x.employee_no));
  rows.forEach((r, i) => {
    const list = promoByEmp.get(norm$1(r.employee_no));
    if (!list?.length || empty(r.grade)) return;
    const dated = list
      .map((x) => ({
        x,
        t: d(x.due_date),
      }))
      .filter((x) => x.t !== void 0)
      .sort((a, b) => a.t - b.t);
    const due = dated.filter((x) => x.t <= today).at(-1);
    if (
      due &&
      !empty(due.x.new_grade) &&
      norm$1(due.x.new_grade) !== norm$1(r.grade)
    )
      push(
        i,
        "medium",
        "الدرجة في كشف الرواتب لا تطابق آخر قرار ترقية",
        `${r.grade} مقابل ${due.x.new_grade}`,
      );
    const future = dated.find(
      (x) => x.t > today && norm$1(x.x.new_grade) === norm$1(r.grade),
    );
    if (future)
      push(
        i,
        "high",
        "درجة ترقية مطبقة قبل تاريخ الاستحقاق",
        future.x.due_date ?? "",
      );
  });
  if (!est.length) return;
  const byPos = new Map(
    est
      .filter((e) => !empty(e.position_no))
      .map((e) => [norm$1(e.position_no), e]),
  );
  const holders = groupBy(
    rows.flatMap((r, i) =>
      empty(r.position_no)
        ? []
        : [
            {
              r,
              i,
            },
          ],
    ),
    ({ r }) => norm$1(r.position_no),
  );
  const counts = /* @__PURE__ */ new Map();
  est.forEach((e) =>
    counts.set(norm$1(e.title), (counts.get(norm$1(e.title)) ?? 0) + 1),
  );
  const used = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const annual = ((n(r.basic) ?? 0) + (n(r.allowances) ?? 0)) * 12;
    let allocation;
    if (!empty(r.position_no)) {
      const pos = byPos.get(norm$1(r.position_no));
      if (!pos)
        push(i, "high", "رقم الوظيفة غير موجود في التشكيلات", r.position_no);
      else {
        if (
          !empty(r.title) &&
          !empty(pos.title) &&
          norm$1(pos.title) !== norm$1(r.title)
        )
          push(
            i,
            "high",
            "المسمى لا يطابق المسمى المعتمد للوظيفة",
            `${r.title} مقابل ${pos.title}`,
          );
        if (
          !empty(r.grade) &&
          !empty(pos.grade) &&
          norm$1(pos.grade) !== norm$1(r.grade)
        )
          push(
            i,
            "high",
            "الدرجة الممنوحة تخالف الدرجة المقررة",
            `${r.grade} مقابل ${pos.grade}`,
          );
        allocation = n(pos.annual_allocation);
      }
      const h = holders.get(norm$1(r.position_no));
      if (h && h.length > 1 && h[0].i !== i)
        push(
          i,
          "high",
          "وظيفة واحدة مشغولة بأكثر من موظف",
          `${h.length} موظفين`,
        );
    } else if (!empty(r.title)) {
      const m = est.filter((e) => norm$1(e.title) === norm$1(r.title));
      if (!m.length)
        push(i, "high", "مسمى وظيفي غير موجود في التشكيلات", r.title);
      else {
        if (
          !empty(r.grade) &&
          !m.some((e) => norm$1(e.grade) === norm$1(r.grade))
        )
          push(
            i,
            "high",
            "الدرجة الممنوحة تخالف الدرجة المقررة",
            `${r.grade} مقابل ${m.map((e) => e.grade).join("، ")}`,
          );
        const k = norm$1(r.title);
        used.set(k, (used.get(k) ?? 0) + 1);
        if (used.get(k) > (counts.get(k) ?? 0))
          push(i, "high", "تعيين يتجاوز الشواغر المعتمدة", r.title);
        const allocs = m
          .map((e) => n(e.annual_allocation))
          .filter((x) => x !== void 0);
        if (allocs.length) allocation = Math.max(...allocs);
      }
    }
    if (allocation !== void 0 && allocation > 0 && annual > allocation)
      push(
        i,
        tier(annual - allocation, allocation, p.materialityPct),
        "الراتب السنوي المقدر يتجاوز المخصص المعتمد",
        `${annual} مقابل ${allocation}`,
      );
  });
}
function overtime(rows, push, p, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  const usesApproval = rows.some((r) => !empty(r.approved_hours));
  const deptFences = /* @__PURE__ */ new Map();
  groupBy(
    rows.filter((r) => (n(r.hours) ?? 0) > 0),
    (r) => norm$1(r.department) || "-",
  ).forEach((list, k) =>
    deptFences.set(k, fences(list.map((r) => n(r.hours)))),
  );
  const rateFences = fences(
    rows.flatMap((r) =>
      (n(r.overtime_pay) ?? 0) > 0 && (n(r.hours) ?? 0) > 0
        ? [n(r.overtime_pay) / n(r.hours)]
        : [],
    ),
  );
  rows.forEach((r, i) => {
    const h = n(r.hours) ?? 0,
      ap = n(r.approved_hours),
      bio = n(r.biometric_hours),
      pay = n(r.overtime_pay) ?? 0;
    if (empty(r.report))
      push(i, "high", "مكافأة أو إضافي بدون تقرير إنجاز", "");
    else if (placeholder(r.report) || norm$1(r.report).length < 8)
      push(i, "medium", "تقرير إنجاز شكلي أو غير مفصل", r.report);
    if ((n(r.bonus) ?? 0) > 0 && h === 0)
      push(i, "medium", "مكافأة دون ساعات عمل إضافي مسجلة", "");
    if (pay > 0 && h === 0)
      push(i, "high", "صرف مقابل إضافي دون ساعات", String(pay));
    if (
      payrollRows.length &&
      !empty(r.employee_no) &&
      !payrollRows.some((x) => norm$1(x.employee_no) === norm$1(r.employee_no))
    )
      push(i, "high", "موظف غير موجود في كشف الرواتب", r.employee_no);
    if (usesApproval) {
      if (ap === void 0 && h > 0)
        push(i, "medium", "إضافي بلا اعتماد مسبق للساعات", "");
      else if (ap !== void 0 && h > ap)
        push(
          i,
          atLeast(tier(h - ap, ap, p.materialityPct), "medium"),
          "ساعات إضافي تتجاوز المعتمدة مسبقاً",
          `${h} مقابل ${ap}`,
        );
    }
    if (bio !== void 0 && h > bio)
      push(
        i,
        bio === 0
          ? "high"
          : atLeast(tier(h - bio, bio, p.materialityPct), "medium"),
        bio === 0
          ? "إضافي دون أي ساعات مثبتة بالبصمة"
          : "ساعات إضافي تتجاوز المثبتة بالبصمة",
        `${h} مقابل ${bio}`,
      );
    const hs =
      h > 0 ? outlier(h, deptFences.get(norm$1(r.department) || "-")) : void 0;
    if (hs) push(i, hs, "تضخم ساعات الإضافي مقارنة بنظراء القسم", String(h));
    if (p.overtimeMaxHours > 0 && h > p.overtimeMaxHours)
      push(
        i,
        "high",
        "ساعات الإضافي تتجاوز الحد الأقصى المحدد",
        `${h} مقابل ${p.overtimeMaxHours}`,
      );
    if (pay > 0 && h > 0) {
      const rs = outlier(pay / h, rateFences);
      if (rs)
        push(
          i,
          rs,
          "قيمة الساعة الإضافية شاذة مقارنة بالسجلات",
          (pay / h).toFixed(2),
        );
    }
  });
  groupBy(rows, (r) =>
    empty(r.employee_no) ? "" : `${norm$1(r.employee_no)}|${norm$1(r.period)}`,
  ).forEach((list) => {
    if (list.length < 2) return;
    const idx = list.map((r) => rows.indexOf(r));
    const total = list.reduce((a, r) => a + (n(r.hours) ?? 0), 0);
    const projects = groupBy(list, (r) => norm$1(r.project) || "-");
    const reports = groupBy(
      list.filter((r) => !empty(r.report) && !placeholder(r.report)),
      (r) => norm$1(r.report),
    );
    projects.forEach((same) =>
      same
        .slice(1)
        .forEach((r) =>
          push(
            rows.indexOf(r),
            "high",
            "ازدواج صرف: نفس الموظف والمشروع والفترة",
            `${same.length} سجلات`,
          ),
        ),
    );
    if (projects.size >= 2)
      idx.forEach((i) =>
        push(
          i,
          projects.size >= 3 ? "high" : "medium",
          "صرف إضافي لنفس الموظف عن أكثر من مشروع في نفس الفترة",
          `${projects.size} مشاريع بمجموع ${total} ساعة`,
        ),
      );
    reports.forEach((same) => {
      if (new Set(same.map((r) => norm$1(r.project) || "-")).size >= 2)
        same.forEach((r) =>
          push(
            rows.indexOf(r),
            "high",
            "نفس تقرير الإنجاز مستخدم لمشاريع مختلفة",
            r.employee_no,
          ),
        );
    });
    if (total > 744)
      idx.forEach((i) =>
        push(
          i,
          "high",
          "مجموع الإضافي يتجاوز ساعات الشهر الفعلية",
          `${total} ساعة`,
        ),
      );
    else if (p.overtimeMaxHours > 0 && total > p.overtimeMaxHours)
      idx.forEach((i) =>
        push(
          i,
          "high",
          "مجموع الإضافي عبر المشاريع يتجاوز الحد الأقصى",
          `${total} مقابل ${p.overtimeMaxHours}`,
        ),
      );
  });
  groupBy(
    rows.filter(
      (r) =>
        !empty(r.report) &&
        !placeholder(r.report) &&
        norm$1(r.report).length >= 8,
    ),
    (r) => norm$1(r.report),
  ).forEach((list) => {
    if (new Set(list.map((r) => norm$1(r.employee_no))).size < 2) return;
    const crossProject =
      new Set(list.map((r) => norm$1(r.project) || "-")).size >= 2;
    list.forEach((r) =>
      push(
        rows.indexOf(r),
        crossProject ? "medium" : "low",
        "تقرير إنجاز مكرر بين موظفين",
        crossProject ? "مشاريع مختلفة" : "نفس المشروع",
      ),
    );
  });
  groupBy(
    rows.filter((r) => (n(r.hours) ?? 0) > 0),
    (r) => norm$1(r.employee_no),
  ).forEach((list) => {
    if (list.length >= 3 && new Set(list.map((r) => n(r.hours))).size === 1)
      list.forEach((r) =>
        push(
          rows.indexOf(r),
          "low",
          "ساعات إضافي ثابتة بنمط متكرر",
          `${n(r.hours)} ساعة في ${list.length} سجلات`,
        ),
      );
  });
}
function wagers(rows, push, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  const wageFences = /* @__PURE__ */ new Map();
  groupBy(
    rows.filter((r) => (n(r.daily_wage) ?? 0) > 0),
    (r) => norm$1(r.project) || "-",
  ).forEach((list, k) =>
    wageFences.set(k, fences(list.map((r) => n(r.daily_wage)))),
  );
  rows.forEach((r, i) => {
    const dd = n(r.days),
      w = n(r.daily_wage),
      t = n(r.total);
    if (dd !== void 0 && w !== void 0 && t !== void 0 && !near(dd * w, t))
      push(
        i,
        "high",
        "إجمالي المستحق لا يطابق الأيام × الأجر",
        `${dd * w} مقابل ${t}`,
      );
    if (dd !== void 0 && dd > 31)
      push(i, "high", "أيام عمل تتجاوز أيام الشهر", String(dd));
    if (empty(r.id_no)) push(i, "medium", "حقل جوهري ناقص", "لم يُدخل: الرقم التعريفي");
    if (empty(r.completion_report))
      push(i, "high", "صرف أجور بدون تقرير إنجاز", "");
    else if (
      placeholder(r.completion_report) ||
      norm$1(r.completion_report).length < 8
    )
      push(i, "medium", "تقرير إنجاز شكلي أو غير مفصل", r.completion_report);
    if (w !== void 0 && w > 0) {
      if (outlier(w, wageFences.get(norm$1(r.project) || "-")))
        push(i, "medium", "أجر يومي أعلى من نظرائه في نفس المشروع", String(w));
    }
    if (
      payrollRows.length &&
      (!empty(r.id_no) || !empty(r.name)) &&
      payrollRows.some(
        (x) =>
          (!empty(r.id_no) &&
            (norm$1(x.employee_no) === norm$1(r.id_no) ||
              norm$1(x.national_id) === norm$1(r.id_no))) ||
          (!empty(r.name) && norm$1(x.name) === norm$1(r.name)),
      )
    )
      push(
        i,
        "high",
        "عامل مياومة مسجل أيضاً على كشف الرواتب",
        r.name ?? r.id_no,
      );
  });
  groupBy(rows, (r) =>
    empty(r.id_no) ? "" : `${norm$1(r.id_no)}|${norm$1(r.period)}`,
  ).forEach((list) => {
    if (list.length < 2) return;
    const projects = groupBy(list, (r) => norm$1(r.project) || "-");
    const total = list.reduce((a, r) => a + (n(r.days) ?? 0), 0);
    projects.forEach((same) =>
      same
        .slice(1)
        .forEach((r) =>
          push(
            rows.indexOf(r),
            "high",
            "ازدواج صرف: نفس العامل والمشروع والفترة",
            `${same.length} سجلات`,
          ),
        ),
    );
    if (projects.size >= 2)
      list.forEach((r) =>
        push(
          rows.indexOf(r),
          total > 31 ? "high" : "medium",
          total > 31
            ? "مجموع أيام العامل عبر المشاريع يتجاوز أيام الشهر"
            : "صرف لنفس العامل في أكثر من مشروع بنفس الفترة",
          `${projects.size} مشاريع بمجموع ${total} يوم`,
        ),
      );
  });
}
function promotions(rows, push, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  const inc = fences(
    rows.flatMap((r) =>
      n(r.increment_amount) !== void 0 ? [n(r.increment_amount)] : [],
    ),
  );
  rows.forEach((r, i) => {
    if (empty(r.decision_no)) push(i, "high", "ترقية بدون رقم قرار", "");
    if (r.old_grade?.trim() && r.old_grade.trim() === r.new_grade?.trim())
      push(i, "medium", "الدرجة الجديدة مساوية للسابقة", "");
    if (
      payrollRows.length &&
      !empty(r.employee_no) &&
      !payrollRows.some((x) => norm$1(x.employee_no) === norm$1(r.employee_no))
    )
      push(i, "high", "ترقية لموظف غير موجود في كشف الرواتب", r.employee_no);
    const a = n(r.increment_amount);
    if (a !== void 0) {
      const s = outlier(a, inc);
      if (s) push(i, s, "علاوة شاذة مقارنة بنظيراتها", String(a));
    }
  });
  groupBy(
    rows.filter((r) => !empty(r.employee_no) && !empty(r.due_date)),
    (r) => `${norm$1(r.employee_no)}|${r.due_date}`,
  ).forEach((list) => {
    list
      .slice(1)
      .forEach((r) =>
        push(
          rows.indexOf(r),
          "high",
          "ترقية أو علاوة مكررة لنفس الموظف بنفس التاريخ",
          r.employee_no,
        ),
      );
  });
  groupBy(
    rows.filter((r) => !empty(r.employee_no) && d(r.due_date) !== void 0),
    (r) => norm$1(r.employee_no),
  ).forEach((list) => {
    const sorted = [...list].sort((a, b) => d(a.due_date) - d(b.due_date));
    sorted.slice(1).forEach((r, k) => {
      if (
        d(r.due_date) !== d(sorted[k].due_date) &&
        days(d(r.due_date), d(sorted[k].due_date)) <= 365
      )
        push(
          rows.indexOf(r),
          "medium",
          "ترقيات متقاربة لنفس الموظف خلال سنة",
          `${sorted[k].due_date} ثم ${r.due_date}`,
        );
    });
  });
}
function retirees(rows, push, today, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  duplicates(rows, "retiree_no", push, "رقم المتقاعد");
  const gf = fences(
    rows.flatMap((r) => (n(r.gratuity) !== void 0 ? [n(r.gratuity)] : [])),
  );
  rows.forEach((r, i) => {
    const g = n(r.gratuity) ?? 0,
      rd = d(r.retire_date);
    if (empty(r.clearance_no) && g > 0)
      push(i, "high", "صرف مستحقات دون براءة ذمة", "");
    if (rd !== void 0 && rd > today && g > 0)
      push(
        i,
        "high",
        "صرف مكافأة نهاية خدمة قبل تاريخ الإحالة للتقاعد",
        r.retire_date,
      );
    if (
      payrollRows.some(
        (x) =>
          !empty(x.employee_no) &&
          norm$1(x.employee_no) === norm$1(r.retiree_no),
      )
    )
      push(i, "high", "متقاعد ما زال على كشف الرواتب", r.retiree_no);
    const s = outlier(g, gf);
    if (s) push(i, s, "مكافأة نهاية خدمة شاذة مقارنة بنظيراتها", String(g));
  });
}
function leaves(rows, push, by) {
  const payrollRows = by("HR_Payroll_Sheets");
  rows.forEach((r, i) => {
    const s = d(r.start),
      e = d(r.end),
      b = n(r.balance);
    if (s !== void 0 && e !== void 0 && e < s)
      push(i, "high", "تاريخ النهاية قبل البداية", "");
    if (b !== void 0 && b < 0) push(i, "high", "رصيد إجازات سالب", String(b));
    if (
      payrollRows.length &&
      !empty(r.employee_no) &&
      !payrollRows.some((x) => norm$1(x.employee_no) === norm$1(r.employee_no))
    )
      push(i, "high", "إجازة لموظف غير موجود في كشف الرواتب", r.employee_no);
  });
  const byEmp = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const s = d(r.start),
      e = d(r.end);
    if (!r.employee_no?.trim() || s === void 0 || e === void 0) return;
    const list = byEmp.get(r.employee_no) ?? [];
    list.forEach(([a, b, j]) => {
      if (s <= b && e >= a)
        push(i, "medium", "تداخل إجازات للموظف", `مع السجل ${j + 1}`);
    });
    list.push([s, e, i]);
    byEmp.set(r.employee_no, list);
  });
}
var plateKey = (v) => norm$1(v).replace(/[\s-]/g, "");
var dayOf = (v) => {
  const t = d(v);
  return t === void 0 ? void 0 : Math.floor(t / DAY);
};
function fuelStation(rows, push, p, by) {
  const sys = by("Fleet_Fuel_System_Logs"),
    orders = by("Fleet_Movement_Orders"),
    gps = by("Fleet_GPS_Tracking_Logs");
  duplicates(rows, "invoice_no", push, "رقم فاتورة المحطة");
  const sysTotals = /* @__PURE__ */ new Map();
  sys.forEach((r) => {
    const k = plateKey(r.vehicle),
      l = n(r.liters);
    if (k && l !== void 0) sysTotals.set(k, (sysTotals.get(k) ?? 0) + l);
  });
  const stTotals = /* @__PURE__ */ new Map(),
    firstRow = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const v = plateKey(r.vehicle),
      l = n(r.liters);
    if (v && l !== void 0) {
      stTotals.set(v, (stTotals.get(v) ?? 0) + l);
      if (!firstRow.has(v)) firstRow.set(v, i);
    }
    const price = n(r.unit_price),
      contract =
        n(r.contract_price) ??
        (p.contractFuelPrice > 0 ? p.contractFuelPrice : void 0),
      amount = n(r.amount);
    if (price !== void 0 && contract !== void 0 && Math.abs(price - contract) > 5e-4)
      push(
        i,
        price > contract ? "high" : "medium",
        "سعر اللتر في فاتورة المحطة يخالف سعر العقد",
        `الفاتورة ${price} مقابل العقد ${contract}`,
      );
    if (
      l !== void 0 &&
      price !== void 0 &&
      amount !== void 0 &&
      Math.abs(amount - l * price) > Math.max(0.05, Math.abs(amount) * 5e-3)
    )
      push(
        i,
        "high",
        "قيمة الفاتورة لا تطابق الكمية × السعر",
        `المسجل ${amount} والمحسوب ${Math.round(l * price * 100) / 100}`,
      );
    const t = d(r.datetime);
    if (t !== void 0) {
      const dt = new Date(t),
        hasTime = /\d:\d/.test(String(r.datetime ?? "")),
        weekend = dt.getDay() === 5 || dt.getDay() === 6,
        hr = dt.getHours();
      if (weekend || (hasTime && (hr < p.workStartHour || hr >= p.workEndHour)))
        push(
          i,
          "medium",
          "صرف محروقات خارج الدوام الرسمي",
          String(r.datetime),
        );
    }
    if (v && orders.length) {
      const own = orders.filter((o) => plateKey(o.vehicle) === v);
      if (!own.length)
        push(
          i,
          "high",
          "تعبئة في المحطة بلا أمر حركة (تعبئة وهمية محتملة)",
          r.vehicle ?? "",
        );
      else {
        const day = dayOf(r.datetime);
        if (day !== void 0 && !own.some((o) => dayOf(o.date) === day))
          push(
            i,
            "medium",
            "تعبئة في تاريخ لا يوجد فيه أمر حركة للآلية",
            `${r.vehicle} — ${r.datetime}`,
          );
      }
    }
    if (v && gps.length) {
      const own = gps.filter((g) => plateKey(g.vehicle) === v);
      if (!own.length)
        push(i, "medium", "تعبئة بلا أثر في نظام التتبع (GPS)", r.vehicle ?? "");
      else {
        const day = dayOf(r.datetime);
        if (
          day !== void 0 &&
          own.some((g) => dayOf(g.datetime) === day && yes(g.off_hours))
        )
          push(
            i,
            "high",
            "تعبئة مقترنة بتشغيل خارج الدوام في GPS",
            `${r.vehicle} — ${r.datetime}`,
          );
      }
    }
    if (v && sys.length && !sysTotals.has(v))
      push(
        i,
        "high",
        "كمية في المحطة بلا قيد في نظام المحروقات",
        r.vehicle ?? "",
      );
  });
  stTotals.forEach((st, v) => {
    const sy = sysTotals.get(v);
    if (sy === void 0) return;
    const diff = st - sy,
      pct = sy > 0 ? (Math.abs(diff) / sy) * 100 : 100;
    if (pct > p.fuelTolerancePct)
      push(
        firstRow.get(v),
        pct > p.fuelTolerancePct * 5 ? "high" : "medium",
        "فرق كمية بين نظام المحروقات وكشف المحطة",
        `النظام ${sy} لتر مقابل المحطة ${st} لتر (فرق ${Math.round(diff * 100) / 100} لتر، ${Math.round(pct * 10) / 10}%)`,
      );
  });
}
function maintenance(rows, push, p, today, by) {
  duplicates(rows, "invoice_no", push, "رقم الفاتورة");
  const costs = rows
    .map((r) => n(r.parts_cost))
    .filter((x) => x !== void 0);
  const f = fences(costs);
  rows.forEach((r, i) => {
    const c = n(r.parts_cost);
    if (c !== void 0 && f) {
      const sv = outlier(c, f);
      if (sv)
        push(i, sv, "تكلفة قطع غيار مرتفعة بشكل شاذ", `${c} (الحد المعتاد ${Math.round(f.mid)})`);
    }
  });
  const lic = by("Fleet_Licensing_Insurance"),
    fuel = by("Fleet_Fuel_System_Logs"),
    year = new Date(today).getFullYear();
  const totals = /* @__PURE__ */ new Map();
  rows.forEach((r, i) => {
    const v = plateKey(r.vehicle),
      c = n(r.parts_cost);
    if (!v || c === void 0) return;
    const t = totals.get(v) ?? { sum: 0, top: i, topCost: -1 };
    t.sum += c;
    if (c > t.topCost) {
      t.topCost = c;
      t.top = i;
    }
    totals.set(v, t);
  });
  if (totals.size >= 3) {
    const sorted = [...totals.values()].map((t) => t.sum).sort((a, b) => a - b),
      mid = quart(sorted, 0.5);
    totals.forEach((t, v) => {
      if (!(mid > 0) || t.sum <= mid * p.maintenanceMultiple) return;
      const l = lic.find((x) => plateKey(x.plate) === v);
      const y = /(?:19|20)\d{2}/.exec(String(l?.model ?? ""));
      const age = y ? year - Number(y[0]) : void 0;
      const odos = fuel
        .filter((x) => plateKey(x.vehicle) === v)
        .map((x) => n(x.odometer))
        .filter((x) => x !== void 0);
      const km = odos.length > 1 ? Math.max(...odos) - Math.min(...odos) : 0;
      const extra = [
        age !== void 0 ? `عمر الآلية ${age} سنة` : "",
        km > 0 ? `المسافة المقطوعة ${km} كم (${Math.round((t.sum / km) * 1000)} لكل 1000 كم)` : "",
      ].filter(Boolean);
      push(
        t.top,
        age !== void 0 && age <= 3 ? "high" : "medium",
        "تضخم تكلفة صيانة الآلية مقارنة بوسيط الأسطول",
        `إجمالي ${Math.round(t.sum)} مقابل وسيط ${Math.round(mid)}${extra.length ? " — " + extra.join("، ") : ""}`,
      );
    });
  }
  groupBy(
    rows.flatMap((r, i) => {
      const v = plateKey(r.vehicle),
        ds = norm$1(r.description),
        t = d(r.date);
      return v && ds && t !== void 0 ? [{ i, key: `${v}|${ds}`, t }] : [];
    }),
    (x) => x.key,
  ).forEach((list) => {
    const s = [...list].sort((a, b) => a.t - b.t);
    s.forEach((cur, k) => {
      const prev = s[k - 1];
      if (prev && cur.t - prev.t <= 30 * DAY)
        push(
          cur.i,
          "medium",
          "تكرار إصلاح نفس العطل خلال 30 يوماً",
          `بعد ${days(cur.t, prev.t)} يوم من الإصلاح السابق`,
        );
    });
  });
}
function runAudit(store, today = Date.now(), params = {}) {
  const p = {
    ...defaultParams,
    ...params,
  };
  const out = [];
  const by = (key) => store[key] ?? [];
  for (const ds of allDatasets) {
    const rows = by(ds.key);
    const push = (row, severity, test, detail) =>
      out.push({
        dataset: ds.key,
        sector: ds.sector,
        row,
        severity,
        test,
        detail,
      });
    rows.forEach((r, i) =>
      ds.fields.forEach((fl) => {
        const v = val(r, fl.key);
        if (fl.type === "date" && !empty(v) && d(v) === void 0)
          push(i, "low", "تاريخ غير صالح", fl.label);
        if (fl.type === "number" && !empty(v) && n(v) === void 0)
          push(i, "low", "قيمة رقمية غير صالحة", fl.label);
      }),
    );
    switch (ds.key) {
      case "Receipt_Vouchers":
        receipts(rows, push, p, today, by);
        break;
      case "Payment_Vouchers":
        payments(rows, push);
        break;
      case "Revenue_Profession_Licenses":
        duplicates(rows, "license_no", push, "رقم الرخصة");
        rows.forEach((r, i) => {
          const due = n(r.fee_due), paid = n(r.fee_paid), bank = n(r.bank_deposit);
          if (due !== void 0 && (paid ?? 0) < due)
            push(i, "high", "رسوم رخصة مستحقة غير محصلة", `${due - (paid ?? 0)}`);
          if (paid !== void 0 && bank !== void 0 && bank < paid)
            push(i, "high", "المحصل لا يطابق الواصل للحساب البنكي", `${paid} / ${bank}`);
        });
        break;
      case "Revenue_Property_Taxes_Regulation":
        rows.forEach((r, i) => {
          const due = n(r.amount_due), paid = n(r.amount_paid), bank = n(r.bank_deposit);
          if (due !== void 0 && (paid ?? 0) < due)
            push(i, "high", "عوائد مستحقة غير محصلة", `${due - (paid ?? 0)}`);
          if (paid !== void 0 && bank !== void 0 && bank < paid)
            push(i, "high", "المحصل لا يطابق الواصل للحساب البنكي", `${paid} / ${bank}`);
        });
        break;
      case "Revenue_Municipal_Properties_Leases":
        rows.forEach((r, i) => {
          const due = d(r.due_date), pd = d(r.paid_date), inst = n(r.installment), paid = n(r.paid_amount);
          if (due !== void 0 && pd === void 0 && due < today)
            push(i, "high", "قسط إيجار متأخر دون سداد", `${Math.floor((today - due) / 864e5)} يوم`);
          else if (due !== void 0 && pd !== void 0 && pd > due)
            push(i, "medium", "تأخر المستأجر في سداد القسط", `${Math.floor((pd - due) / 864e5)} يوم`);
          if (inst !== void 0 && paid !== void 0 && paid < inst)
            push(i, "medium", "المسدد أقل من قيمة القسط", `${paid} < ${inst}`);
          const end = d(r.end_date);
          if (end !== void 0 && end < today && empty(r.paid_date))
            push(i, "medium", "عقد منتهٍ بذمة غير مسددة", r.contract_no ?? "");
        });
        break;
      case "Revenue_Daily_Fees":
        rows.forEach((r, i) => {
          const due = n(r.amount_due), col = n(r.amount_collected), dep = n(r.deposited_amount);
          if (due !== void 0 && col !== void 0 && col < due)
            push(i, "high", "المحصل أقل من المستحق", `${col} < ${due}`);
          if (col !== void 0 && dep !== void 0 && dep < col)
            push(i, "high", "المورد أقل من المحصل", `${col - dep}`);
        });
        break;
      case "Trial_Balance": {
        let dr = 0,
          cr = 0;
        rows.forEach((r, i) => {
          const o = n(r.opening),
            a = n(r.debit),
            b = n(r.credit),
            c = n(r.closing);
          dr += a ?? 0;
          cr += b ?? 0;
          if (o !== void 0 && a !== void 0 && b !== void 0 && c !== void 0) {
            const exp = /دائن|credit/i.test(String(r.nature ?? ""))
              ? o + b - a
              : o + a - b;
            if (!near(Math.abs(exp), Math.abs(c)))
              push(
                i,
                "high",
                "الرصيد الختامي لا يطابق الحركات",
                `المتوقع ${exp} والمسجل ${c}`,
              );
          }
        });
        if (rows.length && !near(dr, cr))
          push(
            0,
            "high",
            "ميزان المراجعة غير متوازن",
            `مجموع المدين ${dr} ≠ مجموع الدائن ${cr}`,
          );
        break;
      }
      case "Adjustments":
        required(
          rows,
          [
            ["reason", "سبب التسوية"],
            ["requester", "الجهة الطالبة"],
          ],
          push,
        );
        duplicates(rows, "entry_no", push, "رقم قيد التسوية");
        break;
      case "Bank_Reconciliations":
        bankReconciliations(rows, push, p, today, by);
        break;
      case "Petty_Cash":
        pettyCash(rows, push, p, today);
        break;
      case "Clearing_Accounts":
        rows.forEach((r, i) => {
          const tc = d(r.target_close);
          if (tc !== void 0 && tc < today)
            push(
              i,
              "high",
              "حساب وسيط تجاوز تاريخ الإغلاق",
              `متأخر ${days(today, tc)} يوم`,
            );
          if (empty(r.reason)) push(i, "medium", "سبب التعليق غير موثق", "");
        });
        break;
      case "HR_Establishment_Table":
        duplicates(rows, "position_no", push, "رقم الوظيفة");
        required(
          rows,
          [
            ["title", "المسمى الوظيفي المعتمد"],
            ["grade", "الدرجة المقررة"],
            ["annual_allocation", "المخصص المالي السنوي"],
          ],
          push,
        );
        break;
      case "HR_Payroll_Sheets":
        payroll(rows, push, p, today, by);
        break;
      case "HR_Overtime_Bonuses":
        overtime(rows, push, p, by);
        break;
      case "HR_Leaves_Records":
        leaves(rows, push, by);
        break;
      case "HR_Daily_Wagers":
        wagers(rows, push, by);
        break;
      case "HR_Promotions_Increments":
        promotions(rows, push, by);
        break;
      case "HR_Retirees_Settlements":
        retirees(rows, push, today, by);
        break;
      case "Fleet_Movement_Orders":
        duplicates(rows, "order_no", push, "رقم أمر الحركة");
        required(
          rows,
          [
            ["purpose", "الغرض الرسمي"],
            ["driver", "اسم السائق"],
          ],
          push,
        );
        break;
      case "Fleet_GPS_Tracking_Logs":
        rows.forEach((r, i) => {
          if (yes(r.off_hours))
            push(i, "high", "تشغيل خارج الدوام / العطل", r.datetime ?? "");
          if (yes(r.geofence))
            push(i, "high", "تجاوز النطاق الجغرافي", r.actual_route ?? "");
        });
        break;
      case "Fleet_Fuel_System_Logs": {
        const orders = by("Fleet_Movement_Orders");
        const last = /* @__PURE__ */ new Map();
        rows.forEach((r, i) => {
          if (no(r.order_match))
            push(i, "high", "تعبئة محروقات لا تطابق أمر حركة", r.vehicle ?? "");
          if (
            orders.length &&
            r.vehicle?.trim() &&
            !orders.some((o) => o.vehicle?.trim() === r.vehicle.trim())
          )
            push(i, "medium", "آلية بدون أي أمر حركة", r.vehicle);
          const od = n(r.odometer),
            v = r.vehicle?.trim();
          if (v && od !== void 0) {
            const prev = last.get(v);
            if (prev !== void 0 && od <= prev)
              push(i, "high", "قراءة عداد غير متسلسلة", `${od} ≤ ${prev}`);
            last.set(v, od);
          }
        });
        const groups = /* @__PURE__ */ new Map();
        rows.forEach((r, i) => {
          const v = r.vehicle?.trim(),
            rt = n(r.rate);
          if (v && rt !== void 0)
            groups.set(v, [...(groups.get(v) ?? []), [rt, i]]);
        });
        const stRows = by("Fleet_Station_Fuel_Statements");
        if (stRows.length) {
          const confirmed = new Set(stRows.map((x) => plateKey(x.vehicle)));
          rows.forEach((r, i) => {
            const v = plateKey(r.vehicle);
            if (v && !confirmed.has(v))
              push(
                i,
                "medium",
                "صرف في النظام الداخلي غير مؤكد بكشف المحطة",
                r.vehicle ?? "",
              );
          });
        }
        groups.forEach((list) => {
          const f = fences(list.map((x) => x[0]));
          if (f)
            list.forEach(([rt, i]) => {
              if (rt > f.mid)
                push(
                  i,
                  "medium",
                  "معدل استهلاك شاذ مقارنة بسجلات الآلية",
                  String(rt),
                );
            });
        });
        break;
      }
      case "Fleet_Station_Fuel_Statements":
        fuelStation(rows, push, p, by);
        break;
      case "Fleet_Maintenance":
        maintenance(rows, push, p, today, by);
        required(
          rows,
          [
            ["invoice_no", "رقم الفاتورة"],
            ["workshop", "ورشة الإصلاح"],
          ],
          push,
        );
        break;
      case "Fleet_Licensing_Insurance":
        rows.forEach((r, i) => {
          const pe = d(r.prev_expiry);
          if (pe !== void 0 && pe < today && empty(r.new_license))
            push(
              i,
              "high",
              "آلية برخصة منتهية دون تجديد",
              `انتهت منذ ${days(today, pe)} يوم`,
            );
          if (/منته|غير|لا يوجد|expired|none/i.test(r.insurance_status ?? ""))
            push(i, "high", "تأمين غير ساري", r.insurance_status);
          const warn = p.licenseWarnDays * DAY;
          if (
            pe !== void 0 &&
            pe >= today &&
            pe - today <= warn &&
            empty(r.new_license)
          )
            push(
              i,
              "medium",
              "رخصة آلية تقترب من الانتهاء",
              `تنتهي بعد ${days(pe, today)} يوم`,
            );
          const ie = d(r.insurance_expiry);
          if (ie !== void 0 && ie < today)
            push(
              i,
              "high",
              "بوليصة تأمين منتهية",
              `انتهت منذ ${days(today, ie)} يوم`,
            );
          else if (ie !== void 0 && ie - today <= warn)
            push(
              i,
              "medium",
              "بوليصة تأمين تقترب من الانتهاء",
              `تنتهي بعد ${days(ie, today)} يوم`,
            );
        });
        break;
      case "Warehouse_Master_List":
        duplicates(rows, "item_no", push, "رقم الصنف");
        break;
      case "Warehouses_Inbound_Vouchers": {
        duplicates(rows, "voucher_no", push, "رقم سند الإدخال");
        required(rows, [["po_no", "رقم أمر الشراء"]], push);
        const pos = by("Direct_Purchases_Orders"),
          master = by("Warehouse_Master_List");
        if (pos.length)
          rows.forEach((r, i) => {
            if (
              r.po_no?.trim() &&
              !pos.some((x) => x.po_no?.trim() === r.po_no.trim())
            )
              push(i, "high", "أمر شراء غير مسجل", r.po_no);
          });
        if (master.length)
          rows.forEach((r, i) => {
            if (
              r.item_no?.trim() &&
              !master.some((m) => m.item_no?.trim() === r.item_no.trim())
            )
              push(i, "medium", "صنف غير معرف في الكشف الشامل", r.item_no);
          });
        break;
      }
      case "Warehouses_Outbound_Vouchers":
        duplicates(rows, "voucher_no", push, "رقم سند الإخراج");
        required(
          rows,
          [
            ["receiver", "اسم المستلم"],
            ["purpose", "الغرض"],
          ],
          push,
        );
        break;
      case "Warehouses_Physical_Stocktaking":
        rows.forEach((r, i) => {
          const b = n(r.book),
            ph = n(r.physical);
          if (b !== void 0 && ph !== void 0 && !near(b, ph)) {
            push(
              i,
              ph < b ? "high" : "medium",
              ph < b ? "عجز في الجرد" : "زيادة في الجرد",
              `دفتري ${b} / فعلي ${ph}`,
            );
            if (empty(r.reasons)) push(i, "medium", "فروقات جرد بلا تبرير", "");
          }
        });
        break;
      case "Warehouses_Obsolete":
        rows.forEach((r, i) => {
          if (empty(r.writeoff))
            push(i, "medium", "مواد راكدة/تالفة دون قرار شطب", r.name ?? "");
        });
        break;
      case "Advances_Temporary": {
        const st = by("Advances_Settlements");
        const settledOf = (no) =>
          st.some(
            (s) =>
              s.advance_no?.trim() === no?.trim() && (n(s.remaining) ?? 0) <= 0,
          );
        duplicates(rows, "advance_no", push, "رقم السلفة");
        rows.forEach((r, i) => {
          const due = d(r.due_date);
          if (due !== void 0 && due < today && !settledOf(r.advance_no))
            push(
              i,
              "high",
              "سلفة مؤقتة متجاوزة لتاريخ الاستحقاق دون تسوية",
              `${days(today, due)} يوم`,
            );
          const emp = r.employee?.trim();
          if (
            emp &&
            rows.some(
              (o, j) =>
                j < i && o.employee?.trim() === emp && !settledOf(o.advance_no),
            )
          )
            push(i, "high", "سلفة جديدة قبل تسوية سلفة سابقة", emp);
        });
        break;
      }
      case "Advances_Settlements": {
        const adv = by("Advances_Temporary");
        rows.forEach((r, i) => {
          const a = adv.find(
            (x) => x.advance_no?.trim() === r.advance_no?.trim(),
          );
          const inv = n(r.invoices) ?? 0,
            ref = n(r.refund) ?? 0,
            rem = n(r.remaining);
          if (a) {
            const amt = n(a.amount);
            if (amt !== void 0 && rem !== void 0 && !near(amt - inv - ref, rem))
              push(
                i,
                "high",
                "رصيد السلفة المتبقي غير صحيح",
                `المتوقع ${amt - inv - ref}`,
              );
          } else if (adv.length)
            push(i, "medium", "تسوية لسلفة غير مسجلة", r.advance_no ?? "");
          if (ref > 0 && empty(r.receipt_no))
            push(i, "high", "فائض مرتجع بدون سند قبض", "");
          if (rem !== void 0 && rem > 0)
            push(i, "medium", "سلفة غير مسواة بالكامل", String(rem));
        });
        break;
      }
      case "Advances_Permanent_Petty":
        rows.forEach((r, i) => {
          const ap = n(r.approved),
            sp = n(r.spent),
            c = n(r.cash);
          if (
            ap !== void 0 &&
            sp !== void 0 &&
            c !== void 0 &&
            !near(ap - sp, c)
          )
            push(
              i,
              "high",
              "رصيد النقدية لا يطابق المعتمد − المصروف",
              `المتوقع ${ap - sp}`,
            );
          if (ap !== void 0 && sp !== void 0 && sp > ap)
            push(i, "high", "المصروف يتجاوز القيمة المعتمدة", "");
        });
        break;
      case "Advances_Overdue_Outstanding":
        rows.forEach((r, i) => {
          const dy = n(r.days) ?? 0;
          if (dy > 0 && empty(r.actions))
            push(i, "high", "ذمة متأخرة دون إجراء متخذ", `${dy} يوم`);
          else if (dy > 0)
            push(i, "medium", "ذمة متأخرة قيد المتابعة", `${dy} يوم`);
        });
        break;
      case "Engineering_BoQ_Master":
        rows.forEach((r, i) => {
          const q = n(r.quantity), up = n(r.unit_price), t = n(r.total);
          if (q !== void 0 && up !== void 0 && t !== void 0 && Math.abs(q * up - t) > 0.01)
            push(i, "medium", "إجمالي البند لا يساوي الكمية × السعر", `${q * up} / ${t}`);
        });
        break;
      case "Engineering_Site_Handover_Minutes":
        duplicates(rows, "minutes_no", push, "رقم المحضر");
        rows.forEach((r, i) => {
          const h = d(r.handover_date), c = d(r.commencement_date);
          if (h !== void 0 && c !== void 0 && c < h)
            push(i, "medium", "المباشرة العقدية تسبق تسليم الموقع", "");
          if (empty(r.signed_by)) push(i, "medium", "محضر تسليم دون توقيعات", r.minutes_no ?? "");
        });
        break;
      case "Engineering_Progress_Payments": {
        const boq = by("Engineering_BoQ_Master"),
          hand = by("Engineering_Site_Handover_Minutes"),
          ext = by("Engineering_Time_Extensions_Variations");
        const paidBy = new Map();
        rows.forEach((r) => {
          const k = String(r.project_no ?? "").trim();
          paidBy.set(k, (paidBy.get(k) ?? 0) + (n(r.paid_amount) ?? 0));
        });
        rows.forEach((r, i) => {
          const k = String(r.project_no ?? "").trim();
          const cv = n(boq.find((b) => String(b.project_no ?? "").trim() === k && n(b.contract_value))?.contract_value);
          if (cv && (paidBy.get(k) ?? 0) > cv)
            push(i, "high", "المصروف يتجاوز السقف المالي للعقد", `${paidBy.get(k)} > ${cv}`);
          const it = boq.find((b) => String(b.project_no ?? "").trim() === k && b.item_no && b.item_no === r.item_no);
          const bq = n(it?.quantity), eq = n(r.executed_qty);
          if (it && bq !== void 0 && eq !== void 0 && eq > bq)
            push(i, "high", "الكمية المنفذة تتجاوز كمية جدول الكميات", `${eq} > ${bq}`);
          if (!it && !empty(r.item_no) && boq.length)
            push(i, "medium", "بند مصروف غير وارد في جدول الكميات", r.item_no);
          const h = hand.find((x) => String(x.project_no ?? "").trim() === k);
          const st = d(h?.commencement_date), days = n(h?.contract_days), pd = d(r.date), pc = n(r.progress_pct);
          if (st !== void 0 && days && pd !== void 0 && pc !== void 0) {
            const extDays = ext
              .filter((x) => String(x.project_no ?? "").trim() === k && String(x.approved ?? "").trim() === "نعم")
              .reduce((a, x) => a + (n(x.extension_days) ?? 0), 0);
            const elapsed = (pd - st) / 864e5, total = days + extDays;
            if (elapsed > total && pc < 100 && !(n(r.delay_penalty) > 0))
              push(i, "high", "تجاوز المدة العقدية دون غرامة تأخير", `${Math.floor(elapsed)} / ${total} يوم`);
            else if (elapsed / total - pc / 100 > 0.2)
              push(i, "medium", "الإنجاز الفعلي متأخر عن المدة المنقضية", `${pc}% / ${Math.round((elapsed / total) * 100)}%`);
          }
        });
        break;
      }
      case "Engineering_Time_Extensions_Variations": {
        duplicates(rows, "request_no", push, "رقم الطلب");
        const handover = by("Engineering_Site_Handover_Minutes");
        const extRunning = new Map(); // مجموع أيام التمديد المعتمدة لكل مشروع حتى الصف الحالي
        const extFlagged = new Set();
        rows.forEach((r, i) => {
          const ok = String(r.approved ?? "").trim() === "نعم";
          const extDays = n(r.extension_days) ?? 0;
          if (extDays > 0 && empty(r.reason))
            push(i, "medium", "تمديد مدة دون سبب موثق", `${r.request_no ?? ""} — ${extDays} يوم`);
          if (ok && extDays > 0 && p.extensionMaxPct > 0) {
            const k = String(r.project_no ?? "").trim();
            const total = (extRunning.get(k) ?? 0) + extDays;
            extRunning.set(k, total);
            const contractDays = n(handover.find((h) => String(h.project_no ?? "").trim() === k && n(h.contract_days))?.contract_days);
            if (contractDays && !extFlagged.has(k) && (total / contractDays) * 100 > p.extensionMaxPct) {
              extFlagged.add(k);
              push(i, "high", "تمديدات متراكمة تتجاوز النسبة المسموحة من مدة العقد", `${total} يوم من ${contractDays} (${Math.round((total / contractDays) * 100)}% > ${p.extensionMaxPct}%)`);
            }
          }
          if (!ok && !empty(r.approved)) push(i, "low", "طلب غير معتمد", r.request_no ?? "");
          if (empty(r.approved_by) && ok) push(i, "high", "اعتماد دون جهة معتمدة", r.request_no ?? "");
          if ((n(r.variation_value) ?? 0) > 0 && !ok) push(i, "high", "أمر تغيير مالي غير معتمد", `${n(r.variation_value)}`);
        });
        break;
      }
      case "Tenders_Records":
        duplicates(rows, "tender_no", push, "رقم العطاء");
        required(
          rows,
          [
            ["committee", "لجنة العطاءات"],
            ["winner", "الجهة المحال عليها"],
          ],
          push,
        );
        rows.forEach((r, i) => {
          const est = n(r.estimated_value),
            aw = n(r.awarded_value),
            b = n(r.bidders);
          if (est && aw !== void 0 && aw > est)
            push(i, "high", "قيمة الإحالة تتجاوز القيمة التقديرية", `${aw} > ${est}`);
          if (b !== void 0 && b < 2)
            push(i, "medium", "عطاء بمتقدم وحيد", r.tender_no ?? "");
        });
        break;
      case "Direct_Purchases_Orders":
        duplicates(rows, "po_no", push, "رقم أمر الشراء");
        required(
          rows,
          [
            ["approver", "صاحب الصلاحية الموافق"],
            ["method", "طريقة الشراء"],
          ],
          push,
        );
        groupBy(
          rows.flatMap((r, i) =>
            r.supplier?.trim() && r.date
              ? [
                  {
                    r,
                    i,
                  },
                ]
              : [],
          ),
          ({ r }) => `${r.supplier.trim()}|${r.date}`,
        ).forEach((list) => {
          if (list.length > 1)
            list.forEach(({ i }) =>
              push(
                i,
                "high",
                "احتمال تجزئة مشتريات",
                `${list.length} أوامر لنفس المورد بنفس اليوم`,
              ),
            );
        });
    }
  }
  const sectorOf = (k) => allDatasets.find((x) => x.key === k)?.sector;
  const statFindings = statisticalFindings(store, allDatasets, sectorOf, p);
  out.push(
    ...sodFindings(store, sectorOf),
    ...fraudFindings(store, sectorOf),
    ...advancedFindings(store, sectorOf, p, today),
    ...statFindings,
    ...multivariateFindings(store, allDatasets, sectorOf, p, statFindings),
  );
  return out;
}
export { auditSectors, allDatasets, defaultParams, runAudit };
