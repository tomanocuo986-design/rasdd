// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, Download, FolderOpen, KeyRound, Maximize2, Minimize2, Pause, Play, Rocket, ShieldCheck, X } from "lucide-react";

const MIN = 10;
const VIDEO_URL = "/offline-guide.mp4"; // اختياري: ضع الفيديو في public/offline-guide.mp4 فيظهر تلقائياً
const SLIDE_MS = 3600;

// موضع الزر العائم: فوق زر الذكاء الاصطناعي. عدّل هذين الرقمين إن تداخل مع زر المساعد.
const FAB_BOTTOM = "6.5rem";
const FAB_INLINE_END = "1.25rem";

const SLIDES = [
  { Icon: KeyRound, title: "اختر كلمة مرور للحزمة", text: "تحمي ملف التطبيق. لا يمكن استرجاعها، فاحفظها في مكان آمن." },
  { Icon: Download, title: "نزّل الملف", text: "يُجهَّز rasd-offline.zip ويبدأ تنزيله تلقائياً." },
  { Icon: FolderOpen, title: "فك الضغط وشغّل", text: "اضغط Extract All ثم افتح Start-Rasd.bat (يلزم Node.js 20 أو أحدث مرة واحدة)." },
  { Icon: ShieldCheck, title: "اكتب كلمة المرور", text: "تكتبها في النافذة السوداء وتظهر نجوماً، ثم يفتح المتصفح تلقائياً." },
  { Icon: Rocket, title: "أنشئ أول حساب", text: "استخدم رمز الدعوة (Invite code) الظاهر في النافذة السوداء." },
];

const CSS = `
@keyframes od-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes od-pop { from { opacity: 0; transform: translateY(14px) scale(.96) } to { opacity: 1; transform: none } }
@keyframes od-step { from { opacity: 0; transform: translateX(-18px) } to { opacity: 1; transform: none } }
@keyframes od-slide { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes od-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes od-fill { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes od-indet { 0% { transform: translateX(-100%) } 100% { transform: translateX(260%) } }
@keyframes od-draw { to { stroke-dashoffset: 0 } }
@keyframes od-ring { from { transform: scale(.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes od-blink { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
.od-fab { position: fixed; z-index: 40; transition: transform .2s ease, box-shadow .2s ease, opacity .2s; animation: od-pop .45s ease both; }
.od-fab:not(:disabled):hover { transform: translateY(-2px) scale(1.05); }
.od-fab:not(:disabled):active { transform: scale(.96); }
.od-overlay { animation: od-fade .22s ease both; }
.od-card { animation: od-pop .32s cubic-bezier(.2,.8,.2,1) both; }
.od-step { animation: od-step .3s ease both; }
.od-slide { animation: od-slide .4s ease both; }
.od-icon { animation: od-float 2.6s ease-in-out infinite; }
.od-progress > i { display: block; height: 100%; transform-origin: right; animation: od-fill var(--od-ms, 3600ms) linear both; }
.od-bar { position: relative; overflow: hidden; }
.od-bar > i { position: absolute; inset-block: 0; width: 40%; border-radius: 999px; animation: od-indet 1.2s ease-in-out infinite; }
.od-check circle { animation: od-ring .4s ease both; transform-origin: center; }
.od-check path { stroke-dasharray: 40; stroke-dashoffset: 40; animation: od-draw .45s .25s ease forwards; }
.od-blink { animation: od-blink 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .od-fab, .od-overlay, .od-card, .od-step, .od-slide, .od-icon, .od-progress > i, .od-bar > i, .od-check circle, .od-check path, .od-blink { animation: none !important; }
  .od-check path { stroke-dashoffset: 0; }
  .od-bar > i { width: 100%; }
}
`;

function strength(pw) {
  let s = 0;
  if (pw.length >= MIN) s++;
  if (pw.length >= 14) s++;
  if (/[a-z\u0621-\u064a]/i.test(pw) && /\d/.test(pw)) s++;
  if (/[^\w\s\u0621-\u064a]/.test(pw) || (/[A-Z]/.test(pw) && /[a-z]/.test(pw))) s++;
  return Math.min(s, 4);
}
const STRENGTH_LABEL = ["ضعيفة", "ضعيفة", "مقبولة", "جيدة", "قوية"];
const STRENGTH_COLOR = ["#ef4444", "#ef4444", "#f59e0b", "#22c55e", "#16a34a"];

