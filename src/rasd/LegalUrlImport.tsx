// @ts-nocheck
import { useEffect, useState } from "react";

const FALLBACK_HOSTS = [
  "mola.gov.jo",
  "csb.gov.jo",
  "mof.gov.jo",
  "gtd.gov.jo",
  "modee.gov.jo",
  "portal.jordan.gov.jo",
  "spac.gov.jo",
];

/** اسم الملف من آخر جزء في مسار الرابط (يفكّ الترميز العربي ويحذف .pdf). */
export function nameFromUrl(u) {
  try {
    const last = new URL(u).pathname.split("/").filter(Boolean).pop() ?? "";
    let n = last;
    try {
      n = decodeURIComponent(last);
    } catch {
      /* يبقى كما هو */
    }
    n = n
      .replace(/\.pdf$/i, "")
      .replace(/[_]+/g, " ")
      .trim();
    return n || "نظام من رابط";
  } catch {
    return "نظام من رابط";
  }
}

/**
 * يضيف ملف PDF من رابط موقع رسمي مسموح (الخادم هو من يجلبه ويفحصه). بعد الجلب يُسلَّم الملف إلى `onFile`
 * ليمرّ بنفس مسار الرفع اليدوي: استخراج النص ثم الحفظ في المكتبة المحلية.
 * onFile(file: File, meta: { sourceNote: string }) => Promise<void>
 */
export function LegalUrlImport({ onFile, disabled }) {
  const [url, setUrl] = useState("");
  const [hosts, setHosts] = useState(FALLBACK_HOSTS);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/legal-fetch")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        if (Array.isArray(d.hosts) && d.hosts.length) setHosts(d.hosts);
        if (d.enabled === false) setEnabled(false);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /** يجلب رابطاً واحداً ويسلّمه إلى onFile. يعيد true عند النجاح. title اختياري ليكون اسم الملف في المكتبة. */
  async function importOne(value, title) {
    const res = await fetch("/api/legal-fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: value }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw Object.assign(new Error(d?.error || "تعذّر جلب الملف."), { fromServer: true });
    }
    const blob = await res.blob();
    let finalUrl = value;
    try {
      finalUrl = decodeURIComponent(res.headers.get("x-final-url") || value);
    } catch {
      /* نستخدم الرابط المُدخَل */
    }
    const file = new File([blob], `${title || nameFromUrl(finalUrl)}.pdf`, {
      type: "application/pdf",
    });
    const day = new Date().toISOString().slice(0, 10);
    await onFile(file, { sourceNote: `مجلوب من ${finalUrl} بتاريخ ${day}` });
  }

  async function go() {
    const value = url.trim();
    if (!value) return;
    setErr("");
    setLoading(true);
    try {
      await importOne(value);
      setUrl("");
    } catch (e) {
      setErr(e?.fromServer ? e.message : "تعذّر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) return null;
  return (
    <div className="mt-3 grid gap-1 text-xs" data-testid="legal-url-import">
      <div className="flex flex-wrap items-center gap-2">
        <input
          dir="ltr"
          className="min-w-[14rem] flex-1 rounded-md border px-2 py-1"
          placeholder="https://www.gtd.gov.jo/…/file.pdf"
          aria-label="رابط ملف PDF للنظام أو التعليمات"
          value={url}
          disabled={disabled || loading}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
        />
        <button
          type="button"
          className="rounded-md border px-3 py-1"
          disabled={disabled || loading || !url.trim()}
          onClick={go}
        >
          {loading ? "جارٍ الجلب…" : "إضافة من رابط"}
        </button>
      </div>
      <p className="text-muted-foreground">
        رابط ملف PDF مباشر من المواقع الرسمية فقط: <span dir="ltr">{hosts.join("، ")}</span>
      </p>
      {err && (
        <p className="text-danger" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
