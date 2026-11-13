import { beforeEach, describe, expect, it } from "vitest";
import {
  createEscrow,
  createVault,
  escrowInfo,
  flushVault,
  getCorrupted,
  hasEscrow,
  isUnlocked,
  lockVault,
  recoverVault,
  revokeEscrow,
  unlockVault,
} from "@/rasd/secure-vault.js";

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

const fast = { iterations: 1000, idleMinutes: 0 };
const PW = "كلمة-مرور-قوية-123";
const NEW_PW = "كلمة-مرور-جديدة-456";
const ls = () => globalThis.localStorage as unknown as MemStorage;
const meta = () => JSON.parse(ls().m.get("rasd-vault-meta") as string);

beforeEach(async () => {
  await lockVault();
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
});

async function legacyVault(password: string) {
  const subtle = globalThis.crypto.subtle;
  const enc = new TextEncoder();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iter = 1000;
  const base = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iter },
    base,
    256,
  );
  const hkdf = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const aes = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("rasd-aes-gcm") },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const { sealText, b64e } = await import("@/rasd/secure-vault.js");
  const keys = { aes, mac: undefined as unknown as CryptoKey };
  const check = await sealText(keys, "rasd-vault-ok", "meta");
  const sealed = await sealText(keys, "بيانات قديمة", "rasd-legacy");
  ls().m.set("rasd-vault-meta", JSON.stringify({ v: 1, iter, salt: b64e(salt), check }));
  ls().m.set("rasd-legacy", "rasdenc1:" + sealed);
}

describe("escrow", () => {
  it("ينشئ مفتاح طوارئ ويسترد به الخزنة بكلمة مرور جديدة والبيانات سليمة", async () => {
    await createVault(PW, fast);
    localStorage.setItem("rasd-audit-store", "سر التدقيق");
    const issued = await createEscrow(PW);
    expect(issued.code).toMatch(/^([0-9A-F]{8}-){7}[0-9A-F]{8}$/);
    expect(hasEscrow()).toBe(true);
    expect(escrowInfo()?.id).toBe(issued.id);
    expect(JSON.stringify(meta())).not.toContain(issued.code.replaceAll("-", ""));
    await lockVault();
    await recoverVault(issued.code.toLowerCase(), NEW_PW, fast);
    expect(isUnlocked()).toBe(true);
    expect(localStorage.getItem("rasd-audit-store")).toBe("سر التدقيق");
    await lockVault();
    await expect(unlockVault(PW, fast)).rejects.toMatchObject({ code: "wrong_password" });
    await unlockVault(NEW_PW, fast);
    expect(localStorage.getItem("rasd-audit-store")).toBe("سر التدقيق");
  });

  it("المفتاح يعمل مرة واحدة ثم يُبطل", async () => {
    await createVault(PW, fast);
    const { code } = await createEscrow(PW);
    await lockVault();
    await recoverVault(code, NEW_PW, fast);
    expect(hasEscrow()).toBe(false);
    await lockVault();
    await expect(recoverVault(code, "كلمة-أخرى-789-abc", fast)).rejects.toMatchObject({
      code: "no_escrow",
    });
  });

  it("يرفض مفتاحاً خاطئاً أو مشوّهاً ويبقى المفتاح الصحيح صالحاً", async () => {
    await createVault(PW, fast);
    const { code } = await createEscrow(PW);
    await lockVault();
    await expect(recoverVault("123", NEW_PW, fast)).rejects.toMatchObject({ code: "bad_code" });
    const wrong = "0".repeat(64).match(/.{8}/g)!.join("-");
    await expect(recoverVault(wrong, NEW_PW, fast)).rejects.toMatchObject({
      code: "wrong_recovery_code",
    });
    expect(isUnlocked()).toBe(false);
    await recoverVault(code, NEW_PW, fast);
    expect(isUnlocked()).toBe(true);
  });

  it("يرفض كلمة مرور جديدة ضعيفة دون استهلاك المفتاح", async () => {
    await createVault(PW, fast);
    const { code } = await createEscrow(PW);
    await lockVault();
    await expect(recoverVault(code, "123", fast)).rejects.toMatchObject({ code: "weak_password" });
    expect(hasEscrow()).toBe(true);
  });

  it("إنشاء المفتاح يتطلب خزنة مفتوحة وكلمة المرور الصحيحة", async () => {
    await createVault(PW, fast);
    await expect(createEscrow("خطأ-خطأ-خطأ-خطأ")).rejects.toMatchObject({ code: "wrong_password" });
    expect(hasEscrow()).toBe(false);
    await lockVault();
    await expect(createEscrow(PW)).rejects.toMatchObject({ code: "locked" });
  });

  it("الاستبدال يُبطل المفتاح السابق", async () => {
    await createVault(PW, fast);
    const first = await createEscrow(PW);
    const second = await createEscrow(PW);
    expect(second.id).not.toBe(first.id);
    await lockVault();
    await expect(recoverVault(first.code, NEW_PW, fast)).rejects.toMatchObject({
      code: "wrong_recovery_code",
    });
    await recoverVault(second.code, NEW_PW, fast);
    expect(isUnlocked()).toBe(true);
  });

  it("الإلغاء يزيل المفتاح", async () => {
    await createVault(PW, fast);
    const { code } = await createEscrow(PW);
    await expect(revokeEscrow("خطأ-خطأ-خطأ-خطأ")).rejects.toMatchObject({ code: "wrong_password" });
    await revokeEscrow(PW);
    expect(hasEscrow()).toBe(false);
    await lockVault();
    await expect(recoverVault(code, NEW_PW, fast)).rejects.toMatchObject({ code: "no_escrow" });
    await expect(unlockVault(PW, fast)).resolves.toBeUndefined();
  });

  it("خزنة قديمة (v1) تُفتح بكلمة مرورها وتُرقّى عند إنشاء المفتاح وتبقى بياناتها", async () => {
    await legacyVault(PW);
    await unlockVault(PW, fast);
    expect(getCorrupted()).toEqual([]);
    expect(localStorage.getItem("rasd-legacy")).toBe("بيانات قديمة");
    expect(meta().v).toBe(1);
    const { code } = await createEscrow(PW);
    expect(meta().v).toBe(2);
    await lockVault();
    await unlockVault(PW, fast);
    expect(localStorage.getItem("rasd-legacy")).toBe("بيانات قديمة");
    await lockVault();
    await recoverVault(code, NEW_PW, fast);
    expect(localStorage.getItem("rasd-legacy")).toBe("بيانات قديمة");
    await flushVault();
    await lockVault();
    await unlockVault(NEW_PW, fast);
    expect(localStorage.getItem("rasd-legacy")).toBe("بيانات قديمة");
  });

  it("لا يمكن الاسترداد والخزنة مفتوحة", async () => {
    await createVault(PW, fast);
    const { code } = await createEscrow(PW);
    await expect(recoverVault(code, NEW_PW, fast)).rejects.toMatchObject({ code: "unlocked" });
  });
});
