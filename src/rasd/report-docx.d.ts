import type { Observation } from "./observations";
export interface ReportMeta {
  entity?: string;
  subject?: string;
  year?: string;
  from?: string;
  to?: string;
  letterNo?: string;
}
export const TEMPLATE_URL: string;
export const REPORT_META_KEY: string;
export function conclusionLevel(list: Observation[]): 1 | 2 | 3;
export function buildReportDocx(template: ArrayBuffer | Uint8Array, report: { date: string; observations: Observation[] }, meta?: ReportMeta): Promise<Uint8Array>;
export function fetchTemplate(url?: string): Promise<ArrayBuffer>;
export function loadReportMeta(): ReportMeta;
export function saveReportMeta(m: ReportMeta): void;
