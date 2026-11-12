export type VaultKeys = { aes: CryptoKey; mac: CryptoKey };
export type VaultOptions = { idleMinutes?: number; iterations?: number };

export class VaultError extends Error {
  code: string;
  constructor(code: string);
}

export function configureVault(options: { enabled?: boolean }): void;
export function isVaultEnabled(): boolean;
export function isSupported(): boolean;
export function isProtectedKey(key: unknown): boolean;
export function isUnlocked(): boolean;
export function hasVault(): boolean;
export function getKeys(): VaultKeys | null;
export function getCorrupted(): string[];
export function registerWiper(fn: () => Promise<unknown> | unknown): () => boolean;
export function onVaultLock(fn: (reason: string) => void): () => boolean;
export function b64e(bytes: Uint8Array): string;
export function b64d(str: string): Uint8Array;
export function sealBytes(keys: VaultKeys, bytes: Uint8Array, aad: string, compress?: boolean): Promise<Uint8Array>;
export function openBytes(keys: VaultKeys, data: Uint8Array, aad: string): Promise<Uint8Array>;
export function sealText(keys: VaultKeys, text: string, aad: string): Promise<string>;
export function openText(keys: VaultKeys, b64: string, aad: string): Promise<string>;
export function macSign(keys: VaultKeys, bytes: Uint8Array): Promise<string>;
export function macVerify(keys: VaultKeys, bytes: Uint8Array, mac: string): Promise<boolean>;
export function flushVault(): Promise<void>;
export function createVault(password: string, options?: VaultOptions): Promise<void>;
export function unlockVault(password: string, options?: VaultOptions): Promise<void>;
export function lockVault(reason?: string): Promise<void>;
export function resetVault(): Promise<void>;
