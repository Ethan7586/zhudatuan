import { randomUUID } from 'node:crypto';
import { safeErrorCode } from '../../foundation/domain/SafeError';

export async function enqueue(database: Readonly<{ query(text: string, values?: readonly unknown[]): Promise<unknown> }>, kind: string, scope: string, payload: unknown) {
  await database.query(
    `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,$2,'voucher',$3,$4::jsonb,'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
    [`job:${randomUUID()}`, kind, scope, JSON.stringify(payload)]
  );
}

export function identifier(payload: unknown, field: string, code: string): string {
  const value = payload !== null && typeof payload === 'object' ? Reflect.get(payload, field) : null;
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

export function errorCode(cause: unknown): string {
  return safeErrorCode(cause, 'VOUCHER_STATUS_FAILED');
}
