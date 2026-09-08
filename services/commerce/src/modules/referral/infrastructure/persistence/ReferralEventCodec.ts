import { createHash } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReferralProcessEvent } from '../../application/port/ReferralEventProcess';

const SUPPORTED = new Set(['order.paid', 'order.received', 'refund.completed', 'approval.instance.approved']);

export async function enqueueSettlement(transaction: SqlExecutor, scopeId: string, orderId: string, availableAt: string): Promise<void> {
  const id = deterministic('job', 'referralsettlement', scopeId, orderId);
  await new PgRuntimeWriter(transaction).schedule({ id, kind: 'referralsettlement', owner: 'referral', scope: scopeId, payload: { scopeId, orderId }, priority: 30, availableAt });
}

export function assertEvent(input: ReferralProcessEvent): void {
  if (!input.eventId || !SUPPORTED.has(input.eventType) || !input.scopeId || !input.sourceId || !input.resourceId) throw new Error('REFERRAL_EVENT_INVALID');
}

export function orderLine(value: unknown): Readonly<{ lineId: string; productId: string; payableMinor: number }> {
  const row = object(value, 'REFERRAL_ORDER_LINE_INVALID');
  return Object.freeze({
    lineId: text(row.line, 'REFERRAL_ORDER_LINE_REFERENCE_REQUIRED'),
    productId: text(row.product, 'REFERRAL_PRODUCT_REFERENCE_REQUIRED'),
    payableMinor: integer(row.payableMinor, 'REFERRAL_LINE_AMOUNT_INVALID'),
  });
}

export function benefitAmount(value: unknown, expectedTotal: number): bigint {
  if (!Array.isArray(value)) throw new Error('REFERRAL_ORDER_TENDERS_REQUIRED');
  let total = 0n;
  const benefit = value.reduce((sum, tender) => {
    const row = object(tender, 'REFERRAL_ORDER_TENDER_INVALID');
    const amount = BigInt(integer(row.amountMinor, 'REFERRAL_BENEFIT_AMOUNT_INVALID'));
    total += amount;
    return row.kind === 'benefit' ? sum + amount : sum;
  }, 0n);
  if (total !== BigInt(expectedTotal)) throw new Error('REFERRAL_ORDER_EVIDENCE_MISMATCH');
  return benefit;
}

export function commissionableRefundAmount(value: unknown, totalMinor: number): number {
  if (!Array.isArray(value)) throw new Error('REFERRAL_REFUND_TENDERS_REQUIRED');
  let total = 0;
  let included = 0;
  for (const tender of value) {
    const row = object(tender, 'REFERRAL_REFUND_TENDER_INVALID');
    const amount = integer(row.amount_minor, 'REFERRAL_REFUND_AMOUNT_INVALID');
    total += amount;
    if (row.kind !== 'benefit') included += amount;
  }
  if (total !== totalMinor) throw new Error('REFERRAL_REFUND_EVIDENCE_MISMATCH');
  return included;
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
