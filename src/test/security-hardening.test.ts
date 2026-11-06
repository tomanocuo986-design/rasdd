import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { clientIp } from "../server/client-ip.ts";
import { pgSsl } from "../server/pg-pool.ts";
import { createLimiter, memoryFailStore } from "../server/rate-limit.ts";
import { chi2Sf8, statisticalFindings } from "../rasd/statistical-tests.js";

process.env["AUTH_DATA_DIR"] = mkdtempSync(path.join(tmpdir(), "rasd-sec-"));
process.env["RASD_ADMINS"] = "1001";
process.env["AUTH_INVITE_CODE"] = "invite-xyz";
delete process.env["TRUST_PROXY_HOPS"];

let auth: typeof import("../server/auth.ts");
const PW = "correct-horse-1";
const post = (body: object, ip = "", cookie = "") =>
  new Request("http://x/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json", cookie, ...(ip ? { "x-forwarded-for": ip } : {}) },
    body: JSON.stringify(body),
  });
const reg = (id: string, extra: object = {}, ip = "") =>
  auth.handlePost(post({ action: "register", employeeId: id, password: PW, confirm: PW, inviteCode: "invite-xyz", ...extra }, ip));
const login = (id: string, password: string, ip = "") => auth.handlePost(post({ action: "login", employeeId: id, password }, ip));

beforeAll(async () => {
  auth = await import("../server/auth.ts");
});

describe("client IP is read from the proxy, not from what the client claims", () => {
  const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
  it("takes the last hop by default, so a forged first entry changes nothing", () => {
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), {})).toBe("203.0.113.9");
    expect(clientIp(req({ "x-forwarded-for": "7.7.7.7, 203.0.113.9" }), {})).toBe("203.0.113.9");
  });
  it("honours TRUST_PROXY_HOPS and ignores headers at 0", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" }), { TRUST_PROXY_HOPS: "2" })).toBe("2.2.2.2");
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1" }), { TRUST_PROXY_HOPS: "0" })).toBe("direct");
  });
  it("cf-connecting-ip only when explicitly trusted; garbage is rejected", () => {
    expect(clientIp(req({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "5.5.5.5" }), {})).toBe("5.5.5.5");
    expect(clientIp(req({ "cf-connecting-ip": "9.9.9.9" }), { TRUST_CF_CONNECTING_IP: "1" })).toBe("9.9.9.9");
    expect(clientIp(req({ "x-forwarded-for": "<script>" }), {})).toBe("unknown");
  });
});

describe("limiters", () => {
  it("sliding window per key", () => {
    const l = createLimiter({ max: 2, windowMs: 1000 });
    expect([l("a", 0), l("a", 1), l("a", 2)]).toEqual([false, false, true]);
    expect(l("b", 3)).toBe(false);
    expect(l("a", 2000)).toBe(false);
  });
  it("memory fail store locks at max and clears", async () => {
    const s = memoryFailStore();
    for (let i = 0; i < 3; i++) await s.note("k", 1000);
    expect(await s.isLocked("k", 3)).toBe(true);
    expect(await s.isLocked("k", 4)).toBe(false);
    await s.clear("k");
    expect(await s.isLocked("k", 3)).toBe(false);
  });
});

describe("database TLS", () => {
  it("verifies the certificate by default and only skips it on explicit no-verify", () => {
    expect(pgSsl({ DATABASE_SSL: "require" })).toEqual({ rejectUnauthorized: true });
    expect(pgSsl({ DATABASE_SSL: "no-verify" })).toEqual({ rejectUnauthorized: false });
    expect(pgSsl({})).toBeUndefined();
  });
});

