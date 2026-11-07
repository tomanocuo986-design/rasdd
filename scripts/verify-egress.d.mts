export type EgressRow = {
  url: string;
  expect: "open" | "closed";
  reachable: boolean;
  status?: number;
  error?: string;
  result: "pass" | "fail" | "check";
};
export const ALLOWED: string[];
export const BLOCKED: string[];
export function probe(
  url: string,
  fetchFn: (url: string, init?: object) => Promise<{ status: number }>,
  timeoutMs: number,
): Promise<{ reachable: boolean; status?: number; error?: string }>;
export function runChecks(opts?: {
  fetchFn?: (url: string, init?: object) => Promise<{ status: number }>;
  timeoutMs?: number;
  allowed?: string[];
  blocked?: string[];
  internal?: string[];
}): Promise<EgressRow[]>;
