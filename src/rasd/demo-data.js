// وضع العرض التجريبي: بيانات افتراضية بالكامل لـ «بلدية الواحة النموذجية» (أسماء وأرقام وهمية).
// كل التواريخ نسبية لتاريخ اليوم كي تظهر اختبارات التقادم والتأخير كما ستظهر على بيانات حقيقية.
// الانحرافات مقصودة وموزعة على كل الأنشطة ليرى الزائر قدرة المنصة فور فتح الرابط.

export const DEMO_FLAG_KEY = "rasd-demo-active";
export const DEMO_SNAPSHOT_KEY = "rasd-demo-snapshot";
export const DEMO_MUNICIPALITY = "بلدية الواحة النموذجية";

const DAY = 864e5;

/** yyyy-mm-dd بعد/قبل اليوم بعدد من الأيام. */
const iso = (today, offsetDays) => new Date(today + offsetDays * DAY).toISOString().slice(0, 10);

/** أقرب يوم جمعة مضى (يُعد عطلة في اختبار «صرف في يوم عطلة»). */
function lastFriday(today) {
  let t = today - 3 * DAY;
  while (new Date(t).getUTCDay() !== 5) t -= DAY;
  return new Date(t).toISOString().slice(0, 10);
}

const PAYERS = ["مؤسسة النخيل للتجارة", "مطعم السنابل", "شركة الأفق للمقاولات", "صيدلية الشفاء", "مخبز الريف", "ورشة الإتقان", "مكتبة المعرفة", "سوبرماركت الوفرة"];
const REVENUES = ["رسوم رخص مهن", "رسوم إشغال رصيف", "عوائد تنظيم", "إيجار محل", "رسوم لافتات", "غرامات مخالفات"];

function receipts(today) {
  const rows = [];
  const methods = ["نقدي", "شيك", "تحويل"];
  const skipped = new Set([1008, 1014, 1015, 1016]); // انقطاع في التسلسل
  let k = 0;
  for (let no = 1001; no <= 1024; no++) {
    if (skipped.has(no)) continue;
    const date = iso(today, -62 + (no - 1001) * 2);
    const method = methods[k % 3];
    const amount = 120 + ((k * 137) % 880);
    const dep = iso(today, -62 + (no - 1001) * 2 + 1);
    rows.push({
      voucher_no: `RV-${no}`,
      date,
      amount: String(amount),
      payer: PAYERS[k % PAYERS.length],
      revenue_type: REVENUES[k % REVENUES.length],
      credit_account: "4101",
      method,
      cheque_no: method === "شيك" ? String(700100 + no) : "",
      cheque_status: method === "شيك" ? "محصل" : "",
      deposit_date: dep,
      deposited_amount: String(amount),
      deposit_ref: `DP-${no}`,
      status: "معتمد",
      cancel_reason: "",
    });
    k++;
  }
  const at = (no) => rows.find((r) => r.voucher_no === `RV-${no}`);
  // نقدية لم تُودَع بعد تجاوز المهلة
  Object.assign(at(1005), { method: "نقدي", cheque_no: "", cheque_status: "", deposit_date: "", deposited_amount: "", deposit_ref: "", amount: "2450" });
  // نقص في المبلغ المودع
  Object.assign(at(1012), { method: "نقدي", cheque_no: "", cheque_status: "", amount: "3200", deposited_amount: "2900" });
  // شيك بلا رقم
  Object.assign(at(1017), { method: "شيك", cheque_no: "", cheque_status: "معلق" });
  // سند ملغى بلا سبب وله إيداع
  Object.assign(at(1019), { status: "ملغى", cancel_reason: "" });
  // الرقم نفسه للشيك في سندين
  Object.assign(at(1021), { method: "شيك", cheque_no: "880021", cheque_status: "معلق" });
  Object.assign(at(1022), { method: "شيك", cheque_no: "880021", cheque_status: "معلق" });
  // إيداع قبل تاريخ القبض
  Object.assign(at(1023), { method: "نقدي", cheque_no: "", cheque_status: "", deposit_date: iso(today, -62 + 22 * 2 - 3) });
  return rows;
}

const SUPPLIERS = ["شركة المدار للتوريدات", "مؤسسة البناء الحديث", "الشرق للأدوات الكهربائية", "الأمل للقرطاسية", "مصنع الأسفلت الوطني", "مؤسسة الوفاء للصيانة"];
const BUDGET_ITEMS = ["أعمال صيانة", "لوازم ومهمات", "قرطاسية", "محروقات", "إنارة طرق", "نظافة"];
const APPROVERS = ["م. سالم الحداد", "أ. هدى المصري"];

