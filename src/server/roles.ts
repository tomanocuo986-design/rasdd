// الأدوار والصلاحيات (خادم). الدور يُقرأ من الخادم عند كل طلب، لا من ملف تعريف الارتباط، فيسري تغييره فورًا.
//   auditor  : مدقق (الافتراضي) — يستخدم المساعد ويسجّل أحداث عمله.
//   reviewer : مراجع/رئيس فريق — كالمدقق + قراءة سجل التدقيق والتحقق من سلامته.
//   admin    : مدير النظام — كالمراجع + إدارة المستخدمين والأدوار.
// تعيين الأدوار الأولى عبر متغيرات البيئة RASD_ADMINS و RASD_REVIEWERS (أرقام وظيفية مفصولة بفواصل)؛ وهي تتفوق دائمًا
// على المخزَّن في قاعدة البيانات كي لا يُقفل المدير خارج النظام.

export type Role = "admin" | "reviewer" | "auditor";
export type Permission = "chat.use" | "events.write" | "audit.read" | "users.manage";

export const ROLES: readonly Role[] = ["admin", "reviewer", "auditor"];

const PERMS: Record<Role, readonly Permission[]> = {
  auditor: ["chat.use", "events.write"],
  reviewer: ["chat.use", "events.write", "audit.read"],
  admin: ["chat.use", "events.write", "audit.read", "users.manage"],
};

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
export const can = (role: Role | undefined, perm: Permission): boolean => !!role && PERMS[role].includes(perm);

const list = (raw: string | undefined) =>
  new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );

/** الدور المفروض من البيئة لهذا الرقم الوظيفي (أو null إن لم يُذكر). */
export function bootstrapRole(employeeId: string, env: Record<string, string | undefined> = process.env): Role | null {
  const id = employeeId.trim().toUpperCase();
  if (list(env["RASD_ADMINS"]).has(id)) return "admin";
  if (list(env["RASD_REVIEWERS"]).has(id)) return "reviewer";
  return null;
}

export function effectiveRole(
  user: { employeeId: string; role?: unknown },
  env: Record<string, string | undefined> = process.env,
): Role {
  return bootstrapRole(user.employeeId, env) ?? (isRole(user.role) ? user.role : "auditor");
}

/** الأحداث التي يحق للواجهة تسجيلها (قرارات المدقق ذات الأثر)؛ أي اسم آخر يُرفض كي لا يُملأ السجل بضوضاء. */
export const CLIENT_EVENTS = [
  "ui.finding.confirm",
  "ui.finding.false_positive",
  "ui.finding.approve",
  "ui.draft.approve",
  "ui.draft.delete",
  "ui.report.export",
  "ui.legal.override",
  "ui.backup.restore",
  "ui.sync.push",
] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];
export const isClientEvent = (v: unknown): v is ClientEvent => (CLIENT_EVENTS as readonly string[]).includes(String(v));

export type RegistrationPolicy = "open" | "invite" | "closed";
/** closed: لا تسجيل ذاتي. invite: يتطلب AUTH_INVITE_CODE. open: كما كان (للتجارب فقط). */
export function registrationPolicy(env: Record<string, string | undefined> = process.env): RegistrationPolicy {
  const v = (env["AUTH_REGISTRATION"] ?? "").trim().toLowerCase();
  if (v === "closed") return "closed";
  if (v === "invite" || (env["AUTH_INVITE_CODE"] ?? "").trim()) return "invite";
  return "open";
}
