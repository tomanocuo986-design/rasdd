import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

type Step = "checking" | "form" | "success" | "in";
type Mode = "login" | "register";

const ERR: Record<string, string> = {
  invalid_id: "الرقم الوظيفي غير صحيح (3 إلى 32 حرف أو رقم)",
  weak_password: "الباسورد لازم يكون 8 خانات على الأقل",
  mismatch: "الباسورد وتأكيده غير متطابقين",
  exists: "هذا الرقم الوظيفي مسجّل من قبل، سجّل دخول",
  wrong_credentials: "الرقم الوظيفي أو الباسورد غير صحيح",
  too_many_attempts: "محاولات كثيرة، حاول بعد 10 دقائق",
};

const idx = (i: number) => ({ "--i": i }) as CSSProperties;

function strength(pw: string) {
  let n = 0;
  if (pw.length >= 8) n++;
  if (pw.length >= 12) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw)) n++;
  return Math.min(n, 4);
}
const LEVELS = [
  { t: "", c: "var(--danger)" },
  { t: "ضعيف", c: "var(--danger)" },
  { t: "مقبول", c: "oklch(75% .15 70)" },
  { t: "جيد", c: "oklch(78% .15 130)" },
  { t: "قوي", c: "var(--success)" },
];
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const d = 70 + (i % 3) * 25;
  return {
    "--x": `${Math.cos(a) * d}px`,
    "--y": `${Math.sin(a) * d - 10}px`,
    "--r": `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
    "--c": ["var(--primary)", "var(--success)", "oklch(80% .1 230)", "var(--ink)"][i % 4],
  } as CSSProperties;
});

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
  const [mode, setMode] = useState<Mode>("register");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    fetch("/api/auth", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setStep(d.user ? "in" : "form"))
      .catch(() => setStep("form"));
  }, []);

  const fail = (key: string) => {
    setError(ERR[key] ?? "صار خطأ، حاول مرة ثانية");
    setShake((n) => n + 1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (mode === "register" && password !== confirm) return fail("mismatch");
    setBusy(true);
    const { ok, data } = await api(
      mode === "register"
        ? { action: "register", employeeId, password, confirm }
        : { action: "login", employeeId, password },
    );
    setBusy(false);
    if (!ok) return fail(data.error);
    setStep("success");
    setTimeout(() => setStep("in"), 1300);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setConfirm("");
  };

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
      <div className="auth-card" key={step}>
        <div className="auth-logo">رصد</div>

        {step === "form" && (
          <form onSubmit={submit} className="auth-form" key={shake} data-shake={shake > 0}>
            <h1 style={idx(0)}>{mode === "register" ? "إنشاء حساب" : "تسجيل الدخول"}</h1>
            <p className="auth-sub" style={idx(1)}>
              {mode === "register" ? "سجّل برقمك الوظيفي وباسورد من اختيارك" : "أدخل رقمك الوظيفي والباسورد"}
            </p>
            <label className="auth-field" style={idx(2)}>
              <span>الرقم الوظيفي</span>
              <input
                type="text"
                dir="ltr"
                inputMode="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="12345"
              />
            </label>
            <label className="auth-field" style={idx(3)}>
              <span>الباسورد</span>
              <div className="auth-pw">
                <input
                  type={showPw ? "text" : "password"}
                  dir="ltr"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label="إظهار الباسورد">
                  {showPw ? "إخفاء" : "إظهار"}
                </button>
              </div>
            </label>
            {mode === "register" && (
              <div className="auth-strength" style={{ ...idx(4), "--w": `${strength(password) * 25}%`, "--c": LEVELS[strength(password)].c } as CSSProperties}>
                <i />
              </div>
            )}
            {mode === "register" && (
              <p className="auth-strength-t">{password ? `قوة الباسورد: ${LEVELS[strength(password)].t}` : ""}</p>
            )}
            {mode === "register" && (
              <label className="auth-field auth-expand" style={idx(5)}>
                <span>تأكيد الباسورد</span>
                <input
                  type={showPw ? "text" : "password"}
                  dir="ltr"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </label>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="auth-btn" style={idx(6)} disabled={busy}>
              {busy ? (
                <span className="auth-dots">
                  <i />
                  <i />
                  <i />
                </span>
              ) : mode === "register" ? (
                "إنشاء الحساب"
              ) : (
                "دخول"
              )}
            </button>
            <div className="auth-links" style={{ ...idx(7), justifyContent: "center", marginTop: ".8rem" }}>
              <button type="button" onClick={() => switchMode(mode === "register" ? "login" : "register")}>
                {mode === "register" ? "عندي حساب؟ سجّل دخول" : "ما عندي حساب؟ أنشئ حساب"}
              </button>
            </div>
          </form>
        )}

        {step === "success" && (
          <div className="auth-form auth-success">
            <div className="auth-confetti" aria-hidden>
              {CONFETTI.map((s, i) => (
                <i key={i} style={s} />
              ))}
            </div>
            <svg viewBox="0 0 52 52" width="76" height="76" aria-hidden>
              <circle className="auth-check-circle" cx="26" cy="26" r="24" fill="none" />
              <path className="auth-check-mark" fill="none" d="M14 27l8 8 16-17" />
            </svg>
            <h1>{mode === "register" ? "تم إنشاء حسابك" : "أهلاً بعودتك"}</h1>
            <p className="auth-sub">جارٍ الدخول…</p>
          </div>
        )}
      </div>
    </div>
  );
}
