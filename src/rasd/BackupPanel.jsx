import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  backupDue,
  daysSinceBackup,
  exportBackup,
  importBackup,
  isEncryptedBackupFile,
  storageUsage,
} from "./backup";
import { durableStats } from "./durable-storage";
import {
  getSyncConfig,
  listWorkspaces,
  newWorkspaceId,
  pullWorkspace,
  pushWorkspace,
  saveSyncConfig,
} from "./sync";

/** Backup / restore panel: encrypted file backup + optional mirroring to the central server database. */
export default function BackupPanel({ onRestored }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState("");
  const [cfg, setCfg] = useState(() => getSyncConfig());
  const [remote, setRemote] = useState([]);
  const [conflict, setConflict] = useState(false);
  const [durable, setDurable] = useState(null);
  const fileRef = useRef(null);
  const u = storageUsage();
  const pct = Math.min(100, Math.round(u.ratio * 100));
  const reload = () => setTimeout(() => (onRestored ? onRestored() : location.reload()), 800);
  const since = daysSinceBackup();

  useEffect(() => setCfg(getSyncConfig()), []);
  useEffect(() => {
    let alive = true;
    const read = () => durableStats().then((d) => alive && setDurable(d));
    read();
    const t = setInterval(read, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMsg(e?.message || "تعذّر تنفيذ العملية.");
    } finally {
      setBusy(false);
    }
  };

  const doExport = () =>
    run(async () => {
      const r = await exportBackup({ passphrase: pass || undefined });
      setMsg(
        `تم تنزيل النسخة الاحتياطية ${r.encrypted ? "المشفّرة " : "(غير مشفّرة) "}— ${r.keys} عنصر، ${r.regulations} نظام/تعليمات.`,
      );
    });

  const doImport = (file) =>
    run(async () => {
      if (!file) return;
      try {
        if ((await isEncryptedBackupFile(file)) && !pass) {
          setMsg("هذه النسخة مشفّرة: اكتب كلمة المرور في الحقل أعلاه ثم اخترها من جديد.");
          return;
        }
        const r = await importBackup(file, undefined, pass || undefined);
        setMsg(`تمت الاستعادة (${r.keys} عنصر، ${r.regulations} نظام/تعليمات). جارٍ إعادة التحميل…`);
        reload();
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });

  const update = (patch) => {
    saveSyncConfig(patch);
    setCfg(getSyncConfig());
  };

  const doPush = (force = false) =>
    run(async () => {
      if (!cfg.id) update({ id: newWorkspaceId() });
      try {
        const r = await pushWorkspace({ name: "مساحة عمل رصد", force });
        setConflict(false);
        setCfg(getSyncConfig());
        setMsg(`تم حفظ نسختك على الخادم (الإصدار ${r.version}).`);
      } catch (e) {
        if (e.status === 409) {
          setConflict(true);
          setMsg("النسخة على الخادم أحدث من نسختك. اختر: استعادة نسخة الخادم أو استبدالها بنسختك.");
        } else throw e;
      }
    });

  const doPull = () =>
    run(async () => {
      const r = await pullWorkspace();
      setMsg(`تم تنزيل نسخة الخادم (${r.keys} عنصر). جارٍ إعادة التحميل…`);
      reload();
    });

  const doList = () =>
    run(async () => {
      const list = await listWorkspaces();
      setRemote(list);
      setMsg(list.length ? `يوجد ${list.length} مساحة عمل على الخادم.` : "لا توجد مساحات عمل على الخادم بعد.");
    });

  return (
    <div className="mt-4 rounded-md border p-3 text-xs" dir="rtl">
      {backupDue() && (
        <div className="mb-2 rounded border border-destructive/40 p-2 text-destructive" role="status">
          {Number.isFinite(since)
            ? `مرّ ${since} يوم منذ آخر نسخة احتياطية.`
            : "لم تُنزَّل أي نسخة احتياطية بعد."}{" "}
          نزّل نسخة الآن لتفادي فقد الجلسة عند مسح ذاكرة المتصفح.
        </div>
      )}
      <div
        className="mb-2 rounded border p-2"
        role="status"
        data-testid="durable-status"
        style={{ borderColor: durable && !durable.available ? "var(--destructive, #b91c1c)" : undefined }}
      >
        <span className="font-semibold">التخزين المستدام: </span>
        {durable === null
          ? "جارٍ الفحص…"
          : durable.available
            ? `مفعّل — نتائج التدقيق والتقارير محفوظة في قاعدة المتصفح (IndexedDB) وتعود تلقائيًا في الجلسات القادمة · ${durable.keys} عنصر · ${Math.max(1, Math.round(durable.bytes / 1024))} ك.ب${durable.updatedAt ? ` · آخر حفظ ${new Date(durable.updatedAt).toLocaleTimeString("ar")}` : ""}${durable.persisted === true ? " · محميّ من الإخلاء التلقائي" : ""}`
            : "غير متاح في هذا المتصفح (وضع التصفح الخاص غالبًا): تُحفظ البيانات في localStorage فقط، فنزّل نسخة احتياطية دوريًا."}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">النسخ الاحتياطي</div>
          <div className="text-muted-foreground">
            البيانات تعمل محليًا في هذا المتصفح للسرعة والخصوصية. أضف كلمة مرور لتشفير الملف (AES-256) ثم احتفظ
            به أو انقله إلى جهاز آخر.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="كلمة مرور التشفير (8 أحرف+)"
            aria-label="كلمة مرور تشفير النسخة"
            className="h-8 rounded border bg-background px-2"
          />
          <Button variant="outline" size="sm" disabled={busy} onClick={doExport}>
            تنزيل نسخة احتياطية
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
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
          <span className="text-destructive"> — اقتربت من الحد، نزّل نسخة احتياطية وانقل البيانات.</span>
        )}
      </div>

      <details className="mt-3 border-t pt-2">
        <summary className="cursor-pointer font-semibold">المزامنة مع قاعدة البيانات المركزية (اختياري)</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={cfg.url}
            onChange={(e) => update({ url: e.target.value })}
            placeholder="عنوان الخادم (اتركه فارغًا للخادم الحالي)"
            aria-label="عنوان الخادم"
            className="h-8 min-w-48 rounded border bg-background px-2"
            dir="ltr"
          />
          <input
            type="password"
            value={cfg.token}
            onChange={(e) => update({ token: e.target.value })}
            placeholder="رمز الدخول"
            aria-label="رمز الدخول"
            className="h-8 rounded border bg-background px-2"
            dir="ltr"
          />
          <input
            value={cfg.id}
            onChange={(e) => update({ id: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") })}
            placeholder="معرّف مساحة العمل"
            aria-label="معرّف مساحة العمل"
            className="h-8 rounded border bg-background px-2"
            dir="ltr"
          />
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={cfg.auto} onChange={(e) => update({ auto: e.target.checked })} />
            مزامنة تلقائية كل 30 ثانية عند وجود تغيير
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => doPush(false)}>
            حفظ على الخادم
          </Button>
          <Button variant="outline" size="sm" disabled={busy || !cfg.id} onClick={doPull}>
            استعادة من الخادم
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={doList}>
            عرض مساحاتي
          </Button>
          {conflict && (
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => doPush(true)}>
              استبدال نسخة الخادم بنسختي
            </Button>
          )}
        </div>
        {remote.length > 0 && (
          <ul className="mt-2 list-disc pr-5">
            {remote.map((w) => (
              <li key={w.id}>
                <button type="button" className="underline" onClick={() => update({ id: w.id })}>
                  {w.name}
                </button>{" "}
                <span dir="ltr">({w.id}, v{w.version})</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-1 text-muted-foreground">
          يُرسل نص مساحة العمل عبر HTTPS ويُخزَّن مشفّرًا على مستوى الحقل في PostgreSQL. ملفات PDF الكبيرة لمكتبة
          الأنظمة تبقى في النسخة الاحتياطية المحلية.
        </div>
      </details>
      {msg && (
        <div className="mt-2" role="status">
          {msg}
        </div>
      )}
    </div>
  );
}
