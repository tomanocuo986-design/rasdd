export const OFFICIAL_PREFIX: string;
export function isOfficialDoc(d: unknown): boolean;

export type OfficialDoc = {
  id: string;
  official?: boolean;
  name?: string;
  text?: string;
  sha?: string;
  sourceNote?: string;
  effectiveDate?: string;
  addedAt?: string;
  blob?: Blob;
};

export type SyncResult = {
  added: number;
  updated: number;
  failed: number;
  pending: number;
  enabled: boolean;
};

export type SyncDeps = {
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  listRegulations: () => Promise<OfficialDoc[]>;
  saveRegulation: (d: OfficialDoc) => Promise<unknown>;
  deleteRegulation: (id: string) => Promise<unknown>;
  extractPdfPages: (
    file: File,
    opts?: { onStatus?: (m: string) => void },
  ) => Promise<{ text: string }>;
  onProgress?: (msg: string) => void;
  onChange?: () => void;
  sleep?: (ms: number) => Promise<void>;
  pollMs?: number;
  maxPolls?: number;
};

export function syncOfficialLibrary(deps: SyncDeps): Promise<SyncResult>;
export function syncSummary(r: SyncResult): string;
export function startOfficialSync(deps: SyncDeps): { done: Promise<SyncResult>; stop: () => void };
