import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { FinancePort } from '../../FinancePort';

/** Converts accepted accounting events to idempotent journals; event owners never write ledger tables. */
export class PostJournal {
  private readonly finance = new FinancePort();
  constructor(private readonly pool: DatabasePool) {}

  async execute(envelope: Readonly<Record<string, unknown>>): Promise<void> {
    const eventid = text(envelope.eventId, 'EVENT_ID_REQUIRED');
    const event = text(envelope.event, 'EVENT_TYPE_REQUIRED');
    const payload = object(envelope.payload);
    const scope = await this.pool.query<{ scope_id: string; received_at: string }>(`select job.scope_id,inbox.received_at from runtime.job job
      join runtime.inbox inbox on inbox.event_id=$1 and inbox.consumer='job:reconciliation' where job.payload->>'eventId'=$1 limit 1`, [eventid]);
    const target = scope.rows[0];
    if (!target) throw new Error('FINANCE_EVENT_CONTEXT_MISSING');
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const inbox = await client.query(`select 1 from runtime.inbox where consumer='job:reconciliation' and event_id=$1 and processed_at is null for update`, [eventid]);
      if (!inbox.rows[0]) { await client.query('commit'); return; }
      if (event === 'payment.succeeded' || event === 'payment.refunded') await this.payment(client, event, payload, target);
      else if (!['payment.late.detected', 'payment.autorefund.requested'].includes(event)) throw new Error('FINANCE_EVENT_UNSUPPORTED');
      await client.query(`update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
        where consumer='job:reconciliation' and event_id=$1`, [eventid]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async payment(database: Database, event: string, payload: Readonly<Record<string, unknown>>,
    target: Readonly<{ scope_id: string; received_at: string }>): Promise<void> {
    integer(payload.amountMinor, 'FINANCE_EVENT_AMOUNT_INVALID');
    const currency = text(payload.currency, 'FINANCE_EVENT_CURRENCY_INVALID');
    const reference = text(payload.payment ?? payload.refund, 'FINANCE_REFERENCE_REQUIRED');
    const external = event === 'payment.refunded'
      ? await database.query<{ amount: number }>(`select coalesce(sum(amount_minor),0)::float8 amount from payment.refundtender
          where refund_id=$1 and kind='wechat' and state='succeeded'`, [reference])
      : await database.query<{ amount: number }>(`select coalesce(sum(tender.amount_minor),0)::float8 amount from payment.payment payment
          join payment.intenttender tender on tender.intent_id=payment.intent_id where payment.id=$1 and tender.kind='wechat'
          and tender.state='captured'`, [reference]);
    const amount = external.rows[0]?.amount ?? 0;
    if (amount === 0) return;
    await this.finance.post(database, event === 'payment.refunded'
      ? { scope: target.scope_id,referenceType: event,referenceId: reference,currency,description: 'External payment refund',
          debit: { code: 'commerce.refund', kind: 'expense' },credit: { code: 'cash', kind: 'asset' },amountMinor: amount,
          occurredAt: target.received_at }
      : { scope: target.scope_id,referenceType: event,referenceId: reference,currency,description: 'External payment capture',
          debit: { code: 'cash', kind: 'asset' },credit: { code: 'commerce.clearing', kind: 'income' },amountMinor: amount,
          occurredAt: target.received_at });
  }
}

interface Database {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}
function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
function integer(value: unknown, code: string): number { if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(code); return value as number; }
