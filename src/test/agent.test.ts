import { describe, expect, it } from "vitest";
import {
  TOOL_NAMES,
  geminiAgentBody,
  openaiAgentBody,
  parseGeminiStep,
  parseOpenaiStep,
  isWriteTool,
  AGENT_RULES,
  type AgentMessage,
} from "../server/agent.ts";
// @ts-expect-error plain JS modules
import { createToolbox, stringifyResult } from "../rasd/agent-tools.js";
// @ts-expect-error plain JS modules
import { runAgent } from "../rasd/agent-loop.js";

const convo: AgentMessage[] = [
  { role: "user", content: "ما أخطر الملاحظات؟" },
  { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "list_findings", args: { limit: 3 }, sig: "SIG" }] },
  { role: "tool", toolCallId: "c1", name: "list_findings", content: '{"findings":[]}' },
];

describe("agent request builders", () => {
  it("openai: maps tool calls and results, and advertises every tool", () => {
    const b = JSON.parse(openaiAgentBody("m", "sys", convo, 100));
    expect(b.tools.map((t: any) => t.function.name)).toEqual(TOOL_NAMES);
    expect(b.stream).toBeUndefined();
    expect(b.messages[2].tool_calls[0]).toMatchObject({ id: "c1", type: "function" });
    expect(JSON.parse(b.messages[2].tool_calls[0].function.arguments)).toEqual({ limit: 3 });
    expect(b.messages[3]).toEqual({ role: "tool", tool_call_id: "c1", content: '{"findings":[]}' });
  });

  it("gemini: functionCall keeps its thought signature; parallel results merge into one user turn", () => {
    const two: AgentMessage[] = [
      { role: "user", content: "x" },
      { role: "assistant", content: "", toolCalls: [{ id: "a", name: "get_overview", args: {} }, { id: "b", name: "get_review_stats", args: {} }] },
      { role: "tool", toolCallId: "a", name: "get_overview", content: "{}" },
      { role: "tool", toolCallId: "b", name: "get_review_stats", content: "not json" },
    ];
    const b = JSON.parse(geminiAgentBody("sys", [...convo, ...two.slice(1)], 100));
    const model = b.contents.find((c: any) => c.role === "model");
    expect(model.parts[0].thoughtSignature).toBe("SIG");
    const last = b.contents[b.contents.length - 1];
    expect(last.role).toBe("user");
    expect(last.parts).toHaveLength(2);
    expect(last.parts[1].functionResponse.response).toEqual({ result: { result: "not json" } });
    expect(b.tools[0].functionDeclarations).toHaveLength(TOOL_NAMES.length);
  });
});

describe("agent response parsing", () => {
  it("openai: parses string arguments and drops tools the server never defined", () => {
    const step = parseOpenaiStep({
      choices: [{ message: { content: "", tool_calls: [
        { id: "1", function: { name: "get_finding", arguments: '{"id":"F2"}' } },
        { id: "2", function: { name: "rm_rf", arguments: "{}" } },
        { id: "3", function: { name: "get_overview", arguments: "garbage" } },
      ] } }],
    });
    expect(step.toolCalls.map((c) => c.name)).toEqual(["get_finding", "get_overview"]);
    expect(step.toolCalls[0]!.args).toEqual({ id: "F2" });
    expect(step.toolCalls[1]!.args).toEqual({});
  });

  it("gemini: collects text, skips thought parts, keeps signatures", () => {
    const step = parseGeminiStep({
      candidates: [{ content: { parts: [
        { text: "تفكير", thought: true },
        { text: "سأبحث" },
        { functionCall: { name: "search_legal", args: { query: "التجزئة" } }, thoughtSignature: "S1" },
        { functionCall: { name: "unknown_tool", args: {} } },
      ] } }],
    });
    expect(step.text).toBe("سأبحث");
    expect(step.toolCalls).toHaveLength(1);
    expect(step.toolCalls[0]).toMatchObject({ name: "search_legal", sig: "S1", args: { query: "التجزئة" } });
  });

  it("only the review-decision tool is a write tool, and the rules forbid approving", () => {
    expect(TOOL_NAMES.filter(isWriteTool)).toEqual(["record_review_decision"]);
    expect(AGENT_RULES).toContain("لا تعتمد ملاحظة");
  });
});

