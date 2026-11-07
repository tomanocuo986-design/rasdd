// جلب نظام/تعليمات (PDF) من رابط رسمي إلى «مكتبة الأنظمة والتعليمات».
// الخادم هو من يجلب الملف (المتصفح ممنوع غالباً بسبب CORS)، ولذلك هذا المسار يُعامَل كأنه بوابة SSRF محتملة:
//   1) قائمة بيضاء صارمة: https فقط، والمنفذ 443 فقط، والنطاق من القائمة (أو نطاق فرعي منها) فقط.
//   2) لا عناوين IP حرفية، ولا بيانات دخول داخل الرابط.
//   3) يُحَلّ اسم النطاق بأنفسنا ويُرفض أي عنوان خاص/محلي/Link-local، ثم يُثبَّت الاتصال على العنوان المفحوص
//      (يمنع DNS rebinding: لا يُحَلّ الاسم مرة ثانية أثناء الاتصال).
//   4) التحويلات (redirect) تُتبَّع يدوياً وكل قفزة تُفحص من جديد (قائمة بيضاء + عنوان عام)، بحد أقصى 4.
//   5) حدّ للحجم والمهلة، ولا يُقبل إلا ملف تبدأ بياناته بـ %PDF- (لا نثق بترويسة Content-Type).
//   6) شهادة TLS تُتحقَّق دائماً (لا تعطيل للتحقق).
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import net from "node:net";

type Env = Record<string, string | undefined>;

/**
 * المواقع الرسمية المسموحة: الإدارة المحلية، ديوان الخدمة المدنية، المالية، دائرة العطاءات الحكومية،
 * وزارة الاقتصاد الرقمي (نص نظام المشتريات الحكومية)، وبوابة الحكومة الأردنية (نصوص الجريدة الرسمية)،
 * وهيئة الخدمة والإدارة العامة (spac.gov.jo).
 */
export const DEFAULT_ALLOWED_HOSTS: readonly string[] = [
  "mola.gov.jo",
  "csb.gov.jo",
  "mof.gov.jo",
  "gtd.gov.jo",
  "modee.gov.jo",
  "portal.jordan.gov.jo",
  "spac.gov.jo",
];

const EXTRA_HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+gov\.jo$/;
export const MAX_REDIRECTS = 4;
export const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 25_000;

/** القائمة الفعلية = الافتراضية + (اختياري) LEGAL_FETCH_EXTRA_HOSTS بشرط أن تنتهي بـ .gov.jo. */
export function allowedHosts(env: Env = process.env): string[] {
  const out = new Set<string>(DEFAULT_ALLOWED_HOSTS);
  for (const raw of (env["LEGAL_FETCH_EXTRA_HOSTS"] ?? "").split(",")) {
    const h = raw.trim().toLowerCase();
    if (EXTRA_HOST_RE.test(h)) out.add(h);
  }
  return [...out];
}

export const legalFetchEnabled = (env: Env = process.env): boolean =>
  (env["LEGAL_FETCH"] ?? "").trim().toLowerCase() !== "off";

export const maxBytesFromEnv = (env: Env = process.env): number => {
  const mb = Number(env["LEGAL_FETCH_MAX_MB"]);
  return Number.isFinite(mb) && mb >= 1 && mb <= 100
    ? Math.floor(mb * 1024 * 1024)
    : DEFAULT_MAX_BYTES;
};

export const isAllowedHost = (host: string, hosts: readonly string[]): boolean =>
  hosts.some((d) => host === d || host.endsWith("." + d));

// ---------- فحص العناوين ----------

