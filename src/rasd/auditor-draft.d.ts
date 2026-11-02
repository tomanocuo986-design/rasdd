/* eslint-disable @typescript-eslint/no-explicit-any */
export const SEVERITY_WORD: Record<"high" | "medium" | "low", string>;
export const THRESHOLDS: { recurring: number; pattern: number };
export const DELETE_GUIDANCE: string;
export function normalizeArabic(s: unknown): string;
export function tokens(text: string): string[];
export function buildCorpus(reports: any, currentObservations?: any[], manual?: any[]): any[];
export function loadCorpus(): any[];
export function compareObservation(text: string, corpus: any[], opts?: { limit?: number }): any;
export function extractAmount(text: string): number;
export function classifyObservation(text: string, comparison: any, calibration?: any): any;
export function analyzeObservation(text: string, corpus?: any[], calibration?: any): any;
export function deriveTitle(text: string): string;
export function buildObservation(input: any): any;
export function reviewMemo(input: any, date?: string): string;
