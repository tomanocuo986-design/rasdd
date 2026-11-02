import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "checking" | "credentials" | "otp" | "success" | "in";

const ERR: Record<string, string> = {
  invalid_email: "الإيميل غير صحيح",
  weak_password: "الباسورد لازم يكون 8 خانات على الأقل",
  wrong_password: "الباسورد غير صحيح",
  too_soon: "انتظر شوي قبل ما تطلب كود جديد",
  email_failed: "تعذّر إرسال الكود، تأكد من إعدادات الإيميل",
  expired: "انتهت صلاحية الكود، اطلب كود جديد",
  wrong_code: "الكود غير صحيح",
  too_many_attempts: "محاولات كثيرة، اطلب كود جديد",
};

async function api(body: object) {
  const r = await fetch("/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const verifying = useRef(false);

  useEffect(() => {
    fetch("/api/auth", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setStep(d.user ? "in" : "credentials"))
      .catch(() => setStep("credentials"));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const fail = (key: string) => {
    setError(ERR[key] ?? "صار خطأ، حاول مرة ثانية");
    setShake((n) => n + 1);
  };

  const start = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      if (busy) return;
      setBusy(true);
      setError("");
      const { ok, data } = await api({ action: "start", email, password });
      setBusy(false);
      if (!ok) return fail(data.error);
      setChallenge(data.challenge);
      setMode(data.mode);
      setCode("");
      setCooldown(30);
      setStep("otp");
    },
    [busy, email, password],
  );

  const verify = useCallback(
    async (value: string) => {
      if (verifying.current) return;
      verifying.current = true;
      setBusy(true);
      setError("");
      const { ok, data } = await api({ action: "verify", challenge, code: value });
      setBusy(false);
      verifying.current = false;
      if (!ok) {
        setCode("");
        return fail(data.error);
      }
      setStep("success");
      setTimeout(() => setStep("in"), 1300);
    },
    [challenge],
  );

  if (step === "in") return <>{children}</>;
  if (step === "checking")
    return (
      <div className="auth-screen">
        <div className="auth-spinner" />
      </div>
    );

  return (
    <div className="auth-screen" dir="rtl">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-card" key={step === "credentials" ? "c" : step === "otp" ? "o" : "s"}>
        <div className="auth-logo">رصد</div>

        {step === "credentials" && (
          <form onSubmit={start} className="auth-form" key={shake} data-shake={shake > 0}>
            <h1>تسجيل الدخول</h1>
            <p className="auth-sub">أدخل إيميلك وباسوردك، وبنرسل لك كود تحقق</p>
            <label className="auth-field">
              <span>الإيميل</span>
              <input type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </label>
            <label className="auth-field">
              <span>الباسورد</span>
              <div className="auth-pw">
                <input type={showPw ? "text" : "password"} dir="ltr" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label="إظهار الباسورد">
                  {showPw ? "إخفاء" : "إظهار"}
                </button>
              </div>
            </label>
            <p className="auth-hint">حساب جديد؟ أدخل بياناتك وينشأ الحساب تلقائياً بعد التحقق.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-btn" disabled={busy}>
              {busy ? <span className="auth-dots"><i /><i /><i /></span> : "إرسال كود التحقق"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <div className="auth-form" key={shake} data-shake={shake > 0}>
            <h1>أدخل كود التحقق</h1>
            <p className="auth-sub">
              أرسلنا كود من 6 أرقام إلى <b dir="ltr">{email}</b>
            </p>
            <div className="auth-otp" dir="ltr" data-busy={busy}>
              <InputOTP
                maxLength={6}
                value={code}
                autoFocus
                disabled={busy}
                inputMode="numeric"
                onChange={(v) => {
                  setCode(v.replace(/\D/g, ""));
                  setError("");
                }}
                onComplete={verify}
              >
                <InputOTPGroup className="auth-otp-group">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="auth-otp-slot" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {busy && <p className="auth-sub"><span className="auth-dots"><i /><i /><i /></span></p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="auth-links">
              <button type="button" disabled={cooldown > 0 || busy} onClick={() => start()}>
                {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown}ث` : "إعادة إرسال الكود"}
              </button>
              <button type="button" onClick={() => { setStep("credentials"); setError(""); }}>تغيير الإيميل</button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="auth-form auth-success">
            <svg viewBox="0 0 52 52" width="76" height="76" aria-hidden>
              <circle className="auth-check-circle" cx="26" cy="26" r="24" fill="none" />
              <path className="auth-check-mark" fill="none" d="M14 27l8 8 16-17" />
            </svg>
            <h1>{mode === "signup" ? "تم إنشاء حسابك" : "أهلاً بعودتك"}</h1>
            <p className="auth-sub">جارٍ الدخول…</p>
          </div>
        )}
      </div>
    </div>
  );
}
