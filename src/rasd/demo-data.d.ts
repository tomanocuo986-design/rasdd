export const DEMO_FLAG_KEY: string;
export const DEMO_SNAPSHOT_KEY: string;
export const DEMO_MUNICIPALITY: string;
export const DEMO_PARAMS: Record<string, number>;
export function buildDemoStore(today?: number): Record<string, Record<string, string>[]>;
export function buildDemoPreviousReport(
  findings: { key: string; dataset: string; test: string; ref: string; severity: string; finalSeverity?: string; detail: string }[],
  today?: number,
): {
  id: string;
  name: string;
  date: string;
  findings: { key: string; dataset: string; test: string; ref: string; severity: string; detail: string }[];
  observations: unknown[];
};