// ---------- أدوات المتصفح ----------
const mkGroup = (n: number, rating: string, test = `اختبار ${n}`) => ({
  id: `Payment_Vouchers|${test}`, dataset: "Payment_Vouchers", sector: "finance", test, count: n,
  refs: [`R${n}`], repeated: 0, risk: { rating, score: n }, condition: `وصف ${n}`, cause: "سبب", effect: "أثر", recommendation: "توصية",
  legalBasis: { source: "none", text: "" },
});

function makeDeps() {
  const mem: { log: any[]; deleted: Set<string>; events: string[][] } = { log: [], deleted: new Set(), events: [] };
  const groups = [mkGroup(1, "low"), mkGroup(5, "high"), mkGroup(3, "medium")];
  const deps = {
    getStore: () => ({ Payment_Vouchers: [{}] }),
    runAudit: () => [{ dataset: "Payment_Vouchers", test: "اختبار 5", detail: "تفصيل", ref: "R5", row: 0 }],
    group: () => groups,
    summarize: () => ({ findingsTotal: 3, topFindings: [{ big: "x" }] }),
    sectorLabel: (k: string) => (k === "finance" ? "المالية" : k),
    listDocs: async () => [{ id: "d" }],
    retrieve: () => [{ docName: "نظام المشتريات", article: "12", text: "لا يجوز التجزئة" }],
    toPayload: (p: any[]) => p.map((x) => ({ source: `${x.docName} — المادة ${x.article}`, text: x.text })),
    loadLog: () => mem.log, saveLog: (l: any[]) => { mem.log = l; },
    loadDeleted: () => mem.deleted, saveDeleted: (s: Set<string>) => { mem.deleted = s; },
    basisOf: () => "none",
    track: (...a: string[]) => mem.events.push(a),
  };
  return { mem, tb: createToolbox(deps) };
}

describe("agent toolbox", () => {
  it("implements exactly the tools the server defines", () => {
    expect([...makeDeps().tb.names].sort()).toEqual([...TOOL_NAMES].sort());
  });

  it("lists findings by severity, filters, and caps the limit", async () => {
    const { tb } = makeDeps();
    const all = JSON.parse(await tb.run("list_findings", {}));
    expect(all.findings.map((f: any) => f.severity)).toEqual(["high", "medium", "low"]);
    expect(all.findings[0]).toMatchObject({ id: "F1", sector: "المالية" });
    const high = JSON.parse(await tb.run("list_findings", { severity: "high", limit: 999 }));
    expect(high.total_matching).toBe(1);
    const overview = JSON.parse(await tb.run("get_overview", {}));
    expect(overview.topFindings).toBeUndefined();
  });

  it("get_finding returns detail, and unknown ids give an error instead of throwing", async () => {
    const { tb } = makeDeps();
    expect(JSON.parse(await tb.run("get_finding", { id: "F1" })).samples[0].ref).toBe("R5");
    expect(JSON.parse(await tb.run("get_finding", { id: "F99" })).error).toBeTruthy();
    expect(JSON.parse(await tb.run("nope", {})).error).toContain("غير معروفة");
  });

  it("search_legal returns library passages verbatim, never invented", async () => {
    const { tb } = makeDeps();
    const r = JSON.parse(await tb.run("search_legal", { query: "تجزئة" }));
    expect(r.passages[0].source).toBe("نظام المشتريات — المادة 12");
  });

  it("record_review_decision logs, hides false positives, tags the agent, and fires an allowed audit event", async () => {
    const { tb, mem } = makeDeps();
    expect(tb.describe("record_review_decision", { id: "F1", decision: "false_positive" })).toContain("اختبار 5");
    const r = JSON.parse(await tb.run("record_review_decision", { id: "F1", decision: "false_positive", note: "بيانات تجريبية" }));
    expect(r.ok).toBe(true);
    expect(mem.log[0]).toMatchObject({ decision: "false_positive", autoHidden: true });
    expect(mem.log[0].note).toContain("[عبر الوكيل]");
    expect(mem.deleted.has("Payment_Vouchers|اختبار 5")).toBe(true);
    expect(mem.events[0]![0]).toBe("ui.finding.false_positive");
    // الملاحظة اختفت من القائمة بعد الإخفاء
    expect(JSON.parse(await tb.run("list_findings", {})).total_matching).toBe(2);
    expect(JSON.parse(await tb.run("record_review_decision", { id: "F1", decision: "approve" })).error).toBeTruthy();
  });

  it("oversized results are truncated, not sent whole", () => {
    expect(JSON.parse(stringifyResult({ a: "x".repeat(20000) })).truncated).toBe(true);
  });
});

