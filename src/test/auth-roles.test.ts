import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

process.env["AUTH_DATA_DIR"] = mkdtempSync(path.join(tmpdir(), "rasd-auth-"));
process.env["RASD_ADMINS"] = "ADMIN1";
process.env["RASD_REVIEWERS"] = "REV1";
process.env["AUTH_INVITE_CODE"] = "invite-123";

let auth: typeof import("../server/auth.ts");

const post = (body: object, cookie = "") =>
  new Request("http://x/api/auth", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
const get = (qs = "", cookie = "") => new Request(`http://x/api/auth${qs}`, { headers: { cookie } });
const cookieOf = (r: Response) => (r.headers.get("set-cookie") ?? "").split(";")[0];
const PW = "correct-horse-1";

async function register(id: string, extra: object = {}) {
  return auth.handlePost(post({ action: "register", employeeId: id, password: PW, confirm: PW, inviteCode: "invite-123", ...extra }));
}

beforeAll(async () => {
  auth = await import("../server/auth.ts");
});

describe("auth with roles, invite code and audit log", () => {
  it("requires the invite code to register", async () => {
    const r = await register("U-NOINVITE", { inviteCode: "wrong" });
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe("invite_required");
    expect((await auth.handleGet(get())).status).toBe(200);
    expect((await (await auth.handleGet(get())).json()).registration).toBe("invite");
  });

  it("registers an auditor; role is read from the server, not the cookie", async () => {
    const r = await register("U100");
    expect(r.status).toBe(200);
    expect((await r.json()).user).toEqual({ employeeId: "U100", role: "auditor" });
    const me = await (await auth.handleGet(get("", cookieOf(r)))).json();
    expect(me.user.role).toBe("auditor");
  });

  it("auditors cannot read the audit log or manage users; reviewers can read; admins manage", async () => {
    const aud = cookieOf(await register("U101"));
    expect((await auth.handleGet(get("?audit=1", aud))).status).toBe(403);
    expect((await auth.handleGet(get("?users=1", aud))).status).toBe(403);
    expect((await auth.handleGet(get("?audit=1"))).status).toBe(401);

    const rev = cookieOf(await register("REV1"));
    const log = await auth.handleGet(get("?audit=1", rev));
    expect(log.status).toBe(200);
    const body = await log.json();
    expect(body.verify.ok).toBe(true);
    expect(body.events.some((e: any) => e.action === "auth.register" && e.actor === "U101")).toBe(true);
    expect((await auth.handleGet(get("?users=1", rev))).status).toBe(403);

    const adm = cookieOf(await register("ADMIN1"));
    expect((await auth.handleGet(get("?users=1", adm))).status).toBe(200);
    const set = await auth.handlePost(post({ action: "set-role", employeeId: "U101", role: "reviewer" }, adm));
    expect(set.status).toBe(200);
    expect((await auth.handleGet(get("?audit=1", aud))).status).toBe(200); // الدور الجديد يسري فورًا بنفس الجلسة
  });

  it("stamps client events with the session identity and rejects unknown events", async () => {
    const c = cookieOf(await register("U102"));
    expect((await auth.handlePost(post({ action: "event", event: "ui.report.export", target: "t1" }))).status).toBe(401);
    expect((await auth.handlePost(post({ action: "event", event: "auth.login" }, c))).status).toBe(400);
    expect((await auth.handlePost(post({ action: "event", event: "ui.report.export", target: "t1", actor: "ADMIN1" }, c))).status).toBe(200);
    const adm = cookieOf(await auth.handlePost(post({ action: "login", employeeId: "ADMIN1", password: PW })));
    const events = (await (await auth.handleGet(get("?audit=1&limit=500", adm))).json()).events;
    const ev = events.find((e: any) => e.action === "ui.report.export");
    expect(ev.actor).toBe("U102");
    expect(ev.role).toBe("auditor");
  });

  it("logs failed logins and an admin cannot demote themselves", async () => {
    const bad = await auth.handlePost(post({ action: "login", employeeId: "U100", password: "wrong-password" }));
    expect(bad.status).toBe(401);
    const adm = cookieOf(await auth.handlePost(post({ action: "login", employeeId: "ADMIN1", password: PW })));
    const demote = await auth.handlePost(post({ action: "set-role", employeeId: "ADMIN1", role: "auditor" }, adm));
    expect(demote.status).toBe(400);
    const events = (await (await auth.handleGet(get("?audit=1&limit=500", adm))).json()).events;
    expect(events.some((e: any) => e.action === "auth.login_failed" && e.actor === "U100")).toBe(true);
  });
});

describe("server-side sessions: revocation", () => {
  const cookieValue = (c: string) => c.split("=")[1];
  // كوكي موقَّع بسر الخادم نفسه (الملف الذي يولّده auth.ts في AUTH_DATA_DIR) لنختبر الصيغ التي يرفضها الخادم رغم صحة التوقيع
  const signedCookie = (payload: object) => {
    const key = readFileSync(path.join(process.env["AUTH_DATA_DIR"]!, "auth-secret"), "utf8").trim();
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `rasd_session=${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
  };
  const tamper = (c: string, patch: object) => {
    const [body, mac] = cookieValue(c).split(".");
    const payload = { ...JSON.parse(Buffer.from(body, "base64url").toString()), ...patch };
    return `rasd_session=${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${mac}`;
  };
  const me = async (c: string) => (await (await auth.handleGet(get("", c))).json()).user;

  it("logout revokes the token on the server: replaying the old cookie no longer works", async () => {
    const c = cookieOf(await register("S-OUT1"));
    expect((await me(c))?.employeeId).toBe("S-OUT1");
    const out = await auth.handlePost(post({ action: "logout" }, c));
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await me(c)).toBeNull(); // الكوكي المنسوخ قبل الخروج لم يعد صالحاً
    expect((await auth.handlePost(post({ action: "event", event: "ui.report.export" }, c))).status).toBe(401);
  });

  it("logout only ends that session; other devices stay signed in", async () => {
    const a = cookieOf(await register("S-TWO"));
    const b = cookieOf(await auth.handlePost(post({ action: "login", employeeId: "S-TWO", password: PW })));
    expect(a).not.toBe(b);
    await auth.handlePost(post({ action: "logout" }, a));
    expect(await me(a)).toBeNull();
    expect((await me(b))?.employeeId).toBe("S-TWO");
  });

  it("logout-all ends every session of the user, and requires a session", async () => {
    expect((await auth.handlePost(post({ action: "logout-all" }))).status).toBe(401);
    const a = cookieOf(await register("S-ALL"));
    const b = cookieOf(await auth.handlePost(post({ action: "login", employeeId: "S-ALL", password: PW })));
    const r = await auth.handlePost(post({ action: "logout-all" }, a));
    expect(r.status).toBe(200);
    expect((await r.json()).revoked).toBe(2);
    expect(await me(a)).toBeNull();
    expect(await me(b)).toBeNull();
  });

  it("an admin can revoke another user's sessions; others cannot; it is logged", async () => {
    const victim = cookieOf(await register("S-VICTIM"));
    const aud = cookieOf(await register("S-AUD"));
    expect((await auth.handlePost(post({ action: "revoke-sessions", employeeId: "S-VICTIM" }, aud))).status).toBe(403);
    expect((await auth.handlePost(post({ action: "revoke-sessions", employeeId: "S-VICTIM" }))).status).toBe(401);
    expect((await me(victim))?.employeeId).toBe("S-VICTIM");

    const adm = cookieOf(await auth.handlePost(post({ action: "login", employeeId: "ADMIN1", password: PW })));
    expect((await auth.handlePost(post({ action: "revoke-sessions", employeeId: "NOBODY-X" }, adm))).status).toBe(404);
    const r = await auth.handlePost(post({ action: "revoke-sessions", employeeId: "S-VICTIM" }, adm));
    expect(r.status).toBe(200);
    expect((await r.json()).revoked).toBe(1);
    expect(await me(victim)).toBeNull();
    expect((await me(adm))?.employeeId).toBe("ADMIN1"); // جلسة المدير لم تتأثر

    const events = (await (await auth.handleGet(get("?audit=1&limit=500", adm))).json()).events;
    const ev = events.find((e: any) => e.action === "users.revoke_sessions" && e.target === "S-VICTIM");
    expect(ev?.actor).toBe("ADMIN1");
    expect(events.some((e: any) => e.action === "auth.logout" && e.actor === "S-OUT1")).toBe(true);
  });

  it("rejects a validly signed cookie with no session id (old format) or an unknown one, and tampering", async () => {
    const c = cookieOf(await register("S-FORGE"));
    const exp = Date.now() + 3600_000;
    expect(await me(signedCookie({ e: "S-FORGE", exp }))).toBeNull(); // الصيغة القديمة بلا معرّف
    expect(await me(signedCookie({ e: "S-FORGE", sid: "does-not-exist", exp }))).toBeNull();
    expect(await me(tamper(c, { e: "ADMIN1" }))).toBeNull(); // تعديل الحمولة يُسقط التوقيع
    // معرّف جلسة حيّة لمستخدم آخر لا يصلح لانتحال غيره
    const real = JSON.parse(Buffer.from(cookieValue(c).split(".")[0], "base64url").toString());
    expect(await me(signedCookie({ e: "ADMIN1", sid: real.sid, exp }))).toBeNull();
    expect((await me(c))?.employeeId).toBe("S-FORGE");
  });

  it("concurrent logins all get distinct live sessions (no lost writes in the file store)", async () => {
    await register("S-CONC");
    const cookies = (
      await Promise.all(Array.from({ length: 6 }, () => auth.handlePost(post({ action: "login", employeeId: "S-CONC", password: PW }))))
    ).map(cookieOf);
    expect(new Set(cookies).size).toBe(6);
    for (const c of cookies) expect((await me(c))?.employeeId).toBe("S-CONC");
  });
});

describe("audit endpoint target filter", () => {
  it("filters by target, keeps full-chain verification, and exposes matched count", async () => {
    const rev = cookieOf(await auth.handlePost(post({ action: "login", employeeId: "REV1", password: PW })));
    const aud = cookieOf(await register("U300"));
    for (const target of ["obs-a", "obs-b", "obs-a"]) {
      const r = await auth.handlePost(post({ action: "event", event: "ui.finding.approve", target }, aud));
      expect(r.status).toBe(200);
    }
    const body = await (await auth.handleGet(get("?audit=1&limit=500&target=obs-a", rev))).json();
    expect(body.verify.ok).toBe(true);
    expect(body.matched).toBe(2);
    expect(body.events.every((e: { target: string }) => e.target === "obs-a")).toBe(true);
    expect(body.total).toBeGreaterThan(body.matched);
  });

  it("accepts the vault escrow events and rejects unknown ones", async () => {
    const aud = cookieOf(await register("U301"));
    for (const event of ["ui.vault.escrow_create", "ui.vault.escrow_use", "ui.vault.escrow_revoke", "ui.vault.escrow_failed"]) {
      expect((await auth.handlePost(post({ action: "event", event, target: "vault", detail: "id=AB12" }, aud))).status).toBe(200);
    }
    expect((await auth.handlePost(post({ action: "event", event: "ui.vault.other" }, aud))).status).toBe(400);
  });
});