function payments(today) {
  const rows = [];
  const skipped = new Set([2009, 2010, 2011, 2012]);
  let k = 0;
  for (let no = 2001; no <= 2022; no++) {
    if (skipped.has(no)) continue;
    let t = today + (-58 + (no - 2001) * 2) * DAY;
    while ([5, 6].includes(new Date(t).getUTCDay())) t -= DAY; // تجنّب العطلة في السجلات السليمة
    rows.push({
      voucher_no: `PV-${no}`,
      date: new Date(t).toISOString().slice(0, 10),
      amount: String(300 + ((k * 211) % 2600)),
      payee: SUPPLIERS[k % SUPPLIERS.length],
      budget_item: BUDGET_ITEMS[k % BUDGET_ITEMS.length],
      method: k % 2 ? "شيك" : "تحويل",
      support_doc: `INV-${5100 + no}`,
      approver: APPROVERS[k % 2],
      status: "معتمد",
      cancel_reason: "",
      entered_by: "خالد العبدالله",
      paid_by: "ليلى الخطيب",
    });
    k++;
  }
  const at = (no) => rows.find((r) => r.voucher_no === `PV-${no}`);
  Object.assign(at(2004), { approver: "" }); // صرف دون معتمد
  Object.assign(at(2007), { payee: "مؤسسة الوفاء للصيانة", approver: "مؤسسة الوفاء للصيانة" }); // المعتمد هو المستفيد
  // صرف مزدوج: السندان نفسهما مستفيدًا ومبلغًا وتاريخًا
  let dt = today - 30 * DAY;
  while ([5, 6].includes(new Date(dt).getUTCDay())) dt -= DAY;
  const dupDate = new Date(dt).toISOString().slice(0, 10);
  Object.assign(at(2014), { payee: "مصنع الأسفلت الوطني", amount: "9800", date: dupDate });
  Object.assign(at(2015), { payee: "مصنع الأسفلت الوطني", amount: "9800", date: dupDate });
  Object.assign(at(2022), { date: lastFriday(today) }); // صرف في يوم عطلة (آخر سند فلا يخلّ بترتيب التواريخ)
  Object.assign(at(2019), { status: "ملغى", cancel_reason: "" }); // ملغى دون سبب
  Object.assign(at(2020), { support_doc: "" }); // بلا مستند معزز
  return rows;
}

function bankRecs(today) {
  return [
    // سليمة
    { bank_account: "البنك الأهلي — 1001-554", statement_date: iso(today, -35), bank_balance: "152000", book_balance: "150000", outstanding_checks: "4000", oldest_check_date: iso(today, -20), deposits_in_transit: "2000", bank_charges: "0", unrecorded_credits: "0", difference: "0", prepared_by: "رنا القاسم", reviewed_by: "أ. هدى المصري" },
    // فرق غير مبرر + معد التسوية هو المراجع
    { bank_account: "بنك الإسكان — 2208-119", statement_date: iso(today, -35), bank_balance: "98000", book_balance: "90500", outstanding_checks: "3000", oldest_check_date: iso(today, -25), deposits_in_transit: "0", bank_charges: "0", unrecorded_credits: "0", difference: "4500", prepared_by: "رنا القاسم", reviewed_by: "رنا القاسم" },
    // شيكات معلقة متقادمة + إيداعات وعمولات غير مسجلة
    { bank_account: "البنك العربي — 3340-870", statement_date: iso(today, -35), bank_balance: "61500", book_balance: "54000", outstanding_checks: "9000", oldest_check_date: iso(today, -420), deposits_in_transit: "0", bank_charges: "150", unrecorded_credits: "6600", difference: "0", prepared_by: "رنا القاسم", reviewed_by: "" },
    { bank_account: "البنك الأهلي — 1001-554", statement_date: iso(today, -5), bank_balance: "170000", book_balance: "170000", outstanding_checks: "0", oldest_check_date: "", deposits_in_transit: "0", bank_charges: "0", unrecorded_credits: "0", difference: "0", prepared_by: "رنا القاسم", reviewed_by: "أ. هدى المصري" },
  ];
}

