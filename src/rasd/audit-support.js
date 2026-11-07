// @ts-nocheck
import Papa from "papaparse";
import { quantileSorted } from "simple-statistics";
import { mergeSeedReports } from "./seed-reports.js";
import { buildDemoStore, DEMO_PARAMS, buildDemoPreviousReport, DEMO_FLAG_KEY } from "./demo-data.js";
import { defaultParams, runAudit, allDatasets, auditSectors } from "./audit-engine.js";

export const import_papaparse = { default: Papa };
export function analyzeEntries(entries, rules) {
  const findings = [];
  const seen = /* @__PURE__ */ new Set();
  const bounds = /* @__PURE__ */ new Map();
  if (rules.outliers && Number(rules.sensitivity) > 0)
    for (const sector of new Set(entries.map((e) => e.sector))) {
      const values = entries
        .filter((e) => e.sector === sector)
        .map((e) => e.value)
        .sort((a, b) => a - b);
      if (values.length >= 4) {
        const q1 = quantileSorted(values, 0.25),
          q3 = quantileSorted(values, 0.75);
        if (q3 > q1)
          bounds.set(sector, q3 + Number(rules.sensitivity) * (q3 - q1));
      }
    }
  for (const entry of entries) {
    if (rules.limits && entry.value > entry.limit)
      findings.push({
        id: entry.id + "-limit",
        entry,
        kind: "limit",
        severity: "high",
      });
    else if (
      rules.outliers &&
      entry.value > (bounds.get(entry.sector) ?? Infinity)
    )
      findings.push({
        id: entry.id + "-outlier",
        entry,
        kind: "outlier",
        severity: "medium",
      });
    const signature = JSON.stringify([
      entry.sector,
      String(entry.label ?? "").trim(),
      entry.value,
      entry.date,
    ]);
    if (rules.duplicates && seen.has(signature))
      findings.push({
        id: entry.id + "-duplicate",
        entry,
        kind: "duplicate",
        severity: "medium",
      });
    seen.add(signature);
  }
  return findings;
}
export var riskLevel = (fs) =>
  fs.some((f) => f.severity === "high")
    ? "high"
    : fs.some((f) => f.severity === "medium")
      ? "medium"
      : fs.length
        ? "low"
        : "none";
var REPORTS = "rasd-audit-reports";
export function loadReports() {
  let raw = null;
  try {
    raw = localStorage.getItem(REPORTS);
    const v = JSON.parse(raw ?? "[]");
    return mergeSeedReports(Array.isArray(v) ? v : []);
  } catch {
    // JSON تالف: نحفظ النص الخام تحت مفتاح جانبي قبل أن يكتب الحفظ التالي فوقه، فلا تضيع تقارير المدقق بصمت.
    try {
      if (raw) localStorage.setItem(`${REPORTS}.corrupt-${Date.now()}`, raw);
    } catch {
      /* لا مساحة: لا نملك ما نفعله */
    }
    return mergeSeedReports([]);
  }
}
/** يعيد false إن تعذّر الحفظ (امتلاء التخزين) ليتمكّن المستدعي من تنبيه المستخدم. */
export function storeReports(r) {
  try {
    localStorage.setItem(REPORTS, JSON.stringify(r));
    return true;
  } catch {
    return false;
  }
}
/** بيانات العرض التجريبي كاملة: المخزن والمعايرة وملاحظات اليوم والتقرير السابق (يُستعمل من زر العرض ورابط ?demo=1). */
export function buildDemoBundle(now = Date.now()) {
  const store = buildDemoStore(now);
  const params = { ...defaultParams, ...DEMO_PARAMS };
  const base = runAudit(store, now, params).map((f) => {
    const d = allDatasets.find((x) => x.key === f.dataset);
    const row = store[f.dataset]?.[f.row] ?? {};
    const ref = d ? (row[d.fields[0].key] ?? "") : "";
    return { ...f, ref, key: `${f.dataset}|${f.test.trim()}|${String(ref).trim()}` };
  });
  return { store, params, base, report: buildDemoPreviousReport(base, now) };
}
/**
 * رابط العرض المباشر ?demo=1: إن كانت المنصة فارغة يكتب بيانات العرض في التخزين قبل فتح لوحة التدقيق، ثم ينظف الرابط.
 * لا يستبدل بيانات أي مستخدم أبدًا. يعيد true عند التحميل.
 */
