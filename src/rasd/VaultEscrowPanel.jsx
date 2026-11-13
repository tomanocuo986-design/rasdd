import { useState } from "react";
import { createEscrow, escrowInfo, revokeEscrow } from "./secure-vault.js";

const field =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";
const solid =
  "inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";
const outline =
  "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";

const MESSAGES = {
  wrong_password: "كلمة المرور غير صحيحة.",
  locked: "افتح رصد أولاً.",
  no_escrow: "لا يوجد مفتاح طوارئ لإلغائه.",
  unsupported: "هذا المتصفح لا يدعم التشفير المطلوب.",
};

const stamp = (iso) => {
  try {
    return new Date(iso).toLocaleString("ar-JO");
  } catch {
    return String(iso);
  }
};

export function VaultEscrowPanel({ defaultOpen = false, afterRecovery = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [info, setInfo] = useState(() => escrowInfo());
  const [password, setPassword] = useState("");
  const [issued, setIssued] = useState(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    if (busy || !password) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setPassword("");
      setInfo(escrowInfo());
    } catch (err) {
      setError(MESSAGES[err?.code] ?? "تعذّرت العملية.");
    } finally {
      setBusy(false);
    }
  };

  const issue = () =>
    run(async () => {
      const result = await createEscrow(password);
      setIssued(result);
      setSaved(false);
      setCopied(false);
    });

  const revoke = () =>
    run(async () => {
      await revokeEscrow(password);
      setIssued(null);
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const body = [
      "رصد — مفتاح الطوارئ للتخزين المشفّر",
      `المعرّف: ${issued.id}`,
      `تاريخ الإنشاء: ${stamp(issued.createdAt)}`,
      "",
      issued.code,
      "",
      "يُستعمل مرة واحدة على هذا الجهاز فقط، ويُبطَل فور استعماله.",
      "احفظ هذا الملف عند مدير النظام أو في مكان آمن، ولا تتركه على الجهاز نفسه.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `rasd-recovery-${issued.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const close = () => {
    setOpen(false);
    setIssued(null);
    setPassword("");
    setError("");
  };

  if (!open)
    return (
      <button
        type="button"
        data-testid="vault-escrow-open"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-24 z-50 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow hover:bg-accent"
      >
        مفتاح الطوارئ
      </button>
    );

  return (
    <div
      role="dialog"
      aria-label="مفتاح الطوارئ للتخزين المشفّر"
      data-testid="vault-escrow-panel"
      dir="rtl"
      className="fixed bottom-14 left-3 z-50 w-[min(94vw,26rem)] space-y-3 rounded-lg border border-border bg-background p-4 text-sm text-foreground shadow-lg"
    >
      <h2 className="text-base font-semibold">مفتاح الطوارئ</h2>
      {afterRecovery ? (
        <p data-testid="vault-escrow-after" className="text-sm">
          استُهلك مفتاح الطوارئ السابق وأُبطل. أنشئ مفتاحاً جديداً إن أردت الإبقاء على خيار
          الاسترداد.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        من يملك هذا المفتاح ويصل إلى هذا الجهاز يستطيع فتح بيانات التدقيق دون كلمة مرورك. احفظه عند
        مدير النظام أو في مكان آمن منفصل عن الجهاز. كل إنشاء أو استعمال أو إلغاء يُسجَّل في سجل
        التدقيق باسم الحساب المسجَّل الدخول.
      </p>
      <p data-testid="vault-escrow-status" className="text-xs">
        {info
          ? `مفتاح فعّال — المعرّف ${info.id}، أُنشئ ${stamp(info.createdAt)}.`
          : "لا يوجد مفتاح طوارئ حالياً."}
      </p>

      {issued ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-xs">يُعرض هذا المفتاح مرة واحدة فقط. انسخه أو نزّله الآن:</p>
          <code
            data-testid="vault-escrow-code"
            dir="ltr"
            className="block break-all rounded bg-muted px-2 py-2 font-mono text-xs"
          >
            {issued.code}
          </code>
          <div className="flex gap-2">
            <button type="button" className={outline} onClick={copy}>
              {copied ? "نُسخ" : "نسخ"}
            </button>
            <button type="button" className={outline} onClick={download}>
              تنزيل ملف
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              data-testid="vault-escrow-saved"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
            />
            حفظت المفتاح في مكان آمن
          </label>
          <button
            type="button"
            data-testid="vault-escrow-done"
            className={solid}
            disabled={!saved}
            onClick={close}
          >
            تم
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="password"
            autoComplete="current-password"
            aria-label="كلمة مرور التخزين للتأكيد"
            placeholder="كلمة مرور التخزين للتأكيد"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
          {error ? (
            <p role="alert" data-testid="vault-escrow-error" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="vault-escrow-create"
              className={solid}
              disabled={busy || !password}
              onClick={issue}
            >
              {info ? "استبدال المفتاح" : "إنشاء مفتاح"}
            </button>
            {info ? (
              <button
                type="button"
                data-testid="vault-escrow-revoke"
                className={outline}
                disabled={busy || !password}
                onClick={revoke}
              >
                إلغاء المفتاح
              </button>
            ) : null}
            <button type="button" className={outline} onClick={close}>
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