function pettyCash(today) {
  return [
    { box: "صندوق-1 / عبدالله النجار", approved: "2000", actual: "1980", unsettled_docs: "20", last_replenish: iso(today, -20), last_count: iso(today, -25), counted_by: "رنا القاسم" },
    { box: "صندوق-2 / منى الشريف", approved: "3000", actual: "1200", unsettled_docs: "800", last_replenish: iso(today, -150), last_count: iso(today, -300), counted_by: "المدقق الداخلي" }, // عجز + جرد متأخر
    { box: "صندوق-3 / ياسر حمدان", approved: "1500", actual: "1500", unsettled_docs: "0", last_replenish: iso(today, -10), last_count: iso(today, -15), counted_by: "ياسر حمدان" }, // أمين الصندوق هو من جرد
    { box: "صندوق-4 / سمر الدباس", approved: "1000", actual: "950", unsettled_docs: "50", last_replenish: iso(today, -5), last_count: "", counted_by: "" }, // بلا جرد
  ];
}

function licenses(today) {
  const profs = ["بقالة", "مطعم", "صالون حلاقة", "مكتب هندسي", "ورشة نجارة", "صيدلية", "محل ألبسة", "مخبز"];
  const rows = Array.from({ length: 12 }, (_, i) => ({
    license_no: `L-${3001 + i}`,
    date: iso(today, -200 + i * 12),
    owner: `${profs[i % profs.length]} — منشأة ${i + 1}`,
    profession: profs[i % profs.length],
    fee_due: String(150 + i * 10),
    fee_paid: String(150 + i * 10),
    receipt_no: `RV-${1001 + i}`,
    bank_deposit: String(150 + i * 10),
    status: "سارية",
  }));
  Object.assign(rows[3], { fee_paid: "0", bank_deposit: "0", receipt_no: "" }); // رسوم غير محصلة
  Object.assign(rows[7], { bank_deposit: "120" }); // الواصل للبنك أقل من المحصل
  Object.assign(rows[9], { license_no: "L-3002" }); // رقم رخصة مكرر
  return rows;
}

function propertyTaxes() {
  const types = ["تنظيم", "تعبيد", "مسقفات", "أبراضي"];
  const rows = Array.from({ length: 10 }, (_, i) => ({
    parcel_no: `ق-${410 + i}`,
    owner: `مكلف رقم ${i + 1}`,
    tax_type: types[i % 4],
    year: "2026",
    amount_due: String(300 + i * 25),
    amount_paid: String(300 + i * 25),
    receipt_no: `RV-${1001 + i}`,
    bank_deposit: String(300 + i * 25),
  }));
  Object.assign(rows[2], { amount_paid: "100", bank_deposit: "100" }); // تحصيل جزئي
  Object.assign(rows[6], { bank_deposit: "250" }); // الواصل أقل
  return rows;
}

function leases(today) {
  const places = ["محل 1 — السوق المركزي", "كشك 4 — الكورنيش", "مخزن 2 — المنطقة الصناعية", "محل 7 — السوق المركزي"];
  return places.map((property, i) => ({
    contract_no: `C-${500 + i}`,
    property,
    tenant: `مستأجر ${i + 1}`,
    start_date: iso(today, -400),
    end_date: i === 3 ? iso(today, -40) : iso(today, 300),
    installment: "400",
    due_date: iso(today, i === 1 ? -75 : -20),
    paid_date: i === 1 ? "" : i === 2 ? iso(today, -2) : iso(today, -22),
    paid_amount: i === 1 ? "" : i === 2 ? "250" : "400",
    receipt_no: i === 1 ? "" : `RV-${1002 + i}`,
  }));
}

function dailyFees(today) {
  const services = ["مسلخ", "سوق مركزي", "أذونات حفر", "مواقف"];
  const rows = Array.from({ length: 10 }, (_, i) => ({
    date: iso(today, -40 + i),
    service: services[i % 4],
    receipt_book: `دفتر-${20 + i}`,
    amount_due: String(500 + i * 40),
    amount_collected: String(500 + i * 40),
    collector: i % 2 ? "محمود الزعبي" : "فادي العلي",
    deposit_date: iso(today, -39 + i),
    deposited_amount: String(500 + i * 40),
  }));
  Object.assign(rows[3], { amount_collected: "480", deposited_amount: "480" });
  Object.assign(rows[6], { deposited_amount: String(500 + 6 * 40 - 160) }); // توريد أقل من المحصل
  return rows;
}

