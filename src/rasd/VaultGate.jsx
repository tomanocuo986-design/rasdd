import { useCallback, useEffect, useState } from "react";
import {
  configureVault,
  createVault,
  getCorrupted,
  hasVault,
  isSupported,
  isUnlocked,
  lockVault,
  onVaultLock,
  resetVault,
  unlockVault,
} from "./secure-vault.js";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const OFF = env.VITE_VAULT === "off" || env.MODE === "test";
const IDLE = Number(env.VITE_VAULT_IDLE_MIN) > 0 ? Number(env.VITE_VAULT_IDLE_MIN) : 15;
const MIN_LENGTH = 10;

if (OFF) configureVault({ enabled: false });

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";
const primary =
  "inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

const MESSAGES = {
  wrong_password: "كلمة المرور غير صحيحة.",
  weak_password: `كلمة المرور قصيرة (الحد الأدنى ${MIN_LENGTH} أحرف).`,
  unsupported: "هذا المتصفح لا يدعم التشفير المطلوب.",
};

export function VaultGate({ children }) {
  const [phase, setPhase] = useState("boot");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [resetting, setResetting] = useState(false);
  const [resetWord, setResetWord] = useState("");
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    if (OFF) return setPhase("open");
    if (!isSupported()) return setPhase("unsupported");
    setPhase(isUnlocked() ? "open" : hasVault() ? "unlock" : "create");
  }, []);

  useEffect(
    () =>
      onVaultLock((reason) => {
        setPassword("");
        setConfirm("");
        setError("");
        setNotice(reason === "idle" ? "قُفل رصد تلقائيًا لعدم النشاط. أدخل كلمة المرور للمتابعة." : "");
        setPhase(hasVault() ? "unlock" : "create");
      }),
    [],
  );

  useEffect(() => {
    if (waitUntil <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [waitUntil]);

  useEffect(() => {
    const onBad = (e) => {
      const list = Array.isArray(e.detail) ? e.detail : [];
      setWarnings((w) => [
        ...w,
        `تعذّر التحقق من سلامة ${list.length} من الأنظمة المخزّنة فاستُبعدت: ${list.map((x) => x.name || x.id).join("، ")}`,
      ]);
    };
    const onErr = () =>
      setWarnings((w) => [...w, "تعذّر حفظ بعض البيانات المشفّرة (قد تكون مساحة المتصفح ممتلئة)."]);
    window.addEventListener("rasd-vault-integrity", onBad);
    window.addEventListener("rasd-vault-error", onErr);
    return () => {
      window.removeEventListener("rasd-vault-integrity", onBad);
      window.removeEventListener("rasd-vault-error", onErr);
    };
  }, []);

  const submit = useCallback(
    async (e) => {
      e.preventDefault();
      if (busy || waitUntil > Date.now()) return;
      setError("");
      if (phase === "create") {
        if (password.length < MIN_LENGTH) return setError(MESSAGES.weak_password);
        if (password !== confirm) return setError("كلمتا المرور غير متطابقتين.");
      }
      setBusy(true);
      try {
        if (phase === "create") await createVault(password, { idleMinutes: IDLE });
        else await unlockVault(password, { idleMinutes: IDLE });
        setPassword("");
        setConfirm("");
        setFails(0);
        const bad = getCorrupted();
        setWarnings(
          bad.length ? [`تعذّر التحقق من سلامة ${bad.length} من البيانات المحلية فاستُبعدت: ${bad.join("، ")}`] : [],
        );
        setPhase("open");
      } catch (err) {
        setError(MESSAGES[err?.code] ?? "تعذّر فتح التخزين المشفّر.");
        if (err?.code === "wrong_password") {
          const n = fails + 1;
          setFails(n);
          if (n >= 3) {
            const t = Date.now() + Math.min(30000, 1000 * 2 ** (n - 3));
            setWaitUntil(t);
            setNow(Date.now());
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, confirm, fails, password, phase, waitUntil],
  );

  const doReset = useCallback(async () => {
    setBusy(true);
    try {
      await resetVault();
      setResetting(false);
      setResetWord("");
      setPassword("");
      setConfirm("");
      setError("");
      setFails(0);
      setNotice("مُسحت البيانات المحلية المشفّرة. أنشئ كلمة مرور جديدة.");
      setPhase("create");
    } finally {
      setBusy(false);
    }
  }, []);

  if (phase === "open")
    return (
      <>
        {OFF ? null : (
          <button
            type="button"
            data-testid="vault-lock"
            onClick={() => lockVault("manual")}
            className="fixed bottom-3 left-3 z-50 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow hover:bg-accent"
          >
            قفل رصد
          </button>
        )}
        {warnings.length ? (
          <div
            role="alert"
            data-testid="vault-warning"
            dir="rtl"
            className="fixed top-3 left-1/2 z-50 w-[min(92vw,36rem)] -translate-x-1/2 rounded-md border border-destructive bg-background p-3 text-sm text-foreground shadow"
          >
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
            <button type="button" className="mt-2 text-xs underline" onClick={() => setWarnings([])}>
              إغلاق
            </button>
          </div>
        ) : null}
        {children}
      </>
    );

  if (phase === "boot") return null;

  if (phase === "unsupported")
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <p role="alert" className="max-w-md text-center text-sm">
          لا يمكن تشغيل رصد: هذا المتصفح أو العنوان لا يدعم التشفير (يلزم HTTPS أو localhost ومتصفح حديث).
        </p>
      </div>
    );

  const creating = phase === "create";
  const remaining = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6 shadow-sm">
        <h1 className="text-lg font-semibold">{creating ? "إنشاء كلمة مرور التخزين المشفّر" : "فتح التخزين المشفّر"}</h1>
        <p className="text-sm text-muted-foreground">
          {creating
            ? "تُشفَّر بيانات التدقيق والملاحظات المعتمدة والأنظمة المحفوظة على هذا الجهاز بكلمة المرور هذه. لا يمكن استرجاعها إن نُسيت."
            : "أدخل كلمة المرور لفك تشفير بيانات هذا الجهاز."}
        </p>
        {notice ? (
          <p data-testid="vault-notice" className="text-sm text-foreground">
            {notice}
          </p>
        ) : null}
        <input
          type="password"
          autoComplete={creating ? "new-password" : "current-password"}
          aria-label="كلمة المرور"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
          autoFocus
        />
        {creating ? (
          <input
            type="password"
            autoComplete="new-password"
            aria-label="تأكيد كلمة المرور"
            placeholder="تأكيد كلمة المرور"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={field}
          />
        ) : null}
        {error ? (
          <p role="alert" data-testid="vault-error" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {remaining > 0 ? <p className="text-xs text-muted-foreground">أعد المحاولة بعد {remaining} ثانية.</p> : null}
        <button type="submit" className={primary} disabled={busy || remaining > 0 || !password}>
          {busy ? "جارٍ التحقق…" : creating ? "إنشاء وفتح" : "فتح"}
        </button>
        {!creating ? (
          resetting ? (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs text-destructive">
                سيُمسح كل ما شُفّر على هذا الجهاز (بيانات التدقيق والملاحظات والأنظمة المحفوظة) ولا يمكن التراجع. اكتب كلمة «مسح» للتأكيد.
              </p>
              <input
                aria-label="تأكيد المسح"
                value={resetWord}
                onChange={(e) => setResetWord(e.target.value)}
                className={field}
              />
              <button
                type="button"
                data-testid="vault-reset-confirm"
                disabled={busy || resetWord.trim() !== "مسح"}
                onClick={doReset}
                className="inline-flex h-9 w-full items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground disabled:opacity-50"
              >
                مسح البيانات المحلية
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-testid="vault-reset"
              className="text-xs text-muted-foreground underline"
              onClick={() => setResetting(true)}
            >
              نسيت كلمة المرور؟
            </button>
          )
        ) : null}
      </form>
    </div>
  );
}
