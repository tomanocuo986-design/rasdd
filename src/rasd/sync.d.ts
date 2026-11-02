export declare function startAutoSync(opts?: {
  everyMs?: number;
  onStatus?: (s: { state: "ok" | "conflict" | "error"; message?: string; version?: number; at: number }) => void;
  storage?: Storage;
  fetchFn?: typeof fetch;
}): () => void;