function payroll(today) {
  const names = ["أحمد الخطيب", "سلمى العمري", "يوسف النمر", "ريم الحجازي", "طارق السعدي", "دانة الفاعوري", "مازن الرواشدة", "هبة المومني", "عمر الطراونة", "لينا البدور", "نبيل الكساسبة", "إسراء الزغول"];
  const rows = names.map((name, i) => {
    const basic = 520 + (i % 3) * 40;
    const allow = 90 + (i % 3) * 10;
    return {
      employee_no: `E-${100 + i}`,
      name,
      national_id: String(9900000000 + i * 137),
      position_no: `P-${i + 1}`,
      title: "موظف",
      grade: ["الرابعة", "الخامسة", "السادسة"][i % 3],
      hire_date: iso(today, -2000 + i * 40),
      appointment_decision: `ق/${2015 + (i % 8)}/${i + 10}`,
      status: "على رأس العمل",
      attendance_days: "22",
      bank_account: `JO94CBJO00100000000${10000 + i}`,
      basic: String(basic),
      allowances: String(allow),
      net: String(basic + allow - 30),
      phone: `0790000${100 + i}`,
      address: "العقبة",
    };
  });
  Object.assign(rows[2], { appointment_decision: "" }); // تعيين بلا قرار
  Object.assign(rows[4], { status: "منقطع", net: "600" }); // راتب لمنقطع
  Object.assign(rows[5], { net: "900" }); // الصافي أعلى من الأساسي + العلاوات
  Object.assign(rows[7], { bank_account: rows[6].bank_account }); // حساب مشترك
  Object.assign(rows[9], { attendance_days: "0" }); // راتب دون حضور
  rows.push({ ...rows[0], name: "أحمد الخطيب", employee_no: "E-999" }); // اسم والرقم الوطني مكرران برقم وظيفي مختلف (موظف وهمي)
  return rows;
}

function overtime() {
  const depts = ["الهندسة", "الصحة", "الخدمات"];
  const rows = Array.from({ length: 10 }, (_, i) => ({
    employee_no: `E-${100 + i}`,
    name: `موظف ${i + 1}`,
    department: depts[i % 3],
    project: `مشروع ${(i % 3) + 1}`,
    period: "2026-09",
    hours: "12",
    approved_hours: "15",
    biometric_hours: "12",
    overtime_pay: "60",
    report: "تقرير إنجاز أعمال صيانة الطرق للشهر",
    bonus: "0",
  }));
  Object.assign(rows[1], { report: "" }); // بلا تقرير
  Object.assign(rows[3], { hours: "40", approved_hours: "15", biometric_hours: "10", overtime_pay: "200" }); // تجاوز الاعتماد والبصمة
  Object.assign(rows[5], { employee_no: "E-777", name: "موظف غير مسجل" }); // غير موجود في الرواتب
  Object.assign(rows[7], { hours: "0", approved_hours: "", biometric_hours: "0", overtime_pay: "150" }); // صرف دون ساعات
  return rows;
}

function wagers() {
  return Array.from({ length: 6 }, (_, i) => ({
    id_no: `W-${40 + i}`,
    name: `عامل ${i + 1}`,
    project: "نظافة الأسواق",
    period: "2026-09",
    days: i === 2 ? "35" : "24",
    daily_wage: "15",
    total: i === 4 ? "400" : i === 2 ? "525" : "360",
    completion_report: i === 1 ? "" : "شهادة إنجاز أعمال النظافة",
    phone: `0780000${i}`,
    address: "العقبة",
    bank_account: `JO94ABC${i}`,
  }));
}

function fuelStation() {
  const cars = ["12-3456", "12-7788", "14-2201", "15-9090"];
  const rows = Array.from({ length: 8 }, (_, i) => ({
    vehicle: cars[i % 4],
    card_no: `SC-${i % 4}`,
    datetime: `2026-09-${String(5 + i).padStart(2, "0")} 08:30`,
    liters: "60",
    unit_price: "0.78",
    amount: "46.8",
    contract_price: "0.78",
    invoice_no: `FI-${900 + i}`,
  }));
  Object.assign(rows[2], { unit_price: "0.92", amount: "55.2" }); // سعر أعلى من العقد
  Object.assign(rows[5], { invoice_no: "FI-900" }); // فاتورة مكررة
  return rows;
}

function fuelSystem() {
  const cars = ["12-3456", "12-7788", "14-2201", "15-9090"];
  return cars.map((vehicle, i) => ({ vehicle, liters: i === 0 ? "90" : "120", odometer: String(50000 + i * 9000), rate: "12", order_match: "مطابق" }));
}

function maintenance() {
  const cars = ["12-3456", "12-7788", "14-2201", "15-9090", "16-1002"];
  const rows = Array.from({ length: 10 }, (_, i) => ({
    vehicle: cars[i % 5],
    date: `2026-0${(i % 9) + 1}-10`,
    description: "تغيير زيت وفلاتر",
    parts_cost: String(80 + i * 6),
    workshop: "ورشة النور",
    invoice_no: `MI-${700 + i}`,
  }));
  Object.assign(rows[4], { description: "إصلاح ناقل الحركة", parts_cost: "4800" }); // تكلفة شاذة
  return rows;
}

