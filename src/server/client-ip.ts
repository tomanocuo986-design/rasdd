// عنوان العميل الحقيقي لحدّ المحاولات والسجل.
// الترويسة x-forwarded-for يضيف إليها كل وكيل (proxy) عنواناً في **آخرها**، أما أولها فيستطيع العميل تزويره بحرية.
// لذلك نقرأ من اليمين: TRUST_PROXY_HOPS = عدد الوكلاء الموثوقين أمام الخادم (Render = 1 وهو الافتراضي).
//   TRUST_PROXY_HOPS=0  -> لا نثق بأي ترويسة (الخادم مكشوف مباشرة).
// cf-connecting-ip لا يُقرأ إلا عند TRUST_CF_CONNECTING_IP=1 (أي أن Cloudflare هو الوحيد الذي يصل الخادم).
type Env = Record<string, string | undefined>;

const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

export function clientIp(req: Request, env: Env = process.env): string {
  const h = req.headers;
  if (env["TRUST_CF_CONNECTING_IP"] === "1") {
    const cf = (h.get("cf-connecting-ip") ?? "").trim();
    if (IP_RE.test(cf)) return cf;
  }
  const hopsRaw = Number(env["TRUST_PROXY_HOPS"] ?? 1);
  const hops = Number.isInteger(hopsRaw) && hopsRaw >= 0 ? hopsRaw : 1;
  if (hops === 0) return "direct";
  const parts = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return "unknown";
  // إن كانت القائمة أقصر من عدد الوكلاء فالترويسة لم تمرّ بكل الوكلاء: نأخذ أول عنصر فيها
  const pick = parts[Math.max(parts.length - hops, 0)] ?? "unknown";
  return IP_RE.test(pick) ? pick : "unknown";
}
