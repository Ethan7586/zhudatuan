import { createHash, randomUUID } from 'node:crypto';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../adapter/database/PgRuntimeWriter';
import { safeErrorCode } from '../../../../foundation/domain/SafeError';
import type { PaymentGateway } from '../../application/port/PaymentGateway';
import type { PaymentApplication } from '../../application/port/PaymentGateway';

export type ProviderObservation = Awaited<ReturnType<PaymentGateway['query']>>;

export interface IntentTarget {
  readonly intent: string;
  readonly order_id: string;
  readonly order_number: string;
  readonly scope_id: string;
  readonly mall_id: string;
  readonly member_id: string;
  readonly amount_minor: number;
  readonly provider_minor: number;
  readonly currency: string;
  readonly intent_state: string;
  readonly attempt: string;
  readonly expires_at: string;
  readonly scene: PaymentApplication['scene'];
  readonly application_hash: string;
}

export function paymentApplication(selected: IntentTarget): PaymentApplication {
  return Object.freeze({ scene: selected.scene, applicationHash: selected.application_hash });
}

export async function enqueuePaymentJob(database: RuntimeSql, kind: string, owner: string, scope: string, payload: unknown, delay: number) {
  await new PgRuntimeWriter(database).schedule({
    id: `job:${randomUUID()}`,
    kind,
    owner,
    scope,
    payload: jobPayload(payload),
    priority: 10,
    availableAt: new Date(Date.now() + delay * 1_000).toISOString(),
  });
}

export function jobPayload(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
export function jobText(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
export function providerError(value: unknown): string {
  return safeErrorCode(value, 'PAYMENT_PROVIDER_FAILED');
}
export function paymentDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function intentExpired(selected: IntentTarget): boolean {
  return new Date(selected.expires_at).getTime() <= Date.now();
}

export function assertProviderAmount(selected: IntentTarget, observed: ProviderObservation): void {
  if (observed.state !== 'absent' && observed.amountMinor !== selected.provider_minor) throw new Error('PAYMENT_PROVIDER_AMOUNT_MISMATCH');
}

export async function recordProviderObservation(database: RuntimeSql, selected: IntentTarget, observed: ProviderObservation, source: 'query' | 'close'): Promise<void> {
  const evidence = JSON.stringify({ source, state: observed.state, transaction: observed.transaction ?? null, amountMinor: observed.amountMinor });
  const event = `${source}:${paymentDigest(`${selected.intent}:${evidence}`)}`;
  await database.query(
    `insert into payment.observation(id,attempt_id,provider_event_id,state,amount_minor,currency,payload_hash,observed_at)
    values($1,$2,$3,$4,$5,$6,$7,clock_timestamp()) on conflict(provider_event_id) do nothing`,
    [`observation:${paymentDigest(event)}`, selected.attempt, event, observed.state, observed.amountMinor, selected.currency, paymentDigest(evidence)]
  );
}
