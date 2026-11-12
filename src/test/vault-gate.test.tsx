// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const PW = "كلمة-مرور-قوية-123";

class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.m.set(String(k), String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

function freshStorage() {
  Object.defineProperty(globalThis, "Storage", { value: MemStorage, configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", { value: new MemStorage(), configurable: true, writable: true });
}

async function load(mode: string) {
  vi.resetModules();
  vi.stubEnv("MODE", mode);
  vi.stubEnv("VITE_VAULT_IDLE_MIN", "0");
  const gate = await import("@/rasd/VaultGate.jsx");
  const vault = await import("@/rasd/secure-vault.js");
  return { ...gate, ...vault };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  freshStorage();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("VaultGate", () => {
  it("في وضع الاختبار/التعطيل يعرض المحتوى مباشرة", async () => {
    const { VaultGate } = await load("test");
    render(
      <VaultGate>
        <p>المحتوى</p>
      </VaultGate>,
    );
    await waitFor(() => expect(screen.getByText("المحتوى")).toBeTruthy());
    expect(screen.queryByTestId("vault-lock")).toBeNull();
  });

  it("إنشاء كلمة مرور ثم قفل ثم فتح، والمحتوى لا يظهر قبل الفتح", async () => {
    const { VaultGate, lockVault } = await load("development");
    const { container } = render(
      <VaultGate>
        <p>المحتوى</p>
      </VaultGate>,
    );
    await waitFor(() => expect(screen.getByLabelText("كلمة المرور")).toBeTruthy());
    expect(screen.queryByText("المحتوى")).toBeNull();

    fireEvent.change(screen.getByLabelText("كلمة المرور"), { target: { value: "قصيرة" } });
    fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), { target: { value: "قصيرة" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByTestId("vault-error")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("كلمة المرور"), { target: { value: PW } });
    fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), { target: { value: PW } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText("المحتوى")).toBeTruthy(), { timeout: 10000 });

    localStorage.setItem("rasd-audit-store", '{"سر":1}');
    await lockVault("manual");
    await waitFor(() => expect(screen.queryByText("المحتوى")).toBeNull());
    await waitFor(() => expect(screen.getByLabelText("كلمة المرور")).toBeTruthy());
    expect(localStorage.getItem("rasd-audit-store")?.startsWith("rasdenc1:")).toBe(true);

    fireEvent.change(screen.getByLabelText("كلمة المرور"), { target: { value: "كلمة-خاطئة-تماما" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByTestId("vault-error").textContent).toContain("غير صحيحة"), {
      timeout: 10000,
    });
    expect(screen.queryByText("المحتوى")).toBeNull();

    fireEvent.change(screen.getByLabelText("كلمة المرور"), { target: { value: PW } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText("المحتوى")).toBeTruthy(), { timeout: 10000 });
    expect(localStorage.getItem("rasd-audit-store")).toBe('{"سر":1}');
  }, 60000);
});
