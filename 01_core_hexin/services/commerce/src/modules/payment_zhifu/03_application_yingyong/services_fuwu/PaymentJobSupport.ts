import { createHash, randomUUID } from 'node:crypto';
import { providerOccurredAt, type PaymentGateway } from '../../01_public_gongkai/ports_jiekou/PaymentGateway';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { PaymentApplication } from '../../01_public_gongkai/ports_jiekou/PaymentGateway';

export type ProviderObservation = Awaited<ReturnType<PaymentGateway['query']>>;

export interface IntentTarget {
  readonly intent: string;
  readonly order_id: string;
  readonly provider_reference: string;
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

export async function enqueuePaymentJob(database: { query(text: string, values?: readonly unknown[]): Promise<unknown> }, kind: string, owner: string,
  scope: string, payload: unknown, delay: number) {
  await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,$2,$3,$4,$5::jsonb,'queued',10,clock_timestamp()+make_interval(secs=>$6),clock_timestamp(),clock_timestamp())`,
  [`job:${randomUUID()}`, kind, owner, scope, JSON.stringify(payload), delay]);
}

export function jobPayload(value: unknown): Record<string, unknown> { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID'); return value as Record<string, unknown>; }
export function jobText(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
export function providerError(value: unknown): string { return value instanceof Error ? value.message.slice(0, 200) : 'PAYMENT_PROVIDER_FAILED'; }
export function paymentDigest(value: string): string { return createHash('sha256').update(value).digest('hex'); }

export function intentExpired(selected: IntentTarget): boolean { return new Date(selected.expires_at).getTime() <= Date.now(); }

export function assertProviderAmount(selected: IntentTarget, observed: ProviderObservation): void {
  if (observed.state !== 'absent' && observed.amountMinor !== selected.provider_minor) throw new Error('PAYMENT_PROVIDER_AMOUNT_MISMATCH');
}

export async function recordProviderObservation(pool: DatabasePool, selected: IntentTarget, observed: ProviderObservation, source: 'query' | 'close'): Promise<void> {
  const occurredAt = observed.occurredAt === undefined ? null : providerOccurredAt(observed.occurredAt);
  const identity = JSON.stringify({ source, state: observed.state, transaction: observed.transaction ?? null, amountMinor: observed.amountMinor, occurredAt });
  const evidence = JSON.stringify({ version: 1, provider: 'wechat', kind: 'payment.observation', occurredAt, source,
    state: observed.state, transaction: observed.transaction ?? null, amountMinor: observed.amountMinor, currency: selected.currency,
    receipt: observed.evidence });
  const event = `${source}:${paymentDigest(`${selected.intent}:${identity}`)}`;
  await pool.query(`insert into payment.observation(id,mall_id,attempt_id,provider_event_id,state,amount_minor,currency,payload_hash,observed_at,
    provider_occurred_at,provider_effect,provider_effect_hash)
    values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp(),$9::timestamptz,$10::jsonb,
      case when $9::timestamptz is null then null else encode(public.digest($10::jsonb::text,'sha256'),'hex') end)
    on conflict(mall_id,provider_event_id) do nothing`,
  [`observation:${paymentDigest(event)}`, selected.mall_id, selected.attempt, event, observed.state, observed.amountMinor,
    selected.currency, paymentDigest(evidence), occurredAt, occurredAt === null ? null : evidence]);
}
