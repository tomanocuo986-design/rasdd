import { useSyncExternalStore } from "react";
import type { Observation } from "./observations";

// ملاحظات كتبها المدقق بنفسه في المساعد وتم اعتمادها نهائيًا؛ تُدمج مع ملاحظات المحرك في تبويب التدقيق والتقرير الرقابي.
export const MANUAL_KEY = "rasd-manual-observations";
const EVENT = "rasd-manual-observations-changed";

let lastRaw: string | null | undefined;
let lastList: Observation[] = [];
const EMPTY: Observation[] = [];

function read(): Observation[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(MANUAL_KEY);
  } catch {
    return lastList;
  }
  if (raw === lastRaw) return lastList;
  lastRaw = raw;
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    lastList = Array.isArray(v)
      ? v.filter((o): o is Observation => !!o && typeof o === "object" && typeof (o as Observation).id === "string")
      : [];
  } catch {
    lastList = [];
  }
  return lastList;
}

function write(list: Observation[]): void {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(list));
  } catch {
    /* storage full: the backup panel warns the user */
  }
  window.dispatchEvent(new Event(EVENT));
}

export const getManualObservations = (): Observation[] => read();

export function addManualObservation(o: Observation): void {
  write([...read().filter((x) => x.id !== o.id), { ...o, manual: true }]);
}

export function removeManualObservation(id: string): void {
  write(read().filter((x) => x.id !== id));
}

export function clearManualObservations(): void {
  write([]);
}

export function subscribeManual(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** React hook: the current list of approved manual observations (stable reference between changes). */
export function useManualObservations(): Observation[] {
  return useSyncExternalStore(subscribeManual, read, () => EMPTY);
}
