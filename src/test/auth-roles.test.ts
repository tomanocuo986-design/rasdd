import { mkdtempSync } from "node:fs";
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
