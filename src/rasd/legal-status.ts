// حالة السند القانوني لكل ملاحظة + تأكيدات المدقق + الربط اليدوي بمواد المكتبة + حداثة ملفات المكتبة.
import { trackEvent } from "./audit-trail.js";
import type { Observation } from "./observations";

export type BasisStatus = "library" | "framework" | "auditor" | "none";

export const STATUS_LABEL: Record<BasisStatus, string> = {
  library: "سند من المكتبة",
  framework: "سند مدمج - يحتاج تحقق",
  auditor: "سند أدخله المدقق",
  none: "بلا سند",
};

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
const ls = (): Storage | undefined => (typeof localStorage === "undefined" ? undefined : localStorage);

export function basisStatus(o: Pick<Observation, "legalBasis">): BasisStatus {
  const s = o.legalBasis?.source;
  return s === "library" ? "library" : s === "framework" ? "framework" : s === "auditor" ? "auditor" : "none";
}

// ---------- تأكيدات المدقق (اعتماد/تصدير بلا سند من المكتبة) ----------
const OVERRIDE_KEY = "rasd-legal-overrides";

export interface Override {
  id: string; // معرّف الملاحظة
  status: BasisStatus; // حالة السند وقت التأكيد؛ إن تغيّرت الحالة لاحقًا يلزم تأكيد جديد
  action: "approve" | "export";
  at: string;
}

export function loadOverrides(storage: Storage | undefined = ls()): Override[] {
  try {
    const v: unknown = JSON.parse(storage?.getItem(OVERRIDE_KEY) ?? "[]");
    return Array.isArray(v) ? (v as Override[]) : [];
  } catch {
    return [];
  }
}

export function recordOverrides(
  list: Pick<Observation, "id" | "legalBasis">[],
  action: Override["action"],
  storage: Storage | undefined = ls(),
  now = new Date(),
): Override[] {
  const next = [
    ...loadOverrides(storage),
    ...list.map((o) => ({ id: o.id, status: basisStatus(o), action, at: now.toISOString() })),
  ];
  try {
    storage?.setItem(OVERRIDE_KEY, JSON.stringify(next));
  } catch {
    /* storage full */
  }
  if (storage === ls() && list.length) trackEvent("ui.legal.override", list.map((o) => o.id).join(",").slice(0, 280), `${action}; n=${list.length}`);
  return next;
}

/** تحتاج تأكيدًا صريحًا: السند ليس من المكتبة ولم يسبق تأكيد الملاحظة بنفس حالة السند. */
export function needsConfirmation(o: Pick<Observation, "id" | "legalBasis">, overrides: Override[]): boolean {
  const st = basisStatus(o);
  // سند كتبه المدقق بنفسه عند التعديل: مسؤوليته عليه فلا يحتاج تأكيدًا إضافيًا
  return st !== "library" && st !== "auditor" && !overrides.some((x) => x.id === o.id && x.status === st);
}

// ---------- الربط اليدوي: اختبار => مادة في ملف من المكتبة ----------
const LINK_KEY = "rasd-legal-links";

export interface LegalLink {
  docId: string;
  doc: string;
  article: string; // مثال: «المادة 12»، يكتبه المدقق
  excerpt: string; // نص المادة كما في الملف المرفوع
  at: string;
}

export const linkKey = (dataset: string, test: string) => `${dataset}|${String(test).trim()}`;

export function loadLinks(storage: Storage | undefined = ls()): Record<string, LegalLink> {
  try {
    const v: unknown = JSON.parse(storage?.getItem(LINK_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, LegalLink>) : {};
  } catch {
    return {};
  }
}

export function saveLinks(links: Record<string, LegalLink>, storage: Storage | undefined = ls()): void {
  try {
    storage?.setItem(LINK_KEY, JSON.stringify(links));
  } catch {
    /* storage full */
  }
}

/** السند الذي يضعه الربط اليدوي على المخالفة (بنفس شكل مطابقة المكتبة)، أو undefined. */
export function linkedRegulation(links: Record<string, LegalLink>, dataset: string, test: string) {
  const l = links[linkKey(dataset, test)];
  if (!l || !l.excerpt.trim()) return undefined;
  return { doc: l.doc, docId: l.docId, excerpt: l.article.trim() ? `${l.article.trim()} — ${l.excerpt.trim()}` : l.excerpt.trim() };
}

// ---------- حداثة ملفات المكتبة ----------
/** ما فوق هذا العمر (بالسنوات) من تاريخ النفاذ يُنبَّه عليه للتحقق من التعديلات اللاحقة (حد تقديري قابل للتغيير). */
export const STALE_YEARS = 3;

export interface Freshness {
  state: "unknown" | "ok" | "old";
  label: string;
}

export function docFreshness(d: { effectiveDate?: string }, now = new Date()): Freshness {
  const t = Date.parse(d.effectiveDate ?? "");
  if (!Number.isFinite(t)) return { state: "unknown", label: "تاريخ نفاذ النسخة غير محدد" };
  const years = (now.getTime() - t) / (365.25 * 86_400_000);
  if (years > STALE_YEARS) return { state: "old", label: `نسخة قديمة (أكثر من ${STALE_YEARS} سنوات): تحقق من التعديلات اللاحقة` };
  return { state: "ok", label: "" };
}
