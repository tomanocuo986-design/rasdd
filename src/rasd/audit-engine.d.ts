export declare const auditSectors: Array<{ key: string; label: string; datasets: Array<{ key: string; label: string; fields: Array<{ key: string; label: string; type: string }> }> }>;
export declare const allDatasets: Array<{ key: string; sector: string }>;
export declare const defaultParams: Record<string, unknown>;
/** يُرجع الملاحظات الخام (dataset, test, detail, ref, row, severity…) لمخزن بيانات الجداول. */
export function runAudit(store: Record<string, Record<string, string>[]>, today?: number, params?: Record<string, unknown>): any[];
