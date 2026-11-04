export const KINDS: Record<string, string>;
export const COUNT_LABEL: Record<string, string>;
export function redactDocument(text: unknown, opts?: { extraTerms?: string[] }): { text: string; map: Map<string, string>; counts: Record<string, number>; total: number };
export function restoreText(text: unknown, map: Map<string, string>): string;
export function redactionSummary(counts: Record<string, number>): string;
