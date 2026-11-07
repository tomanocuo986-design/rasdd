import { describe, expect, it } from "vitest";
import { securityStatus } from "@/server/security-status.ts";
import { runChecks } from "../../scripts/verify-egress.mjs";

const LOCAL = { LLM_BASE_URL: "http://ollama.internal:11434/v1", LLM_MODEL: "gemma" };
const levels = (s: ReturnType<typeof securityStatus>) =>
  s.notes.filter((n) => n.level === "warn").map((n) => n.text);

describe("securityStatus — IPv6 model address", () => {
  it("warns for http to a public IPv6 literal (brackets are stripped) but not for loopback", () => {
    const pub = securityStatus({ LLM_BASE_URL: "http://[2606:4700:4700::1111]:11434/v1", LLM_MODEL: "gemma" });
    expect(levels(pub).some((t) => t.includes("2606:4700:4700::1111"))).toBe(true);
    const loop = securityStatus({ LLM_BASE_URL: "http://[::1]:11434/v1", LLM_MODEL: "gemma" });
    expect(levels(loop).some((t) => t.includes("عنوان عام"))).toBe(false);
  });
});

describe("securityStatus", () => {
  it("is ok for a local model, redaction on and the default library", () => {
    const s = securityStatus({
      ...LOCAL,
      AI_REDACT_ALWAYS: "1",
      AI_REDACT_TERMS: "شركة أ، مورد ب",
    });
    expect(s.verdict).toBe("ok");
    expect(s.ai).toMatchObject({
      provider: "local",
      host: "ollama.internal",
      externalAllowed: false,
      redactAlways: true,
      redactTermsCount: 2,
    });
    expect(s.legalLibrary.enabled).toBe(true);
    expect(s.legalLibrary.hosts).toContain("spac.gov.jo");
    expect(s.legalLibrary.extraHosts).toEqual([]);
  });

  it("warns when the template placeholders were copied as real values", () => {
    const s = securityStatus({
      LLM_BASE_URL: "http://ollama.internal:11434/v1",
      LLM_MODEL: "<اسم النموذج كما يظهر في: ollama list>",
      AI_REDACT_ALWAYS: "1",
      AI_REDACT_TERMS: "اسم جهة، اسم مورد، اسم موظف",
    });
    expect(s.verdict).toBe("review");
    const w = levels(s).join("|");
    expect(w).toContain("أمثلة القالب");
    expect(w).toContain("LLM_MODEL غير مضبوط");
  });

  it("warns on a missing model name and on cleartext http to a public address", () => {
    expect(levels(securityStatus({ LLM_BASE_URL: "http://ollama.internal:11434/v1" })).join("|")).toContain("LLM_MODEL غير مضبوط");
    const pub = levels(securityStatus({ LLM_BASE_URL: "http://93.184.216.34:11434/v1", LLM_MODEL: "m" })).join("|");
    expect(pub).toContain("غير مشفّر");
    const priv = levels(securityStatus({ LLM_BASE_URL: "http://10.0.0.5:11434/v1", LLM_MODEL: "m" })).join("|");
    expect(priv).not.toContain("غير مشفّر");
  });

  it("reminds about the paid tier when Gemini is allowed", () => {
    const s = securityStatus({ GEMINI_API_KEY: "x", AI_ALLOW_EXTERNAL: "1", AI_REDACT_TERMS: "س" });
    expect(levels(s).join("|")).toContain("الطبقة المدفوعة");
  });

  it("warns when more than one server instance is configured", () => {
    expect(levels(securityStatus({ ...LOCAL, WEB_CONCURRENCY: "3" })).join("|")).toContain("أكثر من نسخة");
    expect(levels(securityStatus({ ...LOCAL, RASD_INSTANCES: "2" })).join("|")).toContain("أكثر من نسخة");
    expect(levels(securityStatus({ ...LOCAL, WEB_CONCURRENCY: "1" })).join("|")).not.toContain("أكثر من نسخة");
  });

  it("never exposes keys or the URL path", () => {
    const s = securityStatus({
      ...LOCAL,
      LLM_API_KEY: "sk-secret-123",
      GEMINI_API_KEY: "g-secret-456",
    });
    const blob = JSON.stringify(s);
    expect(blob).not.toContain("sk-secret-123");
    expect(blob).not.toContain("g-secret-456");
    expect(blob).not.toContain("/v1");
  });

  it("warns when an external provider is allowed, and when redact terms are empty", () => {
    const s = securityStatus({ GEMINI_API_KEY: "x", AI_ALLOW_EXTERNAL: "1" });
    expect(s.verdict).toBe("review");
    expect(s.ai.provider).toBe("external");
    expect(levels(s).join("|")).toContain("خارجي ومسموح");
    expect(levels(s).join("|")).toContain("AI_REDACT_TERMS فارغ");
  });

  it("treats a blocked external provider as informational, not a warning", () => {
    const s = securityStatus({ GEMINI_API_KEY: "x" });
    expect(s.ai.provider).toBe("external");
    expect(s.verdict).toBe("ok");
  });

  it("warns about AI_ALLOW_EXTERNAL left on with a local model", () => {
    const s = securityStatus({ ...LOCAL, AI_ALLOW_EXTERNAL: "1" });
    expect(s.verdict).toBe("review");
    expect(levels(s).join("|")).toContain("AI_ALLOW_EXTERNAL");
  });

  it("reports the library switched off and extra hosts", () => {
    const off = securityStatus({ ...LOCAL, LEGAL_LIBRARY: "off" });
    expect(off.legalLibrary).toMatchObject({ enabled: false, hosts: [], items: 0 });
    const extra = securityStatus({
      ...LOCAL,
      LEGAL_FETCH_EXTRA_HOSTS: "moj.gov.jo,evil.example.com",
    });
    expect(extra.legalLibrary.extraHosts).toEqual(["moj.gov.jo"]);
    expect(extra.verdict).toBe("review");
  });
});

