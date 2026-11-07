import { describe, expect, it } from "vitest";
import { BLOCKED_MESSAGE, aiLogDetail, aiStatus, externalAllowed, gateProvider, redactTerms, sanitizeForAI } from "../server/ai-policy.ts";
import type { Provider } from "../server/llm.ts";

const gemini: Provider = { kind: "gemini", apiKey: "k", models: ["m"] };
const local = (baseUrl: string): Provider => ({ kind: "openai", baseUrl, model: "llama3.1", apiKey: "" });

describe("AI provider gate (confidentiality)", () => {
  it("blocks the external provider by default", () => {
    const g = gateProvider(gemini, {});
    expect(g.ok).toBe(false);
    if (!g.ok) {
      expect(g.status).toBe(403);
      expect(g.message).toBe(BLOCKED_MESSAGE);
    }
  });

  it("allows it only with an explicit administrative flag (new or legacy name)", () => {
    expect(gateProvider(gemini, { AI_ALLOW_EXTERNAL: "1" })).toEqual({ ok: true, external: true });
    expect(gateProvider(gemini, { DOC_REVIEW_ALLOW_EXTERNAL: "1" })).toEqual({ ok: true, external: true });
    expect(externalAllowed({ AI_ALLOW_EXTERNAL: "true" })).toBe(false); // only the exact "1"
  });

  it("in-network models pass without any flag", () => {
    for (const url of ["http://ollama:11434/v1", "http://localhost:11434/v1", "http://10.1.2.3:8000/v1", "http://llm.internal/v1"]) {
      expect(gateProvider(local(url), {})).toEqual({ ok: true, external: false });
    }
  });

  it("a public OpenAI-compatible endpoint is treated as external", () => {
    expect(gateProvider(local("https://api.openai.com/v1"), {}).ok).toBe(false);
    expect(gateProvider(local("https://api.openai.com/v1"), { AI_ALLOW_EXTERNAL: "1" })).toEqual({ ok: true, external: true });
  });
});

describe("redaction before anything leaves the server", () => {
  const msgs = [
    { role: "user", content: "ما وضع السيد أحمد محمود الخطيب، رقمه الوطني 9871012345؟" },
    { role: "user", content: "وهاتفه 0791234567 وحسابه JO94CBJO0010000000000131000302" },
  ];
  const ctx = "المورد: السيد أحمد محمود الخطيب — مبلغ 12,000 دينار بتاريخ 2026-03-01";

  it("external: masks identifiers consistently across messages and context, keeps amounts and dates", () => {
    const r = sanitizeForAI(msgs, ctx, { external: true, env: {} });
    const all = [...r.messages.map((m) => m.content), r.context].join("\n");
    expect(all).not.toContain("9871012345");
    expect(all).not.toContain("0791234567");
    expect(all).not.toContain("أحمد محمود");
    expect(all).not.toContain("JO94CBJO");
    expect(all).toContain("12,000");
    expect(all).toContain("2026-03-01");
    expect(r.total).toBeGreaterThanOrEqual(4);
    // الاسم نفسه ← الرمز نفسه في الرسالة والسياق (يحافظ على الإحالة المتبادلة)
    const tokenIn = (s: string) => /\[اسم_\d+\]/.exec(s)?.[0];
    expect(tokenIn(r.messages[0]!.content)).toBeTruthy();
    expect(tokenIn(r.messages[0]!.content)).toBe(tokenIn(r.context!));
  });

  it("local model: untouched unless AI_REDACT_ALWAYS=1", () => {
    const plain = sanitizeForAI(msgs, ctx, { external: false, env: {} });
    expect(plain.messages).toEqual(msgs);
    expect(plain.context).toBe(ctx);
    expect(plain.total).toBe(0);
    const always = sanitizeForAI(msgs, ctx, { external: false, env: { AI_REDACT_ALWAYS: "1" } });
    expect(always.messages[0]!.content).not.toContain("9871012345");
  });

  it("organisation terms (AI_REDACT_TERMS) are masked even without a title", () => {
    expect(redactTerms({ AI_REDACT_TERMS: "شركة النور، مؤسسة الأفق\nبلدية الوسطية" })).toEqual(["شركة النور", "مؤسسة الأفق", "بلدية الوسطية"]);
    const r = sanitizeForAI([{ role: "user", content: "كم أمر شراء لشركة النور؟" }], "المورد شركة النور", {
      external: true,
      env: { AI_REDACT_TERMS: "شركة النور" },
    });
    expect(r.messages[0]!.content).not.toContain("شركة النور");
    expect(r.context).not.toContain("شركة النور");
  });

  it("keeps the message shape (agent tool results keep their ids and names)", () => {
    const convo = [
      { role: "user", content: "من هم الموردون؟" },
      { role: "tool", toolCallId: "c1", name: "list_findings", content: '{"supplier":"السيد خالد عمر الزعبي","nid":"9871012345"}' },
    ];
    const r = sanitizeForAI(convo, undefined, { external: true, env: {} });
    expect(r.context).toBeUndefined();
    expect(r.messages[1]).toMatchObject({ role: "tool", toolCallId: "c1", name: "list_findings" });
    expect(r.messages[1]!.content).not.toContain("9871012345");
    expect(r.messages[1]!.content).not.toContain("خالد عمر");
  });
});

describe("what is logged and what is shown", () => {
  it("log detail carries counts and provider kind only, never content", () => {
    const d = aiLogDetail("mode=chat passages=0", true, 5);
    expect(d).toBe("mode=chat passages=0 provider=external redacted=5");
    expect(aiLogDetail("step=1 last=user", false, 0)).toBe("step=1 last=user provider=local redacted=0");
  });

  it("status for the UI badge", () => {
    expect(aiStatus({})).toBe("off");
    expect(aiStatus({ LLM_BASE_URL: "http://ollama:11434/v1" })).toBe("local");
    expect(aiStatus({ GEMINI_API_KEY: "k" })).toBe("external-blocked");
    expect(aiStatus({ GEMINI_API_KEY: "k", AI_ALLOW_EXTERNAL: "1" })).toBe("external");
  });
});

import { readFileSync } from "node:fs";

describe("every model route passes through the gate before contacting a provider", () => {
  for (const file of ["src/routes/api.chat.ts", "src/routes/api.agent.ts", "src/routes/api.doc-review.ts"]) {
    it(file, () => {
      const src = readFileSync(file, "utf8");
      const gate = Math.max(src.indexOf("gateProvider("), src.indexOf("isExternalProvider("));
      const firstFetch = src.search(/\bfetch\(/);
      expect(gate, "gate call present").toBeGreaterThan(-1);
      expect(firstFetch, "provider fetch present").toBeGreaterThan(-1);
      expect(gate).toBeLessThan(firstFetch);
    });
  }
  it("chat and agent redact before building the prompt", () => {
    for (const file of ["src/routes/api.chat.ts", "src/routes/api.agent.ts"]) {
      const src = readFileSync(file, "utf8");
      expect(src.indexOf("sanitizeForAI(")).toBeGreaterThan(-1);
      expect(src.indexOf("sanitizeForAI(")).toBeLessThan(src.indexOf("systemFor("));
    }
  });
});