describe("admin escalation via registration", () => {
  it("an elevated employee ID cannot be self-registered in open mode; ordinary IDs still can", async () => {
    process.env["AUTH_REGISTRATION"] = "open";
    expect((await reg("1001", { inviteCode: "" })).status).toBe(403);
    expect((await reg("2002", { inviteCode: "" })).status).toBe(200);
    // وبعد الرفض لم يُنشأ الحساب: يستطيع المدير الحقيقي تسجيله لاحقاً
    process.env["AUTH_REGISTRATION"] = "invite";
    const r = await reg("1001");
    expect(r.status).toBe(200);
    expect((await r.json()).user.role).toBe("admin");
  });
  it("closed mode refuses everyone except an elevated ID holding the invite code", async () => {
    process.env["AUTH_REGISTRATION"] = "closed";
    expect((await reg("3003")).status).toBe(403);
    process.env["RASD_ADMINS"] = "1001,1002";
    expect((await reg("1002", { inviteCode: "wrong" })).status).toBe(403);
    expect((await reg("1002")).status).toBe(200);
    process.env["RASD_ADMINS"] = "1001";
    process.env["AUTH_REGISTRATION"] = "invite";
  });
});

describe("brute-force limits", () => {
  it("a stranger failing from another address cannot lock the real employee out", async () => {
    await reg("VIC-1", {}, "10.0.0.1");
    for (let i = 0; i < 10; i++) await login("VIC-1", "bad-password-" + i, `fake-${i}, 198.51.100.7`);
    expect((await login("VIC-1", "bad-password-x", "fake-z, 198.51.100.7")).status).toBe(429); // المهاجم نفسه مقفل
    expect((await login("VIC-1", PW, "10.0.0.1")).status).toBe(200); // والموظف من عنوانه يدخل
  });
  it("rotating the forged first X-Forwarded-For entry does not reset the counter", async () => {
    for (let i = 0; i < 30; i++) await login("NOBODY-" + i, "bad-password-1", `spoof-${i}, 198.51.100.8`);
    expect((await login("NOBODY-new", "bad-password-1", "spoof-new, 198.51.100.8")).status).toBe(429);
  });
  it("unknown accounts cost about as much as wrong passwords (no timing oracle)", async () => {
    await reg("TIM-1", {}, "10.0.0.2");
    const time = async (id: string, n: number) => {
      const t: number[] = [];
      for (let i = 0; i < 3; i++) {
        const s = performance.now();
        await login(id, "bad-password-1", `10.1.${n}.${i}`);
        t.push(performance.now() - s);
      }
      return t.sort((a, b) => a - b)[1]!;
    };
    const known = await time("TIM-1", 1);
    const unknown = await time("GHOST-1", 2);
    expect(unknown).toBeGreaterThan(known * 0.5);
  });
});

describe("Benford with multiple datasets", () => {
  it("chi-square tail matches the textbook critical values", () => {
    expect(chi2Sf8(15.507)).toBeGreaterThan(0.049);
    expect(chi2Sf8(15.507)).toBeLessThan(0.051);
    expect(chi2Sf8(20.09)).toBeGreaterThan(0.0099);
    expect(chi2Sf8(20.09)).toBeLessThan(0.0101);
  });
  it("a borderline deviation flagged alone is not flagged once 30 datasets are tested", () => {
    // انحراف معتدل: χ² ≈ 17 فقط (p ≈ 0.03): يمر لمجموعة وحيدة كإنذار متوسط، ويسقط بعد تصحيح بونفروني على 30 مجموعة
    const props = [0.285, 0.18, 0.12, 0.1, 0.085, 0.07, 0.06, 0.05, 0.05];
    const n = 300;
    const digits: number[] = [];
    props.forEach((p, i) => {
      for (let k = 0; k < Math.round(p * n); k++) digits.push((i + 1) * 1000 + k);
    });
    const rows = digits.map((v) => ({ value: String(v) }));
    const mk = (k: string) => ({ key: k, fields: [{ key: "value", label: "القيمة", type: "number" }] });
    const one = statisticalFindings({ A0: rows }, [mk("A0")], () => "s", {});
    const keys = Array.from({ length: 30 }, (_, i) => "A" + i);
    const store = Object.fromEntries(keys.map((k) => [k, rows]));
    const many = statisticalFindings(store, keys.map(mk), () => "s", {});
    const hit = (f: any[]) => f.filter((x) => x.test.includes("قانون بنفورد")).length;
    expect(hit(many)).toBeLessThanOrEqual(hit(one));
  });
});
