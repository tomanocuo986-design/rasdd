// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const PW = "كلمة-مرور-قوية-123";
const NEW_PW = "كلمة-مرور-جديدة-456";

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

async function load() {
  vi.resetModules();
  vi.stubEnv("MODE", "development");
  vi.stubEnv("VITE_VAULT_IDLE_MIN", "0");
  const gate = await import("@/rasd/VaultGate.jsx");
  const vault = await import("@/rasd/secure-vault.js");
  return { ...gate, ...vault };
}

const events: string[] = [];

beforeEach(() => {
  events.length = 0;
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "Storage", {
    value: MemStorage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemStorage(),
    configurable: true,
    writable: true,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      try {
        events.push(JSON.parse(String(init?.body)).event);
      } catch {
        events.push("?");
      }
      return new Response("{}", { status: 200 });
    }),
  );
});

afterEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("VaultGate escrow flow", () => {
  it("ينشئ المفتاح من اللوحة ثم يسترد به بعد القفل ويسجّل الأحداث", async () => {
    const { VaultGate, lockVault, hasEscrow } = await load();
    const { container } = render(
      <VaultGate>
        <p>المحتوى</p>
      </VaultGate>,
    );
    await waitFor(() => expect(screen.getByLabelText("كلمة المرور")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("كلمة المرور"), { target: { value: PW } });
    fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), { target: { value: PW } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText("المحتوى")).toBeTruthy(), { timeout: 10000 });

    const { openEscrowPanel } = await import("@/rasd/VaultEscrowPanel.jsx");
    act(() => openEscrowPanel());
    fireEvent.change(screen.getByLabelText("كلمة مرور التخزين للتأكيد"), {
      target: { value: "خطأ-خطأ-خطأ-خطأ" },
    });
    fireEvent.click(screen.getByTestId("vault-escrow-create"));
    await waitFor(() => expect(screen.getByTestId("vault-escrow-error")).toBeTruthy(), {
      timeout: 10000,
    });

    fireEvent.change(screen.getByLabelText("كلمة مرور التخزين للتأكيد"), { target: { value: PW } });
    fireEvent.click(screen.getByTestId("vault-escrow-create"));
    await waitFor(() => expect(screen.getByTestId("vault-escrow-code")).toBeTruthy(), {
      timeout: 10000,
    });
    const code = screen.getByTestId("vault-escrow-code").textContent as string;
    expect(code).toMatch(/^([0-9A-F]{8}-){7}[0-9A-F]{8}$/);
    expect((screen.getByTestId("vault-escrow-done") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("vault-escrow-saved"));
    fireEvent.click(screen.getByTestId("vault-escrow-done"));
    expect(hasEscrow()).toBe(true);

    await lockVault("manual");
    await waitFor(() => expect(screen.getByTestId("vault-recover-open")).toBeTruthy());
    fireEvent.click(screen.getByTestId("vault-recover-open"));

    fireEvent.change(screen.getByLabelText("مفتاح الطوارئ"), { target: { value: "0".repeat(64) } });
    fireEvent.change(screen.getByLabelText("كلمة المرور الجديدة"), { target: { value: NEW_PW } });
    fireEvent.change(screen.getByLabelText("تأكيد كلمة المرور"), { target: { value: NEW_PW } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(
      () => expect(screen.getByTestId("vault-error").textContent).toContain("غير صحيح"),
      { timeout: 10000 },
    );
    expect(screen.queryByText("المحتوى")).toBeNull();

    fireEvent.change(screen.getByLabelText("مفتاح الطوارئ"), { target: { value: code } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText("المحتوى")).toBeTruthy(), { timeout: 10000 });
    expect(screen.getByTestId("vault-escrow-after")).toBeTruthy();
    expect(hasEscrow()).toBe(false);

    await waitFor(() =>
      expect(events).toEqual(
        expect.arrayContaining([
          "ui.vault.escrow_create",
          "ui.vault.escrow_failed",
          "ui.vault.escrow_use",
        ]),
      ),
    );
  }, 90000);
});
