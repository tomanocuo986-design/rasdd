import { standingOf, type AuditEvent, type ChainVerdict, type Standing } from "./audit-chain";

const ROLE_LABELS: Record<string, string> = { auditor: "مدقق", reviewer: "مراجع", admin: "مدير" };

const ACTION_LABELS: Record<string, string> = {
  "ui.finding.confirm": "تأكيد ملاحظة",
  "ui.finding.false_positive": "اعتبار ملاحظة إنذاراً كاذباً",
  "ui.finding.approve": "اعتماد ملاحظة",
  "ui.finding.edit": "تعديل ملاحظة",
  "ui.draft.approve": "اعتماد مسودة",
  "ui.draft.delete": "حذف مسودة",
  "ui.report.export": "تصدير تقرير",
  "ui.report.export_docx": "تصدير تقرير Word",
  "ui.legal.override": "تجاوز سند قانوني",
  "ui.backup.restore": "استعادة نسخة احتياطية",
  "ui.sync.push": "مزامنة البيانات",
  "auth.login": "تسجيل دخول",
  "auth.login_failed": "محاولة دخول فاشلة",
  "auth.logout": "تسجيل خروج",
  "auth.logout_all": "خروج من كل الأجهزة",
  "auth.register": "إنشاء حساب",
  "audit.read": "قراءة سجل التدقيق",
  "users.set_role": "تغيير دور مستخدم",
  "users.revoke_sessions": "إنهاء جلسات مستخدم",
};

const STANDING_STYLE: Record<
  Standing,
  { dot: string; badge: string; label: string; title: string }
> = {
  valid: {
    dot: "bg-emerald-500",
    badge: "text-emerald-600 dark:text-emerald-400",
    label: "✓ موثّق",
    title: "الحدث سليم ومتصل بالسلسلة",
  },
  broken: {
    dot: "bg-rose-600",
    badge: "text-rose-600 dark:text-rose-400",
    label: "✕ غير متطابق",
    title: "كسر في سلسلة التجزئة عند هذا الحدث",
  },
  after: {
    dot: "bg-amber-500",
    badge: "text-amber-600 dark:text-amber-400",
    label: "! بعد نقطة الكسر",
    title: "حدث لاحق لنقطة الكسر، لا يمكن الوثوق به قبل مراجعة السلسلة",
  },
};

const stamp = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ar-JO");
};

const short = (h: string) => (h ? `${h.slice(0, 16)}…` : "—");

export function AuditTrailTimeline({
  events,
  verify,
}: {
  events: AuditEvent[];
  verify: ChainVerdict;
}) {
  return (
    <div dir="rtl" data-testid="audit-timeline" className="space-y-4">
      <div
        role={verify.ok ? "status" : "alert"}
        data-testid="audit-verdict"
        className={`rounded-lg border p-3 text-sm ${
          verify.ok
            ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300"
            : "border-rose-600/70 text-rose-700 dark:text-rose-300"
        }`}
      >
        {verify.ok
          ? `سلسلة التجزئة سليمة: تحقق الخادم من ${verify.count} حدثاً بالتسلسل كاملاً.`
          : `تحذير: كُسرت سلسلة التجزئة عند الحدث رقم ${verify.brokenAt} — ${verify.reason}.`}
      </div>

      {events.length === 0 ? (
        <p data-testid="audit-empty" className="text-sm text-muted-foreground">
          لا توجد أحداث مطابقة.
        </p>
      ) : (
        <ol className="relative mr-2 space-y-4 border-r-2 border-amber-500 pr-4">
          {events.map((e) => {
            const st = STANDING_STYLE[standingOf(e.seq, verify)];
            return (
              <li
                key={e.seq}
                data-testid="audit-event"
                data-standing={standingOf(e.seq, verify)}
                className="relative rounded-lg border border-border bg-background p-4 text-foreground shadow-sm"
              >
                <span
                  title={st.title}
                  className={`absolute -right-[23px] top-5 h-3 w-3 rounded-full border-2 border-background ${st.dot}`}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    الدور:{" "}
                    <strong className="text-amber-600 dark:text-amber-400">
                      {ROLE_LABELS[e.role] ?? (e.role || "—")}
                    </strong>{" "}
                    ({e.actor})
                  </span>
                  <span>
                    #{e.seq} · {stamp(e.ts)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium">{ACTION_LABELS[e.action] ?? e.action}</p>
                {e.target || e.detail ? (
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {e.target ? `الهدف: ${e.target}` : ""}
                    {e.target && e.detail ? " — " : ""}
                    {e.detail}
                  </p>
                ) : null}
                <div
                  dir="ltr"
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  <span title={e.hash}>HASH: {short(e.hash)}</span>
                  <span title={e.prevHash}>PREV: {short(e.prevHash)}</span>
                  <span className={st.badge}>{st.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
