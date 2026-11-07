/* eslint-disable @typescript-eslint/no-explicit-any */
export function isObservationText(text: string): boolean;
export function extractObservationText(text: string): string;
export function formalCondition(text: string): string;
export function titleOf(text: string): string;
export function basisFromPassage(p: any): any;
export function findLegalBasis(query: string, docs?: any[]): Promise<{ basis: any; candidates: any[]; hasLibrary: boolean }>;
export function makeChatDraft(rawText: string, opts?: { force?: boolean; corpus?: any[]; docs?: any[] }): Promise<any>;
export function hasDefaultWording(d: any): boolean;
export function buildFromDraft(d: any, sector: string): any;
export function approveChatDraft(d: any, sector: string, opts?: { confirmedNoBasis?: boolean }): { ok: boolean; needsConfirm?: boolean; observation?: any };
export function discardChatDraft(d: any, reason?: string): void;
export function memoFor(d: any, sectorLabel: string, reason: string): string;
