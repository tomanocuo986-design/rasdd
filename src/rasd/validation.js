// @ts-nocheck
/**
 * التحقق من الحقول الجوهرية عند الإدخال والاستيراد.
 *
 * القائمة هنا تقتصر على حقول التعريف التي بدونها يتعذر تتبع السجل (رقم المستند، التاريخ، المبلغ، الطرف).
 * أما الحقول التي يكون غيابها نفسه مخالفة رقابية (المستند المعزز، المعتمِد، تقرير الإنجاز ...)
 * فلا تُرفض عند الإدخال كي لا تضيع الأدلة، بل يرصدها محرك الفحص runAudit كملاحظة «حقل جوهري ناقص».
 */
export const REQUIRED_BY_DATASET = {
  Receipt_Vouchers: ["voucher_no", "date", "amount", "payer"],
  Payment_Vouchers: ["voucher_no", "date", "amount", "payee"],
  Trial_Balance: ["account_no", "account_name"],
  Adjustments: ["entry_no", "date", "amount"],
  Bank_Reconciliations: ["bank_account", "statement_date"],
  Petty_Cash: ["box"],
  Clearing_Accounts: ["account_no", "date", "amount"],
  Revenue_Profession_Licenses: ["license_no", "owner", "fee_due"],
  Revenue_Property_Taxes_Regulation: ["parcel_no", "owner", "amount_due"],
  Revenue_Municipal_Properties_Leases: ["contract_no", "tenant"],
  Revenue_Daily_Fees: ["date", "amount_due"],
  HR_Establishment_Table: ["position_no", "title"],
  HR_Payroll_Sheets: ["employee_no", "name"],
  HR_Overtime_Bonuses: ["employee_no", "name", "period"],
  HR_Leaves_Records: ["employee_no", "name", "start", "end"],
  HR_Daily_Wagers: ["name", "period"],
  HR_Promotions_Increments: ["employee_no", "name"],
  HR_Retirees_Settlements: ["retiree_no", "name"],
  Fleet_Movement_Orders: ["order_no", "date", "vehicle"],
  Fleet_GPS_Tracking_Logs: ["vehicle", "datetime"],
  Fleet_Fuel_System_Logs: ["vehicle", "liters"],
  Fleet_Station_Fuel_Statements: ["vehicle", "datetime", "liters"],
  Fleet_Maintenance: ["vehicle", "date"],
  Fleet_Licensing_Insurance: ["plate"],
  Warehouse_Master_List: ["item_no"],
  Warehouses_Inbound_Vouchers: ["voucher_no", "date", "item_no"],
  Warehouses_Outbound_Vouchers: ["voucher_no", "date", "item_no"],
  Warehouses_Physical_Stocktaking: ["item_no"],
  Warehouses_Obsolete: ["item_no"],
  Advances_Temporary: ["advance_no", "employee", "amount"],
  Advances_Settlements: ["advance_no"],
  Advances_Permanent_Petty: ["advance_no", "custodian"],
  Advances_Overdue_Outstanding: ["advance_no", "beneficiary"],
  Direct_Purchases_Orders: ["po_no", "date", "supplier", "value"],
  Tenders_Records: ["tender_no", "date"],
  Engineering_BoQ_Master: ["project_no", "item_no"],
  Engineering_Site_Handover_Minutes: ["project_no", "contractor"],
  Engineering_Progress_Payments: ["project_no", "payment_no"],
  Engineering_Time_Extensions_Variations: ["project_no", "request_no"],
};

const blank = (v) => !String(v ?? "").trim();

/** مفاتيح الحقول الجوهرية لجدول: القائمة المعرفة أعلاه، وإلا أول حقل (المعرّف). */
export function requiredKeysOf(ds) {
  const keys = REQUIRED_BY_DATASET[ds.key];
  if (keys) return keys.filter((k) => ds.fields.some((f) => f.key === k));
  return ds.fields[0] ? [ds.fields[0].key] : [];
}

/** عناوين الحقول الجوهرية الناقصة في سجل واحد. */
export function missingRequired(ds, rec) {
  return requiredKeysOf(ds)
    .filter((k) => blank(rec?.[k]))
    .map((k) => ds.fields.find((f) => f.key === k)?.label ?? k);
}

/** يفصل السجلات المقبولة عن المرفوضة؛ المرفوض يُحتفظ به مع سبب الرفض ولا يضيع. */
export function partitionRecords(ds, records) {
  const accepted = [];
  const rejected = [];
  records.forEach((rec, index) => {
    const missing = missingRequired(ds, rec);
    if (missing.length) rejected.push({ index, rec, missing });
    else accepted.push(rec);
  });
  return { accepted, rejected };
}

/** نص التنبيه الفوري الذي يظهر للمدقق عند رفض سجل أو أكثر. */
export function rejectionMessage(ds, rejected, { max = 5 } = {}) {
  if (!rejected.length) return "";
  const lines = rejected
    .slice(0, max)
    .map((r) => `السجل ${r.index + 1}: ${r.missing.join("، ")}`);
  const more = rejected.length > max ? ` … و${rejected.length - max} سجل آخر` : "";
  return `تنبيه: رُفض ${rejected.length} سجل في «${ds.label}» لنقص حقول جوهرية — ${lines.join(" | ")}${more}.`;
}

/** CSV بالسجلات المرفوضة وأسباب رفضها، لتصحيحها وإعادة رفعها. */
export function rejectedToCsv(ds, rejected) {
  const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const head = ["رقم السجل في الملف", "الحقول الناقصة", ...ds.fields.map((f) => f.label)];
  const rows = rejected.map((r) => [
    r.index + 1,
    r.missing.join(" / "),
    ...ds.fields.map((f) => r.rec[f.key] ?? ""),
  ]);
  return [head, ...rows].map((row) => row.map(esc).join(",")).join("\n");
}
