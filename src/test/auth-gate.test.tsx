import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthGate } from "@/components/AuthGate";

type Call = { url: string; body?: any };
let calls: Call[];
let signedIn: boolean;
let logoutOk: boolean;

beforeEach(() => {
  calls = [];
  signedIn = true;
  logoutOk = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });
      const res = (status: number, data: unknown) => ({ ok: status < 400, status, json: async () => data }) as Response;
      if (!init || init.method !== "POST") return res(200, { user: signedIn ? { employeeId: "U100", role: "auditor" } : null, registration: "open" });
      if (body.action === "logout" || body.action === "logout-all") {
        if (!logoutOk) return res(500, {});
        signedIn = false;
        return res(200, { ok: true });
      }
      return res(400, { error: "bad_request" });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const open = async () => {
  render(
    <AuthGate>
      <div>محتوى المنصة</div>
    </AuthGate>,
  );
  await screen.findByText("محتوى المنصة");
  fireEvent.click(screen.getByRole("button", { name: "الحساب" }));
};

describe("AuthGate account bar", () => {
  it("shows the signed-in employee and the platform", async () => {
    await open();
    expect(screen.getByText("الحساب: U100")).toBeTruthy();
    expect(screen.getByText("محتوى المنصة")).toBeTruthy();
  });

  it("logout calls the server and returns to the login form", async () => {
    await open();
    fireEvent.click(screen.getByRole("menuitem", { name: "تسجيل الخروج" }));
    await screen.findByText("تسجيل الدخول", { selector: "h1" });
    expect(calls.some((c) => c.body?.action === "logout")).toBe(true);
    expect(screen.queryByText("محتوى المنصة")).toBeNull();
  });

  it("logout-all sends the logout-all action", async () => {
    await open();
    fireEvent.click(screen.getByRole("menuitem", { name: "الخروج من كل الأجهزة" }));
    await screen.findByText("تسجيل الدخول", { selector: "h1" });
    expect(calls.some((c) => c.body?.action === "logout-all")).toBe(true);
  });

  it("stays signed in and shows an error if the server did not confirm the logout", async () => {
    logoutOk = false;
    await open();
    fireEvent.click(screen.getByRole("menuitem", { name: "تسجيل الخروج" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("محتوى المنصة")).toBeTruthy();
  });

  it("is not shown on the login form", async () => {
    signedIn = false;
    render(
      <AuthGate>
        <div>محتوى المنصة</div>
      </AuthGate>,
    );
    await screen.findByText("تسجيل الدخول", { selector: "h1" });
    expect(screen.queryByTestId("account-bar")).toBeNull();
  });
});
