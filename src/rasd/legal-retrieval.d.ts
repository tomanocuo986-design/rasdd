export interface Passage {
  docId: string;
  docName: string;
  effectiveDate: string;
  sourceNote: string;
  article: string;
  text: string;
  score: number;
}
export function asciiDigits(s: unknown): string;
export function normalizeToken(w: string): string;
export function stem(w: string): string;
export function tokenize(text: unknown): string[];
export function articleOf(chunkText: string): string;
export function chunkText(text: string, opts?: { maxChars?: number; overlap?: number }): string[];
export function buildIndex(docs: { id?: string; name?: string; text?: string; effectiveDate?: string; sourceNote?: string }[]): unknown;
export function search(index: unknown, query: string, opts?: { k?: number; k1?: number; b?: number; minScore?: number }): Passage[];
export function retrievePassages(docs: { id?: string; name?: string; text?: string; effectiveDate?: string; sourceNote?: string }[], query: string, opts?: { k?: number; minScore?: number }): Passage[];
export function buildQuery(userText: string, ctx: unknown, mode?: string): string;
export function toPayload(passages: Passage[], opts?: { maxItems?: number; maxChars?: number }): { source: string; text: string }[];
