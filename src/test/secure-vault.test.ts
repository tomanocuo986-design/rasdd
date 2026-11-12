import { beforeEach, describe, expect, it } from "vitest";
import {
  createVault,
  flushVault,
  getCorrupted,
  hasVault,
  isUnlocked,
  lockVault,
  resetVault,
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
const ls = () => globalThis.localStorage as unknown as MemStorage;
const rawGet = (k: string) => ls().m.get(k);

beforeEach(async () => {
  await lockVault();
  (globalThis as any).Storage = MemStorage;
  (globalThis as any).localStorage = new MemStorage();
});

describe("secure-vault", () => {
  it("يشفّر المفاتيح المحمية ويُرجعها نصاً عند القراءة", async () => {
    await createVault(PW, fast);
    localStorage.setItem("rasd-audit-store", JSON.stringify({ a: "سري جدا" }));
    expect(localStorage.getItem("rasd-audit-store")).toContain("سري جدا");
    await flushVault();
    expect(rawGet("rasd-audit-store")?.startsWith("rasdenc1:")).toBe(true);
    expect(rawGet("rasd-audit-store")).not.toContain("سري");
    expect(rawGet("rasd-vault-meta")).not.toContain(PW);
  });

  it("لا يمسّ المفاتيح غير المحمية", async () => {
    await createVault(PW, fast);
    localStorage.setItem("theme", "dark");
    localStorage.setItem("rasd_session_id", "abc");
    await flushVault();
    expect(rawGet("theme")).toBe("dark");
    expect(rawGet("rasd_session_id")).toBe("abc");
  });

  it("يفكّ التشفير بعد القفل بكلمة المرور الصحيحة ويرفض الخاطئة", async () => {
    await createVault(PW, fast);
    localStorage.setItem("rasd-obs-edits", "x1");
    await lockVault();
    expect(isUnlocked()).toBe(false);
    expect(hasVault()).toBe(true);
    expect(rawGet("rasd-obs-edits")?.startsWith("rasdenc1:")).toBe(true);
    await expect(unlockVault("خطأ-خطأ-خطأ", fast)).rejects.toMatchObject({ code: "wrong_password" });
    expect(isUnlocked()).toBe(false);
    await unlockVault(PW, fast);
    expect(localStorage.getItem("rasd-obs-edits")).toBe("x1");
  });

  it("يرحّل البيانات النصية القديمة إلى مشفّرة عند أول فتح", async () => {
    localStorage.setItem("rasd-audit-reports", '[{"id":1}]');
    await createVault(PW, fast);
    await flushVault();
    expect(rawGet("rasd-audit-reports")?.startsWith("rasdenc1:")).toBe(true);
    expect(localStorage.getItem("rasd-audit-reports")).toBe('[{"id":1}]');
  });

  it("يكشف العبث ويمنع تبديل القيم بين المفاتيح", async () => {
    await createVault(PW, fast);
    localStorage.setItem("rasd-a", "one");
    localStorage.setItem("rasd-b", "two");
    await lockVault();
    const a = rawGet("rasd-a") as string;
    ls().m.set("rasd-b", a);
    const flipped = (rawGet("rasd-a") as string).slice(0, -4) + "AAAA";
    ls().m.set("rasd-a", flipped);
    await unlockVault(PW, fast);
    expect(getCorrupted().sort()).toEqual(["rasd-a", "rasd-b"]);
    expect(localStorage.getItem("rasd-a")).toBeNull();
    expect(localStorage.getItem("rasd-b")).toBeNull();
  });

  it("removeItem وclear يعملان على الذاكرة والتخزين", async () => {
    await createVault(PW, fast);
    localStorage.setItem("rasd-x", "1");
    await flushVault();
    localStorage.removeItem("rasd-x");
    expect(localStorage.getItem("rasd-x")).toBeNull();
    expect(rawGet("rasd-x")).toBeUndefined();
    localStorage.setItem("rasd-y", "2");
    localStorage.clear();
    await flushVault();
    expect(localStorage.getItem("rasd-y")).toBeNull();
    expect(hasVault()).toBe(true);
  });

  it("إعادة الضبط تمسح المحمي والبيانات الوصفية فقط", async () => {
    await createVault(PW, fast);
    localStorage.setItem("rasd-x", "1");
    localStorage.setItem("theme", "dark");
    await resetVault();
    expect(hasVault()).toBe(false);
    expect(rawGet("rasd-x")).toBeUndefined();
    expect(rawGet("theme")).toBe("dark");
  });

  it("يرفض كلمة مرور قصيرة وإنشاءً مكرراً", async () => {
    await expect(createVault("123", fast)).rejects.toMatchObject({ code: "weak_password" });
    await createVault(PW, fast);
    await lockVault();
    await expect(createVault(PW, fast)).rejects.toMatchObject({ code: "exists" });
  });
});
