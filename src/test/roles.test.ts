import { describe, expect, it } from "vitest";
import { bootstrapRole, can, effectiveRole, isClientEvent, registrationPolicy } from "../server/roles.ts";

describe("roles", () => {
  it("grants permissions by role", () => {
    expect(can("auditor", "chat.use")).toBe(true);
    expect(can("auditor", "audit.read")).toBe(false);
    expect(can("reviewer", "audit.read")).toBe(true);
    expect(can("reviewer", "users.manage")).toBe(false);
    expect(can("admin", "users.manage")).toBe(true);
    expect(can(undefined, "chat.use")).toBe(false);
  });

  it("environment bootstrap wins over the stored role", () => {
    const env = { RASD_ADMINS: "a1, 9000", RASD_REVIEWERS: "r1" };
    expect(bootstrapRole("a1", env)).toBe("admin");
    expect(bootstrapRole("R1", env)).toBe("reviewer");
    expect(effectiveRole({ employeeId: "a1", role: "auditor" }, env)).toBe("admin");
    expect(effectiveRole({ employeeId: "x", role: "reviewer" }, env)).toBe("reviewer");
    expect(effectiveRole({ employeeId: "x", role: "hacker" }, env)).toBe("auditor");
  });

  it("registration policy", () => {
    expect(registrationPolicy({})).toBe("closed"); // النسيان لا يفتح التسجيل
    expect(registrationPolicy({ AUTH_REGISTRATION: "open" })).toBe("open");
    expect(registrationPolicy({ AUTH_INVITE_CODE: "abc" })).toBe("invite");
    expect(registrationPolicy({ AUTH_REGISTRATION: "closed", AUTH_INVITE_CODE: "abc" })).toBe("closed");
  });

  it("only whitelisted client events are accepted", () => {
    expect(isClientEvent("ui.report.export")).toBe(true);
    expect(isClientEvent("auth.login")).toBe(false);
    expect(isClientEvent("ui.anything")).toBe(false);
  });
});
