/**
 * مزامنة المكتبة الرسمية: الخادم يجلب الأنظمة من المواقع الرسمية ويحتفظ بها؛ هنا يستخرج المتصفح النص مرة واحدة
 * لكل نسخة (بنفس مسار الرفع اليدوي: استخراج النص ثم OCR عند الحاجة) ويحفظه في مكتبة الأنظمة المحلية بمعرّف
 * `official:<id>`. لا يرفع المستخدم شيئاً، ولا تُعاد القراءة ما دامت النسخة نفسها (sha) محفوظة.
 */
export const OFFICIAL_PREFIX = "official:";
export const isOfficialDoc = (d) => typeof d?.id === "string" && d.id.startsWith(OFFICIAL_PREFIX);

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * deps: { fetchImpl, listRegulations, saveRegulation, deleteRegulation, extractPdfPages,
 *         onProgress?(msg), onChange?(), sleep?, pollMs?, maxPolls? }
 * يعيد { added, updated, failed, pending, enabled }.
 */
export async function syncOfficialLibrary(deps) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const pollMs = deps.pollMs ?? 4000;
  const maxPolls = deps.maxPolls ?? 40;
  const say = deps.onProgress ?? (() => {});
  const result = { added: 0, updated: 0, failed: 0, pending: 0, enabled: true };
  const failedIds = new Set();

  for (let poll = 0; poll <= maxPolls; poll++) {
    let data;
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
    const items = Array.isArray(data?.items) ? data.items : [];
    const existing = await deps.listRegulations();
    const byId = new Map(existing.map((d) => [d.id, d]));

    // بند أُزيل من القائمة => يُزال من المكتبة المحلية
    const keep = new Set(items.map((i) => OFFICIAL_PREFIX + i.id));
    for (const d of existing) {
      if (isOfficialDoc(d) && !keep.has(d.id)) {
        await deps.deleteRegulation(d.id);
        deps.onChange?.();
      }
    }

    for (const item of items) {
      if (item.status !== "ok" || failedIds.has(item.id)) continue;
      const key = OFFICIAL_PREFIX + item.id;
      const have = byId.get(key);
      if (have && have.sha === item.sha && have.name === item.title) continue;
      try {
        say(`جارٍ قراءة «${item.title}»…`);
        const res = await fetchImpl(`/api/legal-library?file=${encodeURIComponent(item.id)}`);
        if (!res.ok) throw new Error("download");
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
          sha: item.sha,
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
    if (!result.pending) break;
    say(`بانتظار الخادم لجلب ${result.pending} من الأنظمة…`);
    await sleep(pollMs);
  }
  return result;
}

/** نص قصير لحالة المزامنة يُعرض في تبويب الأنظمة. */
export function syncSummary(r) {
  if (!r.enabled) return "";
  const parts = [];
  if (r.added) parts.push(`أُضيف ${r.added}`);
  if (r.updated) parts.push(`حُدّث ${r.updated}`);
  if (r.failed) parts.push(`تعذّر ${r.failed}`);
  if (r.pending) parts.push(`بانتظار الجلب ${r.pending}`);
  return parts.length ? `الأنظمة الرسمية: ${parts.join("، ")}.` : "";
}

// ---- تشغيل واحد مشترك: إن أُعيد تركيب الواجهة أثناء المزامنة لا تبدأ مزامنة ثانية بل تشترك في الأولى ----
let running = null;
const subs = new Set();

/** يبدأ (أو يشارك في) المزامنة. يعيد { done: Promise<result>, stop() } — stop يوقف إرسال الرسائل لهذه الواجهة فقط. */
export function startOfficialSync(deps) {
  const mine = { onProgress: deps.onProgress, onChange: deps.onChange };
  subs.add(mine);
  if (!running) {
    running = syncOfficialLibrary({
      ...deps,
      onProgress: (m) => subs.forEach((s) => s.onProgress?.(m)),
      onChange: () => subs.forEach((s) => s.onChange?.()),
    }).finally(() => {
      running = null;
    });
  }
  return { done: running, stop: () => subs.delete(mine) };
}
