import type { Readable, Transform } from "node:stream";

export const MAGIC: Buffer;
export const CHUNK: number;
export const DEFAULT_LOG_N: number;
export class PackError extends Error {
  code: string;
  constructor(code: string, message?: string);
}
export function encryptStream(password: string, opts?: { logN?: number }): Transform;
export function decryptStream(password: string): Transform;
export function safeSegments(rel: string): string[];
export function packFilesStream(files: { rel: string; abs: string; size: number }[]): Readable;
export function unpackTo(
  readable: AsyncIterable<Buffer>,
  dest: string,
  limits?: { maxFiles?: number; maxBytes?: number },
): Promise<{ files: number; bytes: number }>;
