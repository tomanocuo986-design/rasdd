#!/usr/bin/env node
// فحص إغلاق الشبكة: شغّله من مضيف الخادم نفسه (npm run verify:egress).
// المفتوح المطلوب: مواقع الأنظمة الرسمية (+ النموذج المحلي إن ضُبط LLM_BASE_URL). المحجوب المطلوب: كل ما عداها.
// "وصل" يعني أن الموقع ردّ بأي رمز HTTP. رد 403/407/451/502/503 على موقع محجوب قد يكون صفحة حجب من الـ proxy، فيُعلَّم "راجع".
import { pathToFileURL } from "node:url";

export const ALLOWED = [
  "https://www.mola.gov.jo/",
  "https://www.csb.gov.jo/",
  "https://www.mof.gov.jo/",
  "https://www.gtd.gov.jo/",
  "https://spac.gov.jo/",
  "https://modee.gov.jo/",
  "https://portal.jordan.gov.jo/",
];
export const BLOCKED = [
  "https://example.com/",
  "https://www.google.com/",
  "https://github.com/",
  "https://api.anthropic.com/",
  "https://api.openai.com/",
  "https://generativelanguage.googleapis.com/",
  "https://api.mistral.ai/",
  "https://api.cohere.com/",
  "https://api.groq.com/",
  "https://openrouter.ai/",
  "https://api.x.ai/",
  "https://huggingface.co/",
];
const BLOCK_PAGE = new Set([403, 407, 451, 502, 503]);

export async function probe(url, fetchFn, timeoutMs) {
  try {
    const r = await fetchFn(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { reachable: true, status: r.status };
  } catch (e) {
    return { reachable: false, error: String(e?.cause?.code ?? e?.name ?? e?.message ?? e) };
  }
}

/** rows: { url, expect: "open"|"closed", reachable, status?, error?, result: "pass"|"fail"|"check" } */
export async function runChecks({
  fetchFn = fetch,
  timeoutMs = 6000,
  allowed = ALLOWED,
  blocked = BLOCKED,
  internal = [],
} = {}) {
  const plan = [
    ...[...allowed, ...internal].map((url) => ({ url, expect: "open" })),
    ...blocked.map((url) => ({ url, expect: "closed" })),
  ];
  const rows = [];
  for (const p of plan) {
    const r = await probe(p.url, fetchFn, timeoutMs);
    let result;
    if (p.expect === "open") result = r.reachable ? "pass" : "fail";
    else if (!r.reachable) result = "pass";
    else result = BLOCK_PAGE.has(r.status) ? "check" : "fail";
    rows.push({ ...p, ...r, result });
  }
  return rows;
}

const MSG = {
  pass: "نجح",
  fail: "فشل",
  check: "راجع",
};
const WHY = (r) =>
  r.result === "fail"
    ? r.expect === "open"
      ? `محجوب والمفروض مفتوح (${r.error})`
      : `مفتوح والمفروض محجوب (رد ${r.status})`
    : r.result === "check"
      ? `ردّ ${r.status}: تأكد أنها صفحة حجب من شبكتك`
      : "";

async function main() {
  const internal = [];
  const base = (process.env.LLM_BASE_URL ?? "").trim();
  if (base) internal.push(base);
  const rows = await runChecks({ internal });
  for (const r of rows) {
    console.log(
      `[${MSG[r.result]}] ${r.expect === "open" ? "مطلوب مفتوح" : "مطلوب محجوب"}  ${r.url} ${WHY(r)}`,
    );
  }
  const fails = rows.filter((r) => r.result === "fail").length;
  const checks = rows.filter((r) => r.result === "check").length;
  console.log(`\nالنتيجة: ${rows.length - fails - checks} نجح، ${checks} راجع، ${fails} فشل.`);
  process.exit(fails ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
