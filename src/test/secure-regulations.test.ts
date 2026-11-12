import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
const db = new Map<string, Row>();

vi.mock("@/rasd/regulations-db", () => ({
  listRegulations: async () => [...db.values()].map((d) => structuredClone(d)),
  saveRegulation: async (d: Row) => {
    db.set(d.id, structuredClone(d));
  },
  deleteRegulation: async (id: string) => {
    db.delete(id);
  },
  updateRegulationMeta: async (id: string, patch: Row) => {
    db.set(id, { ...db.get(id), ...patch });
  },
}));

import { createVault, lockVault, unlockVault } from "@/rasd/secure-vault.js";
import {
  deleteRegulation,
  listRegulations,
  saveRegulation,
  updateRegulationMeta,
} from "@/rasd/secure-regulations.js";

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

beforeEach(async () => {
  await lockVault();
  db.clear();
  (globalThis as any).Storage = MemStorage;
  (globalThis as any).localStorage = new MemStorage();
  await createVault(PW, fast);
});

const pdf = () => new File([new Uint8Array([37, 80, 68, 70, 45, 1, 2, 3])], "a.pdf", { type: "application/pdf" });

describe("secure-regulations", () => {
  it("يخزّن النص والملف مشفّرين ويُرجعهما سليمين", async () => {
    await saveRegulation({ id: "official:p", official: true, name: "نظام المشتريات", text: "المادة 1 نص النظام", blob: pdf(), sha: "abc", addedAt: "2026-11-12" });
    const stored = db.get("official:p") as Row;
    expect(JSON.stringify(stored)).not.toContain("المادة 1");
    expect(stored.text).toBeUndefined();
    expect(stored.blob).toBeUndefined();
    const [d] = await listRegulations();
    expect(d.text).toBe("المادة 1 نص النظام");
    expect(d.name).toBe("نظام المشتريات");
    expect(d.sha).toBe("abc");
    expect(new Uint8Array(await d.blob.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70, 45, 1, 2, 3]));
    expect(d.blob.name).toBe("a.pdf");
    expect(d.mac).toBeUndefined();
    expect(d.vault).toBeUndefined();
  });

  it("يرفض أي تعديل على الاسم أو التاريخ أو النص المشفّر (HMAC)", async () => {
    await saveRegulation({ id: "r1", name: "نظام أ", text: "نص أ", effectiveDate: "2022-01-01" });
    await saveRegulation({ id: "r2", name: "نظام ب", text: "نص ب" });
    await saveRegulation({ id: "r3", name: "نظام ج", text: "نص ج" });
    db.get("r1")!.effectiveDate = "2030-01-01";
    db.get("r2")!.textSealed = db.get("r3")!.textSealed;
    const ids = (await listRegulations()).map((d) => d.id);
    expect(ids).toEqual(["r3"]);
  });

  it("يرقّي النظام القديم غير المشفّر عند أول قراءة", async () => {
    db.set("old", { id: "old", name: "قديم", text: "نص قديم" });
    const [d] = await listRegulations();
    expect(d.text).toBe("نص قديم");
    expect(JSON.stringify(db.get("old"))).not.toContain("نص قديم");
    expect((await listRegulations())[0].text).toBe("نص قديم");
  });

  it("تحديث البيانات الوصفية يبقي النص ويجدّد الختم", async () => {
    await saveRegulation({ id: "r1", name: "نظام", text: "نص", blob: pdf() });
    const before = db.get("r1")!.mac;
    await updateRegulationMeta("r1", { effectiveDate: "2024-05-01" });
    const [d] = await listRegulations();
    expect(d.effectiveDate).toBe("2024-05-01");
    expect(d.text).toBe("نص");
    expect(d.blob).toBeTruthy();
    expect(db.get("r1")!.mac).not.toBe(before);
  });

  it("بعد القفل لا تُعرض أي أنظمة ولا يُسمح بالحفظ، وبعد الفتح تعود", async () => {
    await saveRegulation({ id: "r1", name: "نظام", text: "نص" });
    await lockVault();
    expect(await listRegulations()).toEqual([]);
    await expect(saveRegulation({ id: "r2", name: "x", text: "y" })).rejects.toMatchObject({ code: "locked" });
    await unlockVault(PW, fast);
    expect((await listRegulations())[0].text).toBe("نص");
  });

  it("الحذف يعمل", async () => {
    await saveRegulation({ id: "r1", name: "نظام", text: "نص" });
    await deleteRegulation("r1");
    expect(await listRegulations()).toEqual([]);
  });
});
