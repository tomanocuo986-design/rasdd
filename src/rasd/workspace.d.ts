export declare const Workspace: () => JSX.Element;
export declare const auditSectors: Array<{ key: string; label: string; datasets: Array<{ key: string; label: string; fields: Array<{ key: string; label: string; type: string }> }> }>;
export declare const allDatasets: Array<{ key: string; sector: string }>;
export function segmentDoc(text: string): { text: string; toks: Set<string> }[];
export function matchRegulation(
  test: string,
  docs: { id: string; name: string; segments: { text: string; toks: Set<string> }[] }[],
): { doc: string; docId: string; excerpt: string; score: number } | undefined;
