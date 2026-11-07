export declare function flatten(obj: unknown, prefix?: string, out?: Record<string, string>): Record<string, string>;
export declare function recordsToAoa(records: unknown[]): string[][];
export declare function jsonToSheets(text: string): { name: string; aoa: string[][] }[];
export declare function xmlToSheets(text: string): { name: string; aoa: string[][] }[];
export declare function rowsFromAoaChunked(
  aoa: unknown[][],
  fields: { key: string; label: string; type: string }[],
  opts?: { chunk?: number; onProgress?: (p: number) => void; yieldFn?: () => Promise<void> },
): Promise<{ rows: Record<string, string>[]; matched: number; headerRow: number }>;