/** شرح متحرك بخطوات تتبدّل تلقائياً. */
function Guide() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setI((n) => (n + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, playing]);

  const { Icon, title, text } = SLIDES[i];
  return (
    <div className="space-y-3" data-testid="offline-guide">
      {
        <div className="relative overflow-hidden rounded-xl border bg-accent/40 p-5">
          <div key={i} className="od-slide flex min-h-[150px] flex-col items-center justify-center gap-2 text-center">
            <div className="od-icon flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Icon size={28} />
            </div>
            <div className="text-xs text-muted-foreground">
              الخطوة {i + 1} من {SLIDES.length}
            </div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="max-w-xs text-xs leading-6 text-muted-foreground">{text}</p>
          </div>
          <div className="od-progress mt-3 h-1 overflow-hidden rounded-full bg-border">
            <i
              key={`${i}-${playing}`}
              className="bg-primary"
              style={{ "--od-ms": `${SLIDE_MS}ms`, animationPlayState: playing ? "running" : "paused" }}
            />
          </div>
        </div>
      }

      {
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((_, n) => (
              <button
                key={n}
                type="button"
                aria-label={`الخطوة ${n + 1}`}
                onClick={() => setI(n)}
                className={`h-2 rounded-full transition-all duration-300 ${n === i ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground"}`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
            onClick={() => setPlaying((p) => !p)}
            className="flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:bg-accent"
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
        </div>
      }
    </div>
  );
}

/** زر «تحميل النسخة بدون إنترنت»: عائم فوق زر المساعد، يفتح معالجاً متحركاً (شرح ← كلمة مرور ← تجهيز ← تم). */
export function OfflineDownload() {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState("guide"); // video (اختياري) | guide | password | working | done
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [hasVideo, setHasVideo] = useState(false);
  const [big, setBig] = useState(false);
  const firstField = useRef(null);
  const videoBox = useRef(null);
  const busy = stage === "working";

  useEffect(() => {
    let alive = true;
    fetch("/api/offline-package")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setStatus(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // فيديو الشرح خطوة مستقلة اختيارية: تظهر فقط إن كان الملف موجوداً فعلاً (ويمكن تخطّيها).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => setHasVideo(true);
    v.src = VIDEO_URL;
    return () => {
      v.onloadedmetadata = null;
      v.removeAttribute("src");
    };
  }, []);

  useEffect(() => {
    if (open && stage === "password") firstField.current?.focus();
  }, [open, stage]);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setStage("guide");
    setPw("");
    setPw2("");
    setErr("");
    setBig(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!status || status.enabled === false) return null;

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (pw.length < MIN) return setErr(`كلمة المرور قصيرة: ${MIN} أحرف على الأقل.`);
    if (pw !== pw2) return setErr("كلمتا المرور غير متطابقتين.");
    setStage("working");
    try {
      const res = await fetch("/api/offline-package", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw Object.assign(new Error(d?.error || "تعذّر تجهيز الحزمة."), { fromServer: true });
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rasd-offline.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setPw("");
      setPw2("");
      setStage("done");
    } catch (e2) {
      setErr(e2?.fromServer ? e2.message : "تعذّر الاتصال بالخادم.");
      setStage("password");
    }
  }

  const sc = strength(pw);

  // بوابة إلى body: الزر عائم (fixed) ولا يتأثر بأي حاوية أب فيها transform أو backdrop-filter (مثل الترويسة).
  return createPortal(
    <>
      <style>{CSS}</style>
      <button
        type="button"
        className="od-fab inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground shadow-lg hover:shadow-xl disabled:opacity-50"
        style={{ bottom: FAB_BOTTOM, insetInlineEnd: FAB_INLINE_END }}
        title={status.available ? "تحميل النسخة بدون إنترنت" : "النسخة غير مجهّزة على الخادم بعد"}
        aria-label="تحميل النسخة بدون إنترنت"
        disabled={!status.available}
        onClick={() => {
          setStage(hasVideo ? "video" : "guide");
          setOpen(true);
        }}
      >
        <Download size={18} />
        <span className="hidden lg:inline">تحميل النسخة بدون إنترنت</span>
      </button>

      {open ? (
        <div
          className="od-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="offline-title"
            dir="rtl"
            onSubmit={submit}
            className={`od-card w-full space-y-4 rounded-2xl border bg-background p-5 text-sm shadow-2xl transition-[max-width] duration-300 ease-out ${big && stage === "video" ? "max-w-4xl" : "max-w-md"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="offline-title" className="text-base font-semibold">
                تحميل النسخة بدون إنترنت
              </h2>
              <button
                type="button"
                aria-label="إغلاق"
                disabled={busy}
                onClick={close}
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-accent disabled:opacity-40"
              >
                <X size={15} />
              </button>
            </div>

            {stage === "video" ? (
              <div key="video" className="od-step space-y-4" data-testid="offline-video-step">
                <div ref={videoBox} className="relative overflow-hidden rounded-xl border bg-black">
                  <video
                    src={VIDEO_URL}
                    controls
                    playsInline
                    preload="metadata"
                    onEnded={() => setStage("guide")}
                    className="aspect-video w-full"
                  />
                  <div className="absolute start-2 top-2 flex gap-1.5">
                    <button
                      type="button"
                      aria-label={big ? "تصغير" : "تكبير"}
                      title={big ? "تصغير" : "تكبير"}
                      onClick={() => setBig((b) => !b)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-transform hover:scale-110"
                    >
                      {big ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                  </div>
                </div>
                <p className="text-center text-xs text-muted-foreground">فيديو شرح قصير (اختياري). يمكنك تخطّيه.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStage("guide")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[.99]"
                  >
                    التالي <ArrowLeft size={15} />
                  </button>
                  <button type="button" onClick={() => setStage("guide")} className="rounded-lg border px-4 py-2 transition-colors hover:bg-accent">
                    تخطي
                  </button>
                </div>
              </div>
            ) : null}

            {stage === "guide" ? (
              <div key="guide" className="od-step space-y-4">
                <Guide />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStage("password")}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[.99]"
                  >
                    التالي <ArrowLeft size={15} />
                  </button>
                  {hasVideo ? (
                    <button type="button" onClick={() => setStage("video")} className="rounded-lg border px-4 py-2 transition-colors hover:bg-accent">
                      الفيديو
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {stage === "password" ? (
              <div key="password" className="od-step space-y-3">
                <p className="text-xs leading-6 text-muted-foreground">
                  ملف مشفّر بكلمة مرور تختارها الآن. يعمل على جهازك فقط (127.0.0.1) بلا بيانات ولا إنترنت، ولا يُفتح بدون الكلمة.
                </p>
                <label className="block space-y-1">
                  <span>كلمة مرور الحزمة ({MIN} أحرف فأكثر)</span>
                  <div className="relative">
                    <input
                      ref={firstField}
                      type="password"
                      autoComplete="new-password"
                      className="field-input w-full"
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                    />
                  </div>
                </label>
                {pw ? (
                  <div className="space-y-1" aria-live="polite">
                    <div className="h-1.5 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(sc / 4) * 100}%`, background: STRENGTH_COLOR[sc] }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">القوة: {STRENGTH_LABEL[sc]}</div>
                  </div>
                ) : null}
                <label className="block space-y-1">
                  <span>أعد كتابتها</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="field-input w-full"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                  />
                </label>
                {err ? (
                  <p role="alert" className="od-step text-xs text-red-600">
                    {err}
                  </p>
                ) : null}
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-transform hover:scale-[1.01] active:scale-[.99]"
                  >
                    تنزيل
                  </button>
                  <button type="button" className="rounded-lg border px-3 py-2 transition-colors hover:bg-accent" onClick={() => setStage("guide")}>
                    رجوع
                  </button>
                </div>
              </div>
            ) : null}

            {stage === "working" ? (
              <div key="working" className="od-step space-y-4 py-2" role="status" aria-live="polite">
                <div className="od-bar h-2 rounded-full bg-border">
                  <i className="bg-primary" />
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="od-blink">جارٍ ضغط الملفات…</li>
                  <li className="od-blink" style={{ animationDelay: ".3s" }}>
                    جارٍ التشفير بكلمة مرورك (AES-256)…
                  </li>
                  <li className="od-blink" style={{ animationDelay: ".6s" }}>
                    جارٍ تجهيز المشغّل…
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground">جارٍ التجهيز… لا تغلق الصفحة.</p>
              </div>
            ) : null}

            {stage === "done" ? (
              <div key="done" role="status" className="od-step space-y-3 text-center" data-testid="offline-done">
                <svg className="od-check mx-auto" width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                  <circle cx="32" cy="32" r="28" fill="var(--primary, #16a34a)" opacity=".15" />
                  <circle cx="32" cy="32" r="28" stroke="var(--primary, #16a34a)" strokeWidth="3" />
                  <path d="M20 33l8 8 16-17" stroke="var(--primary, #16a34a)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="font-medium">بدأ التنزيل</p>
                <p className="text-xs leading-6 text-muted-foreground">
                  فك الضغط عن rasd-offline.zip ثم شغّل Start-Rasd.bat (ويندوز) واكتب كلمة المرور.
                </p>
                <p className="text-xs leading-6 text-muted-foreground">
                  احفظ كلمة المرور: لا يمكن استرجاعها. النسخة فارغة من أي بيانات، ويلزم تثبيت Node.js 20 أو أحدث مرة واحدة.
                </p>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 transition-colors hover:bg-accent" onClick={close}>
                  <Check size={14} /> إغلاق
                </button>
              </div>
            ) : null}
          </form>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
