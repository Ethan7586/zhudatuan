import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { FinancePort } from '../../FinancePort';
<<<<<<< HEAD
import { ReverseCancelledOrder } from './ReverseCancelledOrder';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

/** Converts accepted accounting events to idempotent journals; event owners never write ledger tables. */
export class PostJournal {
  private readonly finance = new FinancePort();
<<<<<<< HEAD
  private readonly cancellation = new ReverseCancelledOrder();
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  constructor(private readonly pool: DatabasePool) {}

  async execute(envelope: Readonly<Record<string, unknown>>): Promise<void> {
    const eventid = text(envelope.eventId, 'EVENT_ID_REQUIRED');
    const event = text(envelope.event, 'EVENT_TYPE_REQUIRED');
<<<<<<< HEAD
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const locked = await client.query<EventContext>(
        `select outbox.scope_id,outbox.occurred_at,outbox.payload
        from runtime.inbox inbox join runtime.outbox outbox on outbox.id=inbox.event_id
        where inbox.consumer='job:reconciliation' and inbox.event_id=$1 and inbox.event_type=$2
          and outbox.event_type=$2 and inbox.payload=outbox.payload and inbox.processed_at is null
        for update of inbox`,
        [eventid, event]
      );
      const target = locked.rows[0];
      if (!target) {
        const complete = await client.query(
          `select 1 from runtime.inbox where consumer='job:reconciliation'
          and event_id=$1 and event_type=$2 and processed_at is not null`,
          [eventid, event]
        );
        if (!complete.rows[0]) throw new Error('FINANCE_EVENT_CONTEXT_MISSING');
        await client.query('commit');
        return;
      }
      const payload = object(target.payload);
      if (event === 'order.placed') await this.order(client, payload, target);
      else if (event === 'order.cancelled') await this.cancellation.execute(client, payload, target);
      else if (event === 'payment.succeeded' || event === 'payment.refunded' || event === 'payment.late.detected') {
        await this.payment(client, event, payload, target);
      } else if (event === 'payment.autorefund.requested') await this.autorefund(client, payload, target);
      else throw new Error('FINANCE_EVENT_UNSUPPORTED');
      await client.query(
        `update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
        where consumer='job:reconciliation' and event_id=$1`,
        [eventid]
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async order(database: Database, payload: Readonly<Record<string, unknown>>, target: Readonly<{ scope_id: string; occurred_at: string }>): Promise<void> {
    const order = text(payload.order, 'FINANCE_ORDER_REFERENCE_REQUIRED');
    const source = await database.query<OrderFact>(
      `select orders.scope_id,orders.currency,orders.total_minor::text total_minor,
      orders.created_at occurred_at,coalesce(jsonb_agg(jsonb_build_object('kind',tender.kind,'reference',tender.reference_id,
        'amountMinor',tender.amount_minor) order by tender.sequence) filter(where tender.sequence is not null),'[]'::jsonb) tenders
      from ordering.orderrecord orders left join payment.intent intent on intent.order_id=orders.id
      left join payment.intenttender tender on tender.intent_id=intent.id where orders.id=$1
      group by orders.id`,
      [order]
    );
    const fact = source.rows[0];
    if (
      !fact ||
      fact.scope_id !== target.scope_id ||
      fact.currency !== text(payload.currency, 'FINANCE_EVENT_CURRENCY_INVALID') ||
      minor(fact.total_minor, false, 'FINANCE_ORDER_AMOUNT_INVALID') !== integer(payload.totalMinor, 'FINANCE_EVENT_AMOUNT_INVALID')
    )
      throw new Error('FINANCE_ORDER_EVIDENCE_MISMATCH');
    const tenders = array(fact.tenders, 'FINANCE_ORDER_TENDERS_INVALID');
    if (JSON.stringify(normalizeTenders(tenders)) !== JSON.stringify(normalizeTenders(array(payload.tenders, 'FINANCE_ORDER_TENDERS_INVALID')))) {
      throw new Error('FINANCE_ORDER_EVIDENCE_MISMATCH');
    }
    let tenderTotal = 0;
    let externalTotal = 0;
    let externalCount = 0;
    for (const value of tenders) {
      const tender = object(value);
      const amount = integer(tender.amountMinor, 'FINANCE_ORDER_TENDER_AMOUNT_INVALID');
      const kind = text(tender.kind, 'FINANCE_ORDER_TENDER_KIND_INVALID');
      if (!['wechat', 'benefit', 'voucher'].includes(kind)) throw new Error('FINANCE_ORDER_TENDER_KIND_INVALID');
      tenderTotal = safeAdd(tenderTotal, amount, 'FINANCE_ORDER_TENDER_TOTAL_OVERFLOW');
      if (kind === 'wechat') {
        externalTotal = safeAdd(externalTotal, amount, 'FINANCE_ORDER_TENDER_TOTAL_OVERFLOW');
        externalCount += 1;
      }
    }
    if (tenderTotal !== minor(fact.total_minor, false, 'FINANCE_ORDER_AMOUNT_INVALID') || externalCount > 1) throw new Error('FINANCE_ORDER_TENDER_ALLOCATION_INVALID');
    if (externalTotal === 0) return;
    await this.finance.post(database, {
      scope: target.scope_id,
      referenceType: 'order.placed',
      referenceId: order,
      currency: fact.currency,
      description: 'External-tender order receivable accrual',
      debit: { code: `order.receivable.${order}`, kind: 'asset' },
      credit: { code: 'commerce.revenue', kind: 'income' },
      amountMinor: externalTotal,
      occurredAt: fact.occurred_at,
    });
  }

  private async payment(database: Database, event: string, payload: Readonly<Record<string, unknown>>, target: Readonly<{ scope_id: string; occurred_at: string }>): Promise<void> {
    const late = event === 'payment.late.detected';
    const declared = integer(late ? payload.providerMinor : payload.amountMinor, 'FINANCE_EVENT_AMOUNT_INVALID');
    const reference = text(payload.payment ?? payload.refund, 'FINANCE_REFERENCE_REQUIRED');
    const external =
      event === 'payment.refunded'
        ? await database.query<ExternalTender>(
            `select intent.order_id,orders.scope_id,refund.currency,
          refund.amount_minor::text total_minor,coalesce(sum(tender.amount_minor),0)::text amount,$2::timestamptz occurred_at,
          capture.source capture_source,refund.id late_refund_id,refund.reason refund_reason
        from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
        join payment.intent intent on intent.id=payment.intent_id
        join ordering.orderrecord orders on orders.id=intent.order_id
        join payment.capture capture on capture.id='capture:'||intent.id and capture.order_id=orders.id
          and capture.scope_id=orders.scope_id and capture.state='succeeded'
        join payment.refundtender tender on tender.refund_id=refund.id
        where refund.id=$1 and refund.state='succeeded' and tender.kind='wechat' and tender.state='succeeded'
        group by intent.order_id,orders.scope_id,refund.currency,refund.amount_minor,capture.source,refund.id,refund.reason`,
            [reference, target.occurred_at]
          )
        : await database.query<ExternalTender>(
            `select intent.order_id,orders.scope_id,payment.currency,
          payment.amount_minor::text total_minor,coalesce(sum(tender.amount_minor),0)::text amount,capture.completed_at occurred_at,
          capture.source capture_source,max(late_refund.id) late_refund_id,max(late_refund.reason) refund_reason
        from payment.payment payment join payment.intent intent on intent.id=payment.intent_id
        join ordering.orderrecord orders on orders.id=intent.order_id
        join payment.capture capture on capture.id='capture:'||intent.id and capture.order_id=orders.id
          and capture.scope_id=orders.scope_id and capture.state='succeeded'
        join payment.intenttender tender on tender.intent_id=payment.intent_id
        left join payment.refund late_refund on late_refund.payment_id=payment.id and late_refund.reason='latepayment'
        where payment.id=$1 and payment.state in('captured','partially_refunded','refunded')
          and tender.kind='wechat' and tender.state='captured'
        group by intent.order_id,orders.scope_id,payment.currency,payment.amount_minor,capture.completed_at,capture.source`,
            [reference]
          );
    const selected = external.rows[0];
    const amount = selected ? minor(selected.amount, true, 'FINANCE_EXTERNAL_TENDER_AMOUNT_INVALID') : 0;
    if (amount === 0) return;
    const declaredCurrency = late ? selected?.currency : text(payload.currency, 'FINANCE_EVENT_CURRENCY_INVALID');
    if (
      !selected ||
      selected.scope_id !== target.scope_id ||
      selected.order_id !== payload.order ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > declared ||
      minor(selected.total_minor, false, 'FINANCE_PAYMENT_AMOUNT_INVALID') !== declared ||
      selected.currency !== declaredCurrency
    )
      throw new Error('FINANCE_EXTERNAL_TENDER_EVIDENCE_MISMATCH');
    if (late && (selected.capture_source !== 'latewechat' || selected.refund_reason !== 'latepayment' || selected.late_refund_id !== payload.refund)) throw new Error('FINANCE_LATE_CAPTURE_EVIDENCE_MISMATCH');
    const lateRefund = event === 'payment.refunded' && selected.capture_source === 'latewechat' && selected.refund_reason === 'latepayment';
    const ledgerEvent = late ? 'payment.late.detected' : lateRefund ? 'payment.late.refunded' : event;
    await this.finance.post(
      database,
      event === 'payment.refunded'
        ? {
            scope: selected.scope_id,
            referenceType: ledgerEvent,
            referenceId: reference,
            currency: selected.currency,
            description: 'External payment refund',
            debit: { code: 'commerce.refund', kind: 'expense' },
            ...(lateRefund ? { debit: { code: `late-refund.payable.${reference}`, kind: 'liability' } } : {}),
            credit: { code: 'channel.clearing.wechat', kind: 'asset' },
            amountMinor: amount,
            occurredAt: selected.occurred_at,
          }
        : {
            scope: selected.scope_id,
            referenceType: ledgerEvent,
            referenceId: reference,
            currency: selected.currency,
            description: late ? 'Late external capture pending automatic refund' : 'External payment capture',
            debit: { code: 'channel.clearing.wechat', kind: 'asset' },
            credit: late ? { code: `late-refund.payable.${selected.late_refund_id!}`, kind: 'liability' } : { code: `order.receivable.${selected.order_id}`, kind: 'asset' },
            amountMinor: amount,
            occurredAt: selected.occurred_at,
          }
    );
  }

  private async autorefund(database: Database, payload: Readonly<Record<string, unknown>>, target: Readonly<{ scope_id: string }>): Promise<void> {
    const refund = text(payload.refund, 'FINANCE_REFERENCE_REQUIRED');
    const result = await database.query(
      `select 1 from payment.refund refund join payment.payment payment on payment.id=refund.payment_id
      join payment.intent intent on intent.id=payment.intent_id join ordering.orderrecord orders on orders.id=intent.order_id
      where refund.id=$1 and orders.id=$2 and orders.scope_id=$3`,
      [refund, text(payload.order, 'FINANCE_ORDER_REFERENCE_REQUIRED'), target.scope_id]
    );
    if (!result.rows[0]) throw new Error('FINANCE_AUTOREFUND_EVIDENCE_MISMATCH');
  }
}

interface ExternalTender extends Record<string, unknown> {
  readonly order_id: string;
  readonly scope_id: string;
  readonly currency: string;
  readonly total_minor: string;
  readonly amount: string;
  readonly occurred_at: string;
  readonly capture_source: string;
  readonly late_refund_id: string | null;
  readonly refund_reason: string | null;
}
interface OrderFact extends Record<string, unknown> {
  readonly scope_id: string;
  readonly currency: string;
  readonly total_minor: string;
  readonly occurred_at: string;
  readonly tenders: unknown;
}
interface EventContext extends Record<string, unknown> {
  readonly scope_id: string;
  readonly occurred_at: string;
  readonly payload: unknown;
}
=======
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

>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
interface Database {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}
function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
<<<<<<< HEAD
function array(value: unknown, code: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
function integer(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(code);
  return value as number;
}
function minor(value: unknown, allowZero: boolean, code: string): number {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) throw new Error(code);
  const parsed = BigInt(value);
  if ((!allowZero && parsed === 0n) || parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(code);
  return Number(parsed);
}
function safeAdd(left: number, right: number, code: string): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) throw new Error(code);
  return sum;
}
function normalizeTenders(values: readonly unknown[]): readonly Readonly<{ kind: string; reference: string | null; amountMinor: number }>[] {
  return values.map((value) => {
    const tender = object(value);
    return Object.freeze({
      kind: text(tender.kind, 'FINANCE_ORDER_TENDER_KIND_INVALID'),
      reference: tender.reference === null || tender.reference === undefined ? null : text(tender.reference, 'FINANCE_ORDER_TENDER_REFERENCE_INVALID'),
      amountMinor: integer(tender.amountMinor, 'FINANCE_ORDER_TENDER_AMOUNT_INVALID'),
    });
  });
}
=======
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
function integer(value: unknown, code: string): number { if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(code); return value as number; }
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