export function seedDemoFromUrl() {
  try {
    const url = new URL(location.href);
    if (url.searchParams.get("demo") !== "1") return false;
    url.searchParams.delete("demo");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    const stored = JSON.parse(localStorage.getItem("rasd-audit-store") ?? "{}") ?? {};
    const hasData = Object.values(stored).some((r) => Array.isArray(r) && r.length) || (JSON.parse(localStorage.getItem(REPORTS) ?? "[]") ?? []).length > 0;
    if (hasData) return false;
    const { store, params, report } = buildDemoBundle();
    localStorage.setItem("rasd-audit-store", JSON.stringify(store));
    localStorage.setItem("rasd-audit-params", JSON.stringify(params));
    localStorage.setItem(REPORTS, JSON.stringify([report]));
    localStorage.setItem(DEMO_FLAG_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
// الخلايا القادمة من Excel قد تكون أرقاماً: لا نستدعي trim على غير نص.
export var findingKey = (dataset, test, ref) =>
  `${dataset}|${String(test ?? "").trim()}|${String(ref ?? "").trim()}`;
export var sevLabel = {
  high: "مرتفعة",
  medium: "متوسطة",
  low: "منخفضة",
  none: "لا ملاحظات",
};
export var sevClass = {
  high: "sev-high",
  medium: "sev-medium",
  low: "sev-low",
  none: "bg-success-soft text-success",
};
export var order = {
  high: 0,
  medium: 1,
  low: 2,
};
export var paramFields = [
  {
    key: "depositGraceDays",
    label: "المهلة المسموحة بين القبض النقدي والإيداع (يوم)",
    min: 1,
  },
  {
    key: "staleChequeDays",
    label: "عمر الشيك المعلق المتقادم (يوم)",
    min: 1,
  },
  {
    key: "materialityPct",
    label: "حد الأهمية النسبية لفروقات التسويات والعهد (%)",
    min: 0.01,
  },
  {
    key: "reviewIntervalDays",
    label: "أقصى فترة بين الجرد المفاجئ أو الاستعاضة (يوم)",
    min: 1,
  },
  {
    key: "overtimeMaxHours",
    label: "الحد الأقصى لساعات الإضافي للموظف (0 = غير مفعل)",
    min: 0,
  },
  {
    key: "fuelTolerancePct",
    label: "نسبة التسامح في فرق كميات المحروقات بين النظام والمحطة (%)",
    min: 0,
  },
  {
    key: "contractFuelPrice",
    label: "سعر اللتر حسب العقد عند غيابه من الكشف (0 = غير مفعل)",
    min: 0,
  },
  {
    key: "workStartHour",
    label: "بداية الدوام الرسمي (ساعة 0-23)",
    min: 0,
  },
  {
    key: "workEndHour",
    label: "نهاية الدوام الرسمي (ساعة 0-23)",
    min: 1,
  },
  {
    key: "licenseWarnDays",
    label: "مهلة التنبيه قبل انتهاء الترخيص أو التأمين (يوم)",
    min: 0,
  },
  {
    key: "maintenanceMultiple",
    label: "مضاعف تضخم تكلفة صيانة الآلية مقارنة بوسيط الأسطول",
    min: 1,
  },
  {
    key: "directPurchaseCeiling",
    label: "سقف الشراء المباشر السنوي لكل مورد (0 = غير مفعل، يُدخله المدقق من التشريع النافذ)",
    min: 0,
  },
  {
    key: "extensionMaxPct",
    label: "أقصى نسبة لتمديدات المدة المعتمدة من مدة العقد (%) (0 = غير مفعل، يُدخله المدقق من الشروط العامة للعقد)",
    min: 0,
  },
  {
    key: "splitWindowDays",
    label: "نافذة كشف تجزئة أوامر الشراء لنفس المورد (يوم)",
    min: 1,
  },
  {
    key: "concentrationPct",
    label: "نسبة تركّز المشتريات المباشرة على مورد واحد (%)",
    min: 1,
  },
  {
    key: "committeeRotationMax",
    label: "أقصى عدد عطاءات لعضو لجنة قبل وجوب التدوير",
    min: 2,
  },
  {
    key: "stagnantMonths",
    label: "مدة الركود المعيارية للمواد قبل التدوير أو الشطب (شهر)",
    min: 1,
  },
  {
    key: "overtimeConcentrationPct",
    label: "نسبة استحواذ موظف على إضافي القسم التي تستدعي التنبيه (%)",
    min: 1,
  },
];
export var datasetLabel = (k) =>
  k === "manual"
    ? "ملاحظة مدقق (يدوية)"
    : (auditSectors.flatMap((s) => s.datasets).find((d) => d.key === k)?.label ?? k);
export var sectorLabel = (k) => auditSectors.find((s) => s.key === k)?.label ?? k;
