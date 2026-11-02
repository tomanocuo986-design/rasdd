export function isDurableKey(k: unknown): boolean;
export function readAll(idb?: IDBFactory): Promise<{ key: string; value: string; updatedAt?: number }[]>;
export function writeBatch(entries: [string, string | null][], idb?: IDBFactory): Promise<void>;
export function hydrate(opts?: {
  storage?: Storage;
  idb?: IDBFactory;
}): Promise<{ restored: number; seeded: number; failed: string[]; total: number; available: boolean }>;
export function installMirror(opts?: { storage?: Storage; idb?: IDBFactory; onError?: (e: unknown) => void }): (() => void) & {
  flush: () => Promise<void>;
  status: () => { at: number; error: unknown };
};
export function requestPersistence(): Promise<boolean | undefined>;
export function durableStats(opts?: { idb?: IDBFactory }): Promise<{
  available: boolean;
  keys: number;
  bytes: number;
  updatedAt?: number;
  persisted?: boolean;
}>;
export function initDurableStorage(opts?: {
  timeoutMs?: number;
}): Promise<{ restored: number; seeded: number; failed: string[]; total: number; available: boolean; timedOut?: boolean }>;
