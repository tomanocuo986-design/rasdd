/**
 * مزامنة المكتبة الرسمية: الخادم يجلب الأنظمة من المواقع الرسمية ويحتفظ بها؛ هنا يستخرج المتصفح النص مرة واحدة
 * لكل نسخة (بنفس مسار الرفع اليدوي: استخراج النص ثم OCR عند الحاجة) ويحفظه في مكتبة الأنظمة المحلية بمعرّف
 * `official:<id>`. لا يرفع المستخدم شيئاً، ولا تُعاد القراءة ما دامت النسخة نفسها (sha) محفوظة.
 */
export const OFFICIAL_PREFIX = "official:";
export type OfficialDoc = {
  id: string;
  official?: boolean;
  name?: string;
  text?: string;
  sha?: string;
  sourceNote?: string;
  effectiveDate?: string;
  addedAt?: string;
  blob?: Blob;
};

export type SyncResult = {
  added: number;
  updated: number;
  failed: number;
  pending: number;
  /** بنود نسخها المحفوظة سليمة لكن الموقع الرسمي تغيّر عنها ولم تُعتمد النسخة الجديدة (تحتاج مراجعة بشرية). */
  review?: number;
  enabled: boolean;
};

export type SyncDeps = {
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  listRegulations: () => Promise<OfficialDoc[]>;
  saveRegulation: (d: OfficialDoc) => Promise<unknown>;
  deleteRegulation: (id: string) => Promise<unknown>;
  extractPdfPages: (
    file: File,
    opts?: { onStatus?: (m: string) => void },
  ) => Promise<{ text: string }>;
  onProgress?: (msg: string) => void;
  onChange?: () => void;
  sleep?: (ms: number) => Promise<void>;
  pollMs?: number;
  maxPolls?: number;
};

type CatalogItemJson = {
  id: string;
  title: string;
  site?: string;
  url: string;
  status: "ok" | "pending" | "error";
  sha?: string;
  fetchedAt?: string;
  effectiveDate?: string;
  warning?: string;
};

export const isOfficialDoc = (d: unknown): boolean =>
  typeof (d as { id?: unknown } | null)?.id === "string" &&
  (d as { id: string }).id.startsWith(OFFICIAL_PREFIX);

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * deps: { fetchImpl, listRegulations, saveRegulation, deleteRegulation, extractPdfPages,
 *         onProgress?(msg), onChange?(), sleep?, pollMs?, maxPolls? }
 * يعيد { added, updated, failed, pending, enabled }.
 */
