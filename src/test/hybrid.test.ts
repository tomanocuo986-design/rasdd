import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson, isEncryptedEnvelope } from "../rasd/crypto.js";
import { importBackup, buildBackup, localKeys, daysSinceBackup, LAST_BACKUP_KEY } from "../rasd/backup.js";
import { jsonToSheets, xmlToSheets, rowsFromAoaChunked } from "../rasd/import-formats.js";
import { mapSheets, rowsFromAoa } from "../rasd/import-table.js";
import { dataFingerprint, pullWorkspace, pushWorkspace, saveSyncConfig } from "../rasd/sync.js";
import { decryptField, encryptField, loadKeyRing, needsRotation } from "../server/field-crypto.ts";
import { handleWorkspaces, memoryRepo, parseTokens, type Deps } from "../server/workspaces.ts";
import { openaiBody, providerFromEnv, sseToText, systemFor, textFromEvent } from "../server/llm.ts";

class FakeStorage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}
const fileOf = (o: unknown) => ({ text: async () => (typeof o === "string" ? o : JSON.stringify(o)) }) as any;

const fields = [
  { key: "order_no", label: "رقم أمر الحركة", type: "text" },
  { key: "driver", label: "اسم السائق", type: "text" },
  { key: "amount", label: "المبلغ", type: "number" },
];
const datasets = [{ key: "Fleet_Movement_Orders", label: "أوامر الحركة", fields }];

describe("encrypted backup", () => {
  it("round-trips and rejects a wrong passphrase or tampering", async () => {
    const env = await encryptJson({ a: "بيانات سرية" }, "correct horse battery", 1000);
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(JSON.stringify(env)).not.toContain("سرية");
    expect(await decryptJson(env, "correct horse battery")).toEqual({ a: "بيانات سرية" });
    await expect(decryptJson(env, "wrong passphrase!")).rejects.toThrow("كلمة المرور");
    const bad = { ...env, data: env.data.slice(0, -4) + "AAAA" };
    await expect(decryptJson(bad, "correct horse battery")).rejects.toThrow();
    await expect(encryptJson({}, "short")).rejects.toThrow("8");
  });

  it("restores an encrypted backup file into a fresh storage, never touching sync secrets", async () => {
    const src = new FakeStorage();
    src.setItem("rasd-audit-store", '{"x":1}');
    src.setItem("rasd-sync-token", "secret-token-1234567890");
    expect(localKeys(src as any)).toEqual(["rasd-audit-store"]);
    const backup = await buildBackup(src as any);
    expect(Object.keys(backup.data)).toEqual(["rasd-audit-store"]);
    const env = await encryptJson(backup, "passphrase-123", 1000);
    const dst = new FakeStorage();
    dst.setItem("rasd-sync-token", "device-token-abcdefghij");
    await expect(importBackup(fileOf(env), dst as any)).rejects.toThrow("مشفّرة");
    const r = await importBackup(fileOf(env), dst as any, "passphrase-123");
    expect(r.keys).toBe(1);
    expect(dst.getItem("rasd-audit-store")).toBe('{"x":1}');
    expect(dst.getItem("rasd-sync-token")).toBe("device-token-abcdefghij");
  });

  it("reminds when no recent backup exists", () => {
    const s = new FakeStorage();
    expect(daysSinceBackup(s as any)).toBe(Infinity);
    s.setItem(LAST_BACKUP_KEY, new Date(Date.now() - 3 * 864e5).toISOString());
    expect(daysSinceBackup(s as any)).toBe(3);
  });
});