function ipv4Private(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const a = p[0]!;
  const b = p[1]!;
  const c = p[2]!;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function expandIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  // الجزء الرباعي المضمَّن (::ffff:1.2.3.4) يتحوّل إلى مجموعتين
  const m = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (m) {
    const v4 = m[2]!.split(".").map(Number);
    if (v4.length !== 4 || v4.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    s = `${m[1]}${((v4[0]! << 8) | v4[1]!).toString(16)}:${((v4[2]! << 8) | v4[3]!).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
  const groups = [
    ...head,
    ...(halves.length === 2 ? Array<string>(missing).fill("0") : []),
    ...tail,
  ];
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

function ipv6Private(ip: string): boolean {
  const g = expandIpv6(ip);
  if (!g) return true;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  if (g.every((x) => x === 0)) return true; // ::
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0 && g7 === 1)
    return true; // ::1
  // IPv4 مضمَّن: ::ffff:a.b.c.d و ::a.b.c.d
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && (g5 === 0xffff || g5 === 0))
    return ipv4Private(`${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`);
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA)
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 (multicast)
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // توثيق
  if (g0 === 0x0064 && g1 === 0xff9b) return true; // NAT64
  if (g0 === 0x2002) return true; // 6to4 (يحمل IPv4 داخله)
  return false;
}

/** هل العنوان غير عام (خاص/محلي/مخصص)؟ أي عنوان غير مفهوم يُعامل كغير عام. */
export function isPrivateAddress(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) return ipv6Private(ip);
  return true;
}

// ---------- التحقق من الرابط ----------

export type Reject = { ok: false; status: number; error: string };
const reject = (status: number, error: string): Reject => ({ ok: false, status, error });

export function validateUrl(
  raw: string,
  hosts: readonly string[],
): { ok: true; url: URL } | Reject {
  const list = hosts.join("، ");
  let u: URL;
  try {
    u = new URL(String(raw ?? "").trim());
  } catch {
    return reject(400, "الرابط غير صالح.");
  }
  if (u.protocol === "http:") u.protocol = "https:"; // نرقّي http إلى https (المواقع الرسمية تدعمه)
  if (u.protocol !== "https:") return reject(400, "يُقبل رابط https فقط.");
  if (u.username || u.password) return reject(400, "الرابط لا يجوز أن يحوي بيانات دخول.");
  if (u.port && u.port !== "443") return reject(400, "المنفذ غير مسموح.");
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (net.isIP(host) || host.includes(":")) return reject(400, "العناوين الرقمية (IP) غير مسموحة.");
  if (!isAllowedHost(host, hosts))
    return reject(403, `الموقع غير مسموح. المواقع المسموحة: ${list}`);
  u.hostname = host;
  u.hash = "";
  return { ok: true, url: u };
}

// ---------- الجلب ----------

export type Resolved = { address: string; family: 4 | 6 };
export type RawResponse = {
  status: number;
  headers: Record<string, string | undefined>;
  body: Buffer;
};
export type GetFn = (
  url: URL,
  ip: Resolved,
  opts: { maxBytes: number; timeoutMs: number },
) => Promise<RawResponse>;

export class FetchError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const defaultResolve = async (host: string): Promise<Resolved[]> =>
  (await dnsLookup(host, { all: true, verbatim: true })).map((r) => ({
    address: r.address,
    family: r.family as 4 | 6,
  }));

/** اتصال HTTPS مثبَّت على عنوان IP تم فحصه مسبقاً، مع التحقق من الشهادة باسم النطاق. لا يتبع التحويلات. */
export const defaultGet: GetFn = (url, ip, { maxBytes, timeoutMs }) =>
  new Promise<RawResponse>((resolve, reject2) => {
    const req = httpsRequest(
      {
        host: url.hostname,
        servername: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: "GET",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          host: url.hostname,
          "user-agent": "RASD-LegalFetch/1.0",
          accept: "application/pdf,*/*;q=0.5",
          "accept-encoding": "identity",
        },
        // لا يُعاد حلّ الاسم: نعيد العنوان الذي فحصناه
        lookup: (_h: string, o: { all?: boolean }, cb: (...a: any[]) => void) =>
          o && o.all
            ? cb(null, [{ address: ip.address, family: ip.family }])
            : cb(null, ip.address, ip.family),
      } as any,
      (res) => {
        const status = res.statusCode ?? 0;
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(res.headers)) headers[k] = Array.isArray(v) ? v[0] : v;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers, body: Buffer.alloc(0) });
        }
        const declared = Number(headers["content-length"]);
        if (Number.isFinite(declared) && declared > maxBytes) {
          res.destroy();
          return reject2(new FetchError(413, "حجم الملف أكبر من الحد المسموح."));
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (c: Buffer) => {
          total += c.length;
          if (total > maxBytes) {
            res.destroy();
            reject2(new FetchError(413, "حجم الملف أكبر من الحد المسموح."));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status, headers, body: Buffer.concat(chunks) }));
        res.on("error", (e) => reject2(e));
      },
    );
    req.on("error", (e) => reject2(e));
    req.end();
  });

export type Deps = {
  hosts: readonly string[];
  resolve?: (host: string) => Promise<Resolved[]>;
  get?: GetFn;
  maxBytes?: number;
  timeoutMs?: number;
};

export type Fetched = { ok: true; body: Buffer; finalUrl: string };

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export async function fetchLegalPdf(rawUrl: string, deps: Deps): Promise<Fetched | Reject> {
  const resolve = deps.resolve ?? defaultResolve;
  const get = deps.get ?? defaultGet;
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const v = validateUrl(rawUrl, deps.hosts);
  if (!v.ok) return v;
  let url = v.url;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const addrs = await resolve(url.hostname);
      if (!addrs.length) return reject(502, "تعذّر الوصول إلى الموقع.");
      if (addrs.some((a) => isPrivateAddress(a.address)))
        return reject(403, "عنوان الموقع غير مسموح.");
      const res = await get(url, addrs[0]!, { maxBytes, timeoutMs });

      if (REDIRECTS.has(res.status)) {
        const loc = res.headers["location"];
        if (!loc) return reject(502, "تحويل غير صالح من الموقع.");
        let next: URL;
        try {
          next = new URL(loc, url);
        } catch {
          return reject(502, "تحويل غير صالح من الموقع.");
        }
        const nv = validateUrl(next.toString(), deps.hosts); // كل قفزة تمرّ بنفس الفحص
        if (!nv.ok) return reject(403, "حوّل الموقع إلى وجهة غير مسموحة.");
        url = nv.url;
        continue;
      }
      if (res.status === 404) return reject(404, "الملف غير موجود في هذا الرابط.");
      if (res.status < 200 || res.status >= 300)
        return reject(502, `رفض الموقع الطلب (${res.status}).`);
      if (res.body.length > maxBytes) return reject(413, "حجم الملف أكبر من الحد المسموح.");
      if (res.body.subarray(0, 1024).indexOf("%PDF-") === -1)
        return reject(
          415,
          "الرابط لا يشير إلى ملف PDF مباشر. افتح الصفحة وانسخ رابط ملف الـPDF نفسه.",
        );
      return { ok: true, body: res.body, finalUrl: url.toString() };
    }
    return reject(502, "تحويلات كثيرة من الموقع.");
  } catch (e) {
    if (e instanceof FetchError) return reject(e.status, e.message);
    const name = (e as { name?: string })?.name;
    const code = (e as { code?: string })?.code ?? "";
    if (name === "AbortError" || name === "TimeoutError" || code === "ABORT_ERR")
      return reject(504, "انتهت مهلة الموقع، حاول لاحقاً.");
    if (/CERT|TLS|SSL|ERR_TLS/i.test(code))
      return reject(502, "تعذّر التحقق من شهادة أمان الموقع، لم يُجلب الملف.");
    return reject(502, "تعذّر جلب الملف من الموقع.");
  }
}