// ---------- حلقة الوكيل ----------
const scripted = (steps: any[]) => {
  const seen: any[] = [];
  return { seen, callStep: async (req: any) => { seen.push(JSON.parse(JSON.stringify(req))); return steps.shift() ?? { text: "نهاية", toolCalls: [] }; } };
};
const fakeBox = (ran: string[] = []) => ({
  run: async (n: string, a: any) => { ran.push(n); return JSON.stringify({ ok: n, a }); },
  describe: (n: string) => n,
});

describe("agent loop", () => {
  it("runs a read tool then answers, feeding the result back to the model", async () => {
    const ran: string[] = [];
    const s = scripted([{ text: "", toolCalls: [{ id: "1", name: "get_overview", args: {} }] }, { text: "الخلاصة", toolCalls: [] }]);
    const events: any[] = [];
    const out = await runAgent({ history: [{ role: "user", content: "لخّص" }], callStep: s.callStep, toolbox: fakeBox(ran), approve: async () => true, onEvent: (e: any) => events.push(e) });
    expect(out.text).toBe("الخلاصة");
    expect(ran).toEqual(["get_overview"]);
    expect(s.seen[1].messages.at(-1)).toMatchObject({ role: "tool", toolCallId: "1" });
    expect(events.filter((e) => e.type === "tool").map((e) => e.status)).toEqual(["running", "done"]);
  });

  it("a write tool waits for approval; denial is reported to the model and nothing runs", async () => {
    const ran: string[] = [];
    const s = scripted([{ text: "", toolCalls: [{ id: "w", name: "record_review_decision", args: { id: "F1", decision: "confirmed" } }] }, { text: "حسنًا", toolCalls: [] }]);
    let asked = 0;
    await runAgent({ history: [{ role: "user", content: "سجّل" }], callStep: s.callStep, toolbox: fakeBox(ran), approve: async () => (asked++, false), onEvent: () => {} });
    expect(asked).toBe(1);
    expect(ran).toEqual([]);
    expect(JSON.parse(s.seen[1].messages.at(-1).content).denied).toBe(true);
  });

  it("approved write tools run", async () => {
    const ran: string[] = [];
    const s = scripted([{ text: "", toolCalls: [{ id: "w", name: "record_review_decision", args: {} }] }]);
    await runAgent({ history: [{ role: "user", content: "سجّل" }], callStep: s.callStep, toolbox: fakeBox(ran), approve: async () => true, onEvent: () => {} });
    expect(ran).toEqual(["record_review_decision"]);
  });

  it("stops at the step limit and asks for a tool-free summary", async () => {
    const loop = { text: "", toolCalls: [{ id: "x", name: "get_overview", args: {} }] };
    const s = scripted([loop, loop, loop, { text: "خلاصة جزئية", toolCalls: [] }]);
    const events: any[] = [];
    const out = await runAgent({ history: [{ role: "user", content: "ابحث" }], callStep: s.callStep, toolbox: fakeBox(), approve: async () => true, onEvent: (e: any) => events.push(e), maxSteps: 3 });
    expect(out.limited).toBe(true);
    expect(events.some((e) => e.type === "limit")).toBe(true);
    expect(s.seen[3].messages.at(-1).role).toBe("user");
  });

  it("aborting stops before the next call", async () => {
    const ctl = new AbortController();
    ctl.abort();
    const s = scripted([{ text: "x", toolCalls: [] }]);
    const out = await runAgent({ history: [{ role: "user", content: "a" }], callStep: s.callStep, toolbox: fakeBox(), approve: async () => true, onEvent: () => {}, signal: ctl.signal });
    expect(out.stopped).toBe(true);
    expect(s.seen).toHaveLength(0);
  });
});