export async function syncOfficialLibrary(deps: SyncDeps): Promise<SyncResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const pollMs = deps.pollMs ?? 4000;
  const maxPolls = deps.maxPolls ?? 40;
  const say = deps.onProgress ?? (() => {});
  const result: SyncResult = { added: 0, updated: 0, failed: 0, pending: 0, review: 0, enabled: true };
  const failedIds = new Set<string>();

  for (let poll = 0; poll <= maxPolls; poll++) {
    let data: { enabled?: boolean; items?: CatalogItemJson[] } | undefined;
    try {
      const r = await fetchImpl("/api/legal-library");
      if (!r.ok) return result;
      data = await r.json();
    } catch {
      return result;
    }
    if (data?.enabled === false) {
      result.enabled = false;
      return result;
    }
    const items: CatalogItemJson[] = Array.isArray(data?.items) ? data.items : [];
    const existing = await deps.listRegulations();
    const byId = new Map<string, OfficialDoc>(existing.map((d) => [d.id, d]));

    // بند أُزيل من القائمة => يُزال من المكتبة المحلية
    // قائمة فارغة (إعداد خاطئ أو عطل مؤقت) لا تعني «أُزيلت كل البنود»: لا نحذف شيئاً محلياً في هذه الحال.
    const keep = new Set(items.map((i) => OFFICIAL_PREFIX + i.id));
    for (const d of existing) {
      if (items.length && isOfficialDoc(d) && !keep.has(d.id)) {
        await deps.deleteRegulation(d.id);
        deps.onChange?.();
      }
    }

    for (const item of items) {
      if (item.status === "error" && !failedIds.has(item.id)) {
        result.failed++;
        failedIds.add(item.id);
        continue;
      }
      if (item.status !== "ok" || failedIds.has(item.id)) continue;
      const key = OFFICIAL_PREFIX + item.id;
      const have = byId.get(key);
      if (have && have.sha === item.sha && have.name === item.title) continue;
      try {
        say(`جارٍ قراءة «${item.title}»…`);
        const res = await fetchImpl(`/api/legal-library?file=${encodeURIComponent(item.id)}`);
        if (!res.ok) throw new Error("download");
        const servedSha = res.headers.get("x-sha");
        if (servedSha && item.sha && servedSha !== item.sha) throw new Error("sha-mismatch");
        const blob = await res.blob();
        const file = new File([blob], `${item.title}.pdf`, { type: "application/pdf" });
        const extracted = await deps.extractPdfPages(file, { onStatus: say });
        const day = new Date().toISOString().slice(0, 10);
        await deps.saveRegulation({
          id: key,
          official: true,
          name: item.title,
          text: extracted.text,
          addedAt: day,
          blob: file,
          ...(item.sha ? { sha: item.sha } : {}),
          // تاريخ النفاذ الذي أدخله المدقق يبقى كما هو عند تحديث النسخة
          ...(have?.effectiveDate || item.effectiveDate
            ? { effectiveDate: have?.effectiveDate || item.effectiveDate }
            : {}),
          sourceNote: `الموقع الرسمي: ${item.url} (${item.site || "موقع حكومي"}) — جُلب ${String(item.fetchedAt ?? day).slice(0, 10)}`,
        });
        if (have) result.updated++;
        else result.added++;
        deps.onChange?.();
      } catch {
        result.failed++;
        failedIds.add(item.id);
      }
    }

    result.pending = items.filter((i) => i.status === "pending").length;
    result.review = items.filter((i) => i.status === "ok" && i.warning).length;
    if (!result.pending) break;
    say(`بانتظار الخادم لجلب ${result.pending} من الأنظمة…`);
    await sleep(pollMs);
  }
  return result;
}

/** نص قصير لحالة المزامنة يُعرض في تبويب الأنظمة. */
export function syncSummary(r: SyncResult): string {
  if (!r.enabled) return "";
  const parts: string[] = [];
  if (r.added) parts.push(`أُضيف ${r.added}`);
  if (r.updated) parts.push(`حُدّث ${r.updated}`);
  if (r.failed) parts.push(`تعذّر ${r.failed}`);
  if (r.pending) parts.push(`بانتظار الجلب ${r.pending}`);
  if (r.review) parts.push(`تحتاج مراجعة ${r.review} (تغيّرت على الموقع الرسمي؛ النسخة المحفوظة لم تُستبدل)`);
  return parts.length ? `الأنظمة الرسمية: ${parts.join("، ")}.` : "";
}

// ---- تشغيل واحد مشترك: إن أُعيد تركيب الواجهة أثناء المزامنة لا تبدأ مزامنة ثانية بل تشترك في الأولى ----
type Sub = { onProgress: SyncDeps["onProgress"]; onChange: SyncDeps["onChange"] };
let running: Promise<SyncResult> | null = null;
const subs = new Set<Sub>();

/** يبدأ (أو يشارك في) المزامنة. يعيد { done: Promise<result>, stop() } — stop يوقف إرسال الرسائل لهذه الواجهة فقط. */
export function startOfficialSync(deps: SyncDeps): { done: Promise<SyncResult>; stop: () => void } {
  const mine: Sub = { onProgress: deps.onProgress, onChange: deps.onChange };
  subs.add(mine);
  if (!running) {
    running = syncOfficialLibrary({
      ...deps,
      onProgress: (m: string) => subs.forEach((s) => s.onProgress?.(m)),
      onChange: () => subs.forEach((s) => s.onChange?.()),
    }).finally(() => {
      running = null;
      subs.clear();
    });
  }
  return { done: running!, stop: () => void subs.delete(mine) };
}
