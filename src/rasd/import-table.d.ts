type Field = { key: string; label: string; type: string };
type Dataset = { key: string; label: string; fields: Field[] };
export declare function latinDigits(s: unknown): string;
export declare function normText(s: unknown): string;
export declare function cellScore(cell: unknown, field: Field): number;
export declare function mapHeader(
  cells: unknown[],
  fields: Field[],
): { map: Field[]; matched: number };
export declare function detectHeader(
  aoa: unknown[][],
  fields: Field[],
  scan?: number,
): { idx: number; map: Field[]; matched: number };
export declare function rowsFromAoa(
  aoa: unknown[][],
  fields: Field[],
  header?: { idx: number; map: Field[]; matched: number },
): { rows: Record<string, string>[]; matched: number; headerRow: number };
export declare function sheetToAoa(X: any, sheet: any): string[][];
export declare function mapWorkbook(
  X: any,
  wb: any,
  datasets: Dataset[],
  preferKey?: string,
): {
  imports: { sheet: string; key: string; label: string; rows: Record<string, string>[]; matched: number; total: number }[];
  unmatched: { sheet: string; headers: string[]; empty?: boolean }[];
};
export declare function mapSheets(
  sheets: { name: string; aoa: unknown[][] }[],
  datasets: Dataset[],
  preferKey?: string,
): ReturnType<typeof mapWorkbook>;