describe("verify-egress runChecks", () => {
  const blockedErr = Object.assign(new Error("fetch failed"), { cause: { code: "ETIMEDOUT" } });
  const mk =
    (open: string[], pageStatus: Record<string, number> = {}) =>
    async (url: string) => {
      const host = new URL(url).hostname;
      if (open.includes(host)) return { status: pageStatus[host] ?? 200 };
      throw blockedErr;
    };

  it("passes when only the allowed hosts answer", async () => {
    const rows = await runChecks({
      fetchFn: mk(["www.mola.gov.jo", "www.csb.gov.jo", "www.mof.gov.jo", "www.gtd.gov.jo", "spac.gov.jo", "modee.gov.jo", "portal.jordan.gov.jo"]),
      timeoutMs: 50,
    });
    expect(rows.every((r) => r.result === "pass")).toBe(true);
  });

  it("fails when a blocked site answers or an allowed site does not", async () => {
    const rows = await runChecks({ fetchFn: mk(["spac.gov.jo", "example.com"]), timeoutMs: 50 });
    const by = (u: string) => rows.find((r) => r.url.includes(u))!;
    expect(by("example.com").result).toBe("fail");
    expect(by("gtd.gov.jo").result).toBe("fail");
    expect(by("gtd.gov.jo").error).toBe("ETIMEDOUT");
    expect(by("spac.gov.jo").result).toBe("pass");
  });

  it("marks a 403 from a blocked site as 'check' (could be a proxy block page)", async () => {
    const rows = await runChecks({
      fetchFn: mk(
        ["www.mola.gov.jo", "www.csb.gov.jo", "www.mof.gov.jo", "www.gtd.gov.jo", "spac.gov.jo", "modee.gov.jo", "portal.jordan.gov.jo", "github.com"],
        { "github.com": 403 },
      ),
      timeoutMs: 50,
    });
    expect(rows.find((r) => r.url.includes("github.com"))!.result).toBe("check");
  });

  it("also expects the local model address to be open", async () => {
    const rows = await runChecks({
      fetchFn: mk(["ollama.internal"]),
      timeoutMs: 50,
      allowed: [],
      blocked: [],
      internal: ["http://ollama.internal:11434/v1"],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.result).toBe("pass");
  });
});
