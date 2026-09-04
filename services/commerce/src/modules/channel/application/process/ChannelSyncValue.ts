import { createHash } from 'node:crypto';
import type { JsonObject } from '@shop/contract';
import type { ChannelSyncKind } from '../port/ChannelJobRepository';

export const CHANNEL_SYNC_BATCH_SIZE = 500;

export function channelDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function channelObject(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as JsonObject;
}

export function channelText(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}

export function channelInteger(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(code);
  return value as number;
}

export function channelRequired<T>(value: T | undefined, code: string): T {
  if (!value) throw new Error(code);
  return value;
}

export function channelOwner(kind: ChannelSyncKind): 'catalog' | 'pricing' | 'inventory' | 'finance' {
  if (kind === 'catalogsync') return 'catalog';
  if (kind === 'pricesync') return 'pricing';
  if (kind === 'inventorysync') return 'inventory';
  return 'finance';
}

export function channelRecordError(key: string, code: unknown): JsonObject {
  const safe = typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,127}$/.test(code) ? code : 'PROVIDER_RECORD_INVALID';
  return Object.freeze({ keyHash: channelDigest(key), code: safe });
}
