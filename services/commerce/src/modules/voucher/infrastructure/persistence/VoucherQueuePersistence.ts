import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../adapter/database/PgRuntimeWriter';
import { safeErrorCode } from '../../../../foundation/domain/SafeError';

export async function enqueue(database: Readonly<{ query(text: string, values?: readonly unknown[]): Promise<unknown> }>, kind: string, scope: string, payload: unknown) {
  await new PgRuntimeWriter(database as unknown as RuntimeSql).schedule({ id: `job:${randomUUID()}`, kind, owner: 'voucher', scope, payload: record(payload), priority: 20 });
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('VOUCHER_JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

export function errorCode(cause: unknown): string {
  return safeErrorCode(cause, 'VOUCHER_STATUS_FAILED');
}