describe("JSON / XML import pipeline", () => {
  it("maps a JSON export with nested objects onto a dataset", () => {
    const json = JSON.stringify({ data: { orders: [
      { "رقم أمر الحركة": "101", driver: { x: 1 }, "اسم السائق": "أحمد", "المبلغ": "1,250" },
      { "رقم أمر الحركة": "102", "اسم السائق": "خالد", "المبلغ": 40 },
    ] } });
    const { imports } = mapSheets(jsonToSheets(json), datasets);
    expect(imports).toHaveLength(1);
    expect(imports[0].rows.map((r: any) => r.order_no)).toEqual(["101", "102"]);
    expect(imports[0].rows[0].amount).toBe("1250");
    expect(() => jsonToSheets("{bad")).toThrow("JSON");
    expect(() => jsonToSheets('{"a":1}')).toThrow();
  });

  it("maps XML: attributes, nested nodes, CDATA, entities, repeated record element", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <Export><!-- c --><Meta><Count>2</Count></Meta>
      <Orders>
        <Order id="1"><No>101</No><Info><Driver>أحمد &amp; شركاه</Driver></Info><Amount>1,250</Amount></Order>
        <Order id="2"><No>102</No><Info><Driver><![CDATA[خالد <x>]]></Driver></Info><Amount>40</Amount></Order>
        <Order id="3"/>
      </Orders></Export>`;
    const [sheet] = xmlToSheets(xml);
    expect(sheet.name).toBe("Order");
    expect(sheet.aoa[0]).toEqual(["id", "No", "Info.Driver", "Amount"]);
    expect(sheet.aoa[1]).toEqual(["1", "101", "أحمد & شركاه", "1,250"]);
    expect(sheet.aoa[2]?.[2]).toBe("خالد <x>");
    const ds = [{ key: "T", label: "T", fields: [
      { key: "no", label: "No", type: "text" }, { key: "driver", label: "Info.Driver", type: "text" }, { key: "amt", label: "Amount", type: "number" } ] }];
    const { imports } = mapSheets([sheet], ds);
    expect(imports[0].rows[0]).toMatchObject({ no: "101", amt: "1250" });
    expect(() => xmlToSheets("<a></a>")).toThrow("XML");
  });

  it("chunked conversion equals the one-shot result and yields between chunks", async () => {
    const aoa: string[][] = [["تقرير"], ["رقم أمر الحركة", "اسم السائق", "المبلغ"]];
    for (let i = 0; i < 2503; i++) aoa.push([String(i), `سائق ${i}`, `${i},5`]);
    let yields = 0, last = 0;
    const r = await rowsFromAoaChunked(aoa, fields, { chunk: 1000, yieldFn: async () => { yields++; }, onProgress: (p) => (last = p) });
    expect(r.rows).toEqual(rowsFromAoa(aoa, fields).rows);
    expect(r.rows).toHaveLength(2503);
    expect(yields).toBe(2);
    expect(last).toBe(1);
  });
});

const KEY = Buffer.alloc(32, 7).toString("base64");
const mkDeps = (): Deps => ({
  repo: memoryRepo(),
  ring: loadKeyRing({ RASD_DATA_KEY: KEY }),
  tokens: parseTokens("alice:alice-token-0123456789,bob:bob-token-0123456789"),
  maxPayloadBytes: 1024 * 1024,
});
const req = (method: string, token: string | null, q = "", body?: unknown) =>
  new Request(`http://x/api/workspaces${q}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe("column-level encryption", () => {
  it("binds ciphertext to its row and supports key rotation", () => {
    const ring = loadKeyRing({ RASD_DATA_KEY: KEY });
    const t = encryptField(ring, "نص", "alice:ws1");
    expect(decryptField(ring, t, "alice:ws1")).toBe("نص");
    expect(() => decryptField(ring, t, "bob:ws1")).toThrow();
    const NEW = Buffer.alloc(32, 9).toString("base64");
    const rotated = loadKeyRing({ RASD_DATA_KEY: NEW, RASD_DATA_KEY_PREV: KEY });
    expect(decryptField(rotated, t, "alice:ws1")).toBe("نص");
    expect(needsRotation(rotated, t)).toBe(true);
    expect(() => loadKeyRing({ RASD_DATA_KEY: "abc" })).toThrow("32");
    expect(() => decryptField(loadKeyRing({ RASD_DATA_KEY: NEW }), t, "alice:ws1")).toThrow();
  });
});

describe("/api/workspaces handler", () => {
  it("requires a valid token and isolates owners", async () => {
    const d = mkDeps();
    expect((await handleWorkspaces(req("GET", null), d)).status).toBe(401);
    expect((await handleWorkspaces(req("GET", "nope-nope-nope-nope"), d)).status).toBe(401);
    const put = await handleWorkspaces(req("PUT", "alice-token-0123456789", "?id=ws1", { name: "س", payload: { a: 1 }, baseVersion: 0 }), d);
    expect(put.status).toBe(200);
    expect((await put.json()).version).toBe(1);
    expect((await handleWorkspaces(req("GET", "bob-token-0123456789", "?id=ws1"), d)).status).toBe(404);
    const list = await (await handleWorkspaces(req("GET", "alice-token-0123456789"), d)).json();
    expect(list.workspaces).toEqual([expect.objectContaining({ id: "ws1", name: "س", version: 1 })]);
    const got = await (await handleWorkspaces(req("GET", "alice-token-0123456789", "?id=ws1"), d)).json();
    expect(got.payload).toEqual({ a: 1 });
  });

  it("stores only ciphertext and detects version conflicts", async () => {
    const d = mkDeps();
    const t = "alice-token-0123456789";
    await handleWorkspaces(req("PUT", t, "?id=w", { name: "اسم", payload: { secret: "بلدية" }, baseVersion: 0 }), d);
    const row = await d.repo.get("alice", "w");
    expect(row!.payloadEnc).not.toContain("بلدية");
    expect(row!.nameEnc.startsWith("v1.")).toBe(true);
    const stale = await handleWorkspaces(req("PUT", t, "?id=w", { name: "اسم", payload: {}, baseVersion: 0 }), d);
    expect(stale.status).toBe(409);
    expect((await stale.json()).currentVersion).toBe(1);
    const ok = await handleWorkspaces(req("PUT", t, "?id=w", { name: "اسم", payload: { v: 2 }, baseVersion: 1 }), d);
    expect((await ok.json()).version).toBe(2);
  });

  it("validates input and size, and deletes", async () => {
    const d = mkDeps();
    const t = "alice-token-0123456789";
    expect((await handleWorkspaces(req("PUT", t, "?id=../x", { name: "a", payload: {}, baseVersion: 0 }), d)).status).toBe(400);
    expect((await handleWorkspaces(req("PUT", t, "?id=w", { name: "", payload: {}, baseVersion: 0 }), d)).status).toBe(400);
    expect((await handleWorkspaces(req("PUT", t, "?id=w", { name: "a", payload: {}, baseVersion: "0" }), d)).status).toBe(400);
    d.maxPayloadBytes = 50;
    expect((await handleWorkspaces(req("PUT", t, "?id=w", { name: "a", payload: { big: "x".repeat(100) }, baseVersion: 0 }), d)).status).toBe(413);
    d.maxPayloadBytes = 1e6;
    await handleWorkspaces(req("PUT", t, "?id=w", { name: "a", payload: {}, baseVersion: 0 }), d);
    expect((await handleWorkspaces(req("DELETE", t, "?id=w"), d)).status).toBe(200);
    expect((await handleWorkspaces(req("DELETE", t, "?id=w"), d)).status).toBe(404);
  });
});

describe("client sync <-> server", () => {
  it("pushes from one device and pulls on another; conflicts need an explicit overwrite", async () => {
    const d = mkDeps();
    const fetchFn = ((url: string, init: any) => handleWorkspaces(new Request(url.startsWith("http") ? url : `http://x${url}`, init), d)) as any;
    const a = new FakeStorage(), b = new FakeStorage();
    for (const s of [a, b]) saveSyncConfig({ token: "alice-token-0123456789", id: "ws-1" }, s as any);
    a.setItem("rasd-audit-store", '{"rows":[1,2,3]}');
    const h0 = dataFingerprint(a as any);
    a.setItem("rasd-audit-store", '{"rows":[1,2,3,4]}');
    expect(dataFingerprint(a as any)).not.toBe(h0);
    expect((await pushWorkspace({ storage: a as any, fetchFn })).version).toBe(1);
    const r = await pullWorkspace({ storage: b as any, fetchFn });
    expect(b.getItem("rasd-audit-store")).toBe('{"rows":[1,2,3,4]}');
    expect(r.version).toBe(1);
    await pushWorkspace({ storage: b as any, fetchFn }); // b -> v2
    await expect(pushWorkspace({ storage: a as any, fetchFn })).rejects.toMatchObject({ status: 409 });
    expect((await pushWorkspace({ storage: a as any, fetchFn, force: true })).version).toBe(3);
  });
});

describe("LLM providers", () => {
  it("prefers a local OpenAI-compatible server over Gemini", () => {
    expect(providerFromEnv({})).toBeNull();
    expect(providerFromEnv({ GEMINI_API_KEY: "k" })).toMatchObject({ kind: "gemini" });
    expect(providerFromEnv({ GEMINI_API_KEY: "k", LLM_BASE_URL: "http://ollama:11434/v1/", LLM_MODEL: "qwen2.5" })).toEqual({
      kind: "openai", baseUrl: "http://ollama:11434/v1", model: "qwen2.5", apiKey: "" });
  });

  it("report mode forbids invented articles and carries the context", () => {
    const s = systemFor("report", '{"a":1}');
    expect(s).toContain("ممنوع تمامًا اختراع رقم مادة");
    expect(s).toContain('{"a":1}');
    expect(JSON.parse(openaiBody("m", "sys", [{ role: "user", content: "hi" }], 10)).messages[0]).toEqual({ role: "system", content: "sys" });
  });

  it("decodes both SSE dialects, including a split chunk and a final line without newline", async () => {
    expect(textFromEvent("openai", '{"choices":[{"delta":{"content":"أ"}}]}')).toBe("أ");
    expect(textFromEvent("openai", "[DONE]")).toBe("");
    expect(textFromEvent("gemini", '{"candidates":[{"content":{"parts":[{"text":"ب"},{"text":"ج"}]}}]}')).toBe("بج");
    const enc = new TextEncoder();
    const run = async (kind: "openai" | "gemini", chunks: string[]) => {
      const rs = new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } });
      return await new Response(rs.pipeThrough(sseToText(kind))).text();
    };
    const l1 = 'data: {"choices":[{"delta":{"content":"مر"}}]}\n\n';
    const l2 = 'data: {"choices":[{"delta":{"content":"حبا"}}]}';
    expect(await run("openai", [l1.slice(0, 20), l1.slice(20), l2, "\n\ndata: [DONE]"])).toBe("مرحبا");
  });
});
