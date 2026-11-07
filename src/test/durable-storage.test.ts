import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { durableStats, hydrate, installMirror, isDurableKey, readAll, writeBatch } from "@/rasd/durable-storage.js";

let idb: IDBFactory;
let stop: (() => void) | undefined;

beforeEach(() => {
  idb = new IDBFactory();
  localStorage.clear();
});
afterEach(() => {
  stop?.();
  stop = undefined;
});

const settle = () => new Promise((r) => setTimeout(r, 20));
const dump = async () => Object.fromEntries((await readAll(idb)).map((r: any) => [r.key, r.value]));

describe("durable storage (IndexedDB mirror)", () => {
  it("mirrors rasd-* writes and deletes, and never the sync token", async () => {
    stop = installMirror({ idb });
    localStorage.setItem("rasd-audit-store", '{"a":1}');
    localStorage.setItem("rasd-audit-reports", "[]");
    localStorage.setItem("rasd-sync-token", "secret");
    localStorage.setItem("other-app", "x");
    await settle();
    expect(await dump()).toEqual({ "rasd-audit-store": '{"a":1}', "rasd-audit-reports": "[]" });
    localStorage.removeItem("rasd-audit-reports");
    await settle();
    expect(Object.keys(await dump())).toEqual(["rasd-audit-store"]);
    expect(isDurableKey("rasd-sync-url")).toBe(false);
  });

  it("restores audit results and reports after localStorage was wiped", async () => {
    stop = installMirror({ idb });
    localStorage.setItem("rasd-audit-store", '{"Receipt_Vouchers":[{"voucher_no":"RV-1"}]}');
    localStorage.setItem("rasd-audit-reports", '[{"id":"r1","name":"تقرير"}]');
    await settle();
    stop();
    stop = undefined;
    localStorage.clear(); // e.g. the browser evicted localStorage
    const r = await hydrate({ idb });
    expect(r.restored).toBe(2);
    expect(localStorage.getItem("rasd-audit-reports")).toBe('[{"id":"r1","name":"تقرير"}]');
    expect(JSON.parse(localStorage.getItem("rasd-audit-store")!).Receipt_Vouchers).toHaveLength(1);
  });

  it("keeps the data in IndexedDB when localStorage rejects the write (quota)", async () => {
    stop = installMirror({ idb });
    const orig = Storage.prototype.setItem;
    stop(); // reinstall on top of a failing base implementation
    Storage.prototype.setItem = function () {
      throw new DOMException("full", "QuotaExceededError");
    };
    stop = installMirror({ idb });
    expect(() => localStorage.setItem("rasd-audit-store", "BIG")).toThrow();
    await settle();
    stop();
    stop = undefined;
    Storage.prototype.setItem = orig;
    expect(await dump()).toEqual({ "rasd-audit-store": "BIG" });
    const r = await hydrate({ idb });
    expect(r.restored).toBe(1);
    expect(localStorage.getItem("rasd-audit-store")).toBe("BIG");
  });

  it("prefers the IndexedDB copy when both differ, and seeds pre-existing localStorage data", async () => {
    await writeBatch([["rasd-audit-params", '{"v":2}']], idb);
    localStorage.setItem("rasd-audit-params", '{"v":1}');
    localStorage.setItem("rasd-preferences", '{"lang":"ar"}'); // existed before the feature was enabled
    const r = await hydrate({ idb });
    expect(localStorage.getItem("rasd-audit-params")).toBe('{"v":2}');
    expect(r).toMatchObject({ restored: 1, seeded: 1, total: 2 });
    expect((await dump())["rasd-preferences"]).toBe('{"lang":"ar"}');
  });

  it("reports unavailability instead of throwing when IndexedDB is missing", async () => {
    const r = await hydrate({ idb: undefined });
    expect(r.available).toBe(false);
    expect((await durableStats({ idb: undefined })).available).toBe(false);
  });

  it("exposes stats for the backup panel", async () => {
    await writeBatch([["rasd-a", "12345"], ["rasd-b", "1"]], idb);
    const s = await durableStats({ idb });
    expect(s).toMatchObject({ available: true, keys: 2 });
    expect(s.bytes).toBeGreaterThan(0);
    expect(s.updatedAt).toBeGreaterThan(0);
  });
});
