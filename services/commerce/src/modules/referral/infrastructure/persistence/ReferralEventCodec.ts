import { createHash } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReferralOrderEvent } from '../../application/port/ReferralEventProcess';

const SUPPORTED = new Set(['order.paid', 'order.received', 'refund.completed']);

export async function enqueueSettlement(transaction: SqlExecutor, scopeId: string, orderId: string, availableAt: string): Promise<void> {
  const id = deterministic('job', 'referralsettlement', scopeId, orderId);
  await new PgRuntimeWriter(transaction).schedule({ id, kind: 'referralsettlement', owner: 'referral', scope: scopeId, payload: { scopeId, orderId }, priority: 30, availableAt });
}

export function assertEvent(input: ReferralOrderEvent): void {
  if (!input.eventId || !SUPPORTED.has(input.eventType) || !input.scopeId || !input.orderId) throw new Error('REFERRAL_EVENT_INVALID');
}

export function orderLine(value: unknown): Readonly<{ lineId: string; productId: string; payableMinor: number }> {
  const row = object(value, 'REFERRAL_ORDER_LINE_INVALID');
  return Object.freeze({
    lineId: text(row.line, 'REFERRAL_ORDER_LINE_REFERENCE_REQUIRED'),
    productId: text(row.product, 'REFERRAL_PRODUCT_REFERENCE_REQUIRED'),
    payableMinor: integer(row.payableMinor, 'REFERRAL_LINE_AMOUNT_INVALID'),
  });
}

export function object(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

export function array(value: unknown, code: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) throw new Error(code);
  return value;
}

export function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) throw new Error(code);
  return value;
}

export function optionalText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value, 'REFERRAL_LINE_REFERENCE_INVALID');
}

export function integer(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(code);
  return value as number;
}

export function timestamp(value: Date | string): string {
  const result = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  if (Number.isNaN(Date.parse(result))) throw new Error('REFERRAL_EVENT_TIME_INVALID');
  return result;
}

export function deterministic(kind: string, ...parts: readonly string[]): string {
  return `${kind}:${createHash('sha256').update(parts.join('\u0000')).digest('hex')}`;
}

export function safeNumber(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('REFERRAL_AMOUNT_OVERFLOW');
  return Number(value);
}
