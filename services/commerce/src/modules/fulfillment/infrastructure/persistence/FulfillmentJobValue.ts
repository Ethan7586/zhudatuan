import { createHash, randomUUID } from 'node:crypto';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../platform/database/PgRuntimeWriter';

export async function enqueueFulfillment(database: RuntimeSql, kind: string, scope: string, payload: unknown, delay: number) {
  await new PgRuntimeWriter(database).schedule({ id: `job:${randomUUID()}`, kind, owner: 'fulfillment', scope, payload: jobPayload(payload), priority: 20, availableAt: new Date(Date.now() + delay * 1000).toISOString() });
}

export function jobPayload(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}

export function requiredJobText(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

export function fulfillmentDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function providerSucceeded(value: string): boolean {
  return ['accepted', 'submitted', 'succeeded'].includes(value.toLowerCase());
}