function directPurchases(today) {
  const day = iso(today, -18);
  const rows = Array.from({ length: 8 }, (_, i) => ({
    po_no: `PO-${8000 + i}`,
    date: iso(today, -50 + i * 3),
    supplier: SUPPLIERS[i % SUPPLIERS.length],
    nature: "لوازم صيانة",
    value: String(400 + i * 90),
    method: "شراء مباشر",
    approver: APPROVERS[i % 2],
    entered_by: "خالد العبدالله",
    received_by: "منصور الشوبكي",
    supplier_phone: `0770000${i}`,
    supplier_address: "العقبة",
    supplier_bank: `JO11XYZ${i}`,
  }));
  // تجزئة مشتريات: ثلاثة أوامر لنفس المورد في اليوم نفسه
  [5, 6, 7].forEach((i, k) => Object.assign(rows[i], { supplier: "مؤسسة البناء الحديث", date: day, value: String(1900 + k * 20), supplier_phone: "0770001", supplier_bank: "JO11XYZ9" }));
  Object.assign(rows[3], { approver: "" }); // بلا صاحب صلاحية
  Object.assign(rows[4], { supplier: "مؤسسة الندى للتجارة", supplier_national_id: String(9900000000 + 1 * 137) }); // مورد فرد برقم وطني لموظفة على كشف الرواتب (تضارب مصالح)
  Object.assign(rows[2], { received_by: "خالد العبدالله" }); // المدخل هو المستلم (فصل مهام)
  return rows;
}

/** مخزن البيانات التجريبي: مفاتيح الجداول كما يعرّفها `auditSectors`. */
export function buildDemoStore(today = Date.now()) {
  return {
    Receipt_Vouchers: receipts(today),
    Payment_Vouchers: payments(today),
    Bank_Reconciliations: bankRecs(today),
    Petty_Cash: pettyCash(today),
    Revenue_Profession_Licenses: licenses(today),
    Revenue_Property_Taxes_Regulation: propertyTaxes(),
    Revenue_Municipal_Properties_Leases: leases(today),
    Revenue_Daily_Fees: dailyFees(today),
    HR_Payroll_Sheets: payroll(today),
    HR_Overtime_Bonuses: overtime(),
    HR_Daily_Wagers: wagers(),
    Fleet_Station_Fuel_Statements: fuelStation(),
    Fleet_Fuel_System_Logs: fuelSystem(),
    Fleet_Maintenance: maintenance(),
    Direct_Purchases_Orders: directPurchases(today),
  };
}

/**
 * تقرير سابق افتراضي مبني من ملاحظات اليوم: يُبقي نحو ثلثيها «متكررة» ويضيف ملاحظتين «معالجتين» (وردتا في تقرير قديم ولم
 * تعودا) كي تظهر طبقة المقارنة التاريخية (جديدة / متكررة / معالجة) مباشرة.
 * findings: ملاحظات اليوم بعد حساب `ref` و`key` (dataset, test, ref, severity, detail).
 */
export function buildDemoPreviousReport(findings, today = Date.now()) {
  const kept = findings.filter((_, i) => i % 3 !== 0);
  const resolvedSamples = [
    { dataset: "Receipt_Vouchers", test: "نقدية غير مودعة بعد تجاوز المهلة", ref: "RV-0990", severity: "high", detail: "9 يوم والمهلة 1" },
    { dataset: "Payment_Vouchers", test: "صرف دون معتمد", ref: "PV-1990", severity: "high", detail: "" },
  ].map((f) => ({ ...f, key: `${f.dataset}|${f.test}|${f.ref}` }));
  return {
    id: "demo-report-prev",
    name: "تقرير الربع السابق (عرض تجريبي)",
    date: iso(today, -95),
    findings: [...kept, ...resolvedSamples].map((f) => ({
      key: f.key,
      dataset: f.dataset,
      test: f.test,
      ref: f.ref,
      severity: f.finalSeverity ?? f.severity,
      detail: f.detail,
    })),
    observations: [],
  };
}

/** متغيرات المعايرة الافتراضية للعرض (تطابق القيم الافتراضية للمنصة مع عقد وقود افتراضي). */
export const DEMO_PARAMS = { contractFuelPrice: 0.78 };
