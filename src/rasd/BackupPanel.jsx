import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { exportBackup, importBackup, storageUsage } from "./backup";

/** Backup / restore panel: data lives only in this browser, so this is the safety net. */
export default function BackupPanel({ onRestored }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const u = storageUsage();
  const pct = Math.min(100, Math.round(u.ratio * 100));

  async function doExport() {
    setBusy(true);
    try {
      const r = await exportBackup();
      setMsg(`تم تنزيل النسخة الاحتياطية (${r.keys} عنصر، ${r.regulations} نظام/تعليمات).`);
    } catch {
      setMsg("تعذر إنشاء النسخة الاحتياطية.");
    } finally {
      setBusy(false);
    }
  }

  async function doImport(file) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await importBackup(file);
      setMsg(`تمت الاستعادة (${r.keys} عنصر، ${r.regulations} نظام/تعليمات). جارٍ إعادة التحميل…`);
      setTimeout(() => (onRestored ? onRestored() : location.reload()), 800);
    } catch (e) {
      setMsg(e?.message || "تعذرت استعادة النسخة الاحتياطية.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 rounded-md border p-3 text-xs" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">النسخ الاحتياطي</div>
          <div className="text-muted-foreground">
            البيانات محفوظة في هذا المتصفح فقط. احتفظ بنسخة احتياطية دورية لتفادي الفقد عند مسح
            المتصفح أو تغيير الجهاز.
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={doExport}>
            تنزيل نسخة احتياطية
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            استعادة نسخة
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => doImport(e.target.files?.[0])}
          />
        </div>
      </div>
      <div className="mt-2">
        مساحة التخزين المستخدمة: {(u.bytes / 1024 / 1024).toFixed(2)} MB من نحو 5 MB ({pct}%)
        {pct >= 80 && (
          <span className="text-destructive">
            {" "}
            — اقتربت من الحد، نزّل نسخة احتياطية وانقل البيانات.
          </span>
        )}
      </div>
      {msg && <div className="mt-1">{msg}</div>}
    </div>
  );
}
