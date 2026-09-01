import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PaymentGateway } from '../../application/port/PaymentGateway';
import { RefundPlanner } from '../../infrastructure/persistence/RefundPlanner';
import { PaymentReference } from '../../domain/model/PaymentReference';
import { enqueuePaymentJob as enqueue, paymentDigest as digest, providerError as error, type IntentTarget, type ProviderObservation } from './PaymentRecoveryPersistence';
import type { PaymentRecoveryDependencies } from './PgPaymentRecoveryProcess';
import type { PaymentRecoveryExecution } from '../../application/port/PaymentRecoveryProcess';

export class PgRefundRecoveryProcess {
  private readonly refunds: RefundPlanner;
  private readonly access = new PgTransactionAccess();
  constructor(
    private readonly transactions: TransactionManager,
    private readonly gateway: PaymentGateway,
    private readonly dependencies: PaymentRecoveryDependencies
  ) {
    this.refunds = new RefundPlanner(dependencies.orders);
  }
  async resolveProviderRefund(selected: IntentTarget, observed: ProviderObservation, execution: PaymentRecoveryExecution): Promise<void> {
    const evidence = { intent: selected.intent, order: selected.order_id, providerState: observed.state, amountMinor: observed.amountMinor, transaction: observed.transaction ?? null, detectedAt: new Date().toISOString() };
    const recovery = `recovery:providerrefund:${selected.intent}`;
    await this.write(execution, async (_context, client) => {
      await client.query(
        `insert into payment.recoverycase(id,scope_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
        occurrence_count,opened_at) values($1,$2,$3,'intent',$4,'high','open','PAYMENT_PROVIDER_REFUNDED',$5::jsonb,1,clock_timestamp())
        on conflict(resource_type,resource_id) do update set occurrence_count=payment.recoverycase.occurrence_count+1,evidence=excluded.evidence`,
        [recovery, selected.scope_id, selected.order_id, selected.intent, JSON.stringify(evidence)]
      );
      await new PgRuntimeWriter(client).append({
        id: `event:${randomUUID()}`,
        type: 'payment.recovery.opened',
        aggregateType: 'payment',
        aggregate: selected.intent,
        scope: selected.scope_id,
        payload: { recovery, reason: 'PAYMENT_PROVIDER_REFUNDED', evidence },
        trace: `recovery:${selected.intent}`,
      });
    });
  }
  async createRefund(aftersale: string, execution: PaymentRecoveryExecution): Promise<string> {
    const id = `refund:${aftersale}`;
    return this.write(execution, async (context, client) => {
      const sale = await this.dependencies.orders.lockAfterSale(context, aftersale);
      if (!sale || !afterSaleRefundRunnable(sale.state)) throw new Error('AFTERSALE_REFUND_NOT_RUNNABLE');
      const target = (
        await client.query<{ payment: string; available_minor: number }>(
          `select payment.id payment,(payment.captured_minor-payment.refunded_minor)::float8 available_minor
        from payment.intent intent join payment.payment payment on payment.intent_id=intent.id
        where intent.order_id=$1 and payment.captured_minor>payment.refunded_minor for update of payment`,
          [sale.order]
        )
      ).rows[0];
      if (!target) throw new Error('AFTERSALE_REFUND_NOT_RUNNABLE');
      const amountMinor = sale.amountMinor ?? target.available_minor;
      if (amountMinor <= 0 || amountMinor > target.available_minor) throw new Error('AFTERSALE_REFUND_NOT_RUNNABLE');
      const refund = await this.refunds.create(context, {
        id,
        payment: target.payment,
        amountMinor,
        idempotency: aftersale,
        reason: sale.reason,
        scope: sale.scope,
        scopes: Object.freeze([sale.scope]),
        aftersale,
      });
      await this.dependencies.orders.startAftersaleRefund(context, aftersale);
      return refund.id;
    });
  }
  async refund(refundid: string, worker: string, execution: PaymentRecoveryExecution): Promise<void> {
    const selected = await this.read(execution, async (context, database) => {
      const loaded = await database.query<{
        id: string;
        payment_id: string;
        state: string;
        amount_minor: number;
        currency: string;
        reason: string;
        external_minor: number;
        external_total: number;
        transaction: string | null;
        order_id: string;
      }>(
        `select refund.id,refund.payment_id,refund.state,
      refund.amount_minor::float8 amount_minor,refund.currency,refund.reason,
      coalesce((select sum(leg.amount_minor) from payment.refundtender leg where leg.refund_id=refund.id and leg.kind='wechat'),0)::float8 external_minor,
      coalesce((select plan.amount_minor from payment.intenttender plan where plan.intent_id=intent.id and plan.kind='wechat'),0)::float8 external_total,
      (select attempt.external_transaction from payment.attempt attempt where attempt.intent_id=intent.id and attempt.provider='wechat'
      and attempt.state='succeeded' order by attempt.requested_at desc limit 1) transaction,intent.order_id
      from payment.refund refund join payment.payment payment on payment.id=refund.payment_id join payment.intent intent on intent.id=payment.intent_id
      where refund.id=$1 and refund.state in('requested','submitted','processing')`,
        [refundid]
      );
      const payment = loaded.rows[0];
      if (!payment) return null;
      const order = await this.dependencies.orders.payment(context, payment.order_id);
      if (!order) throw new Error('ORDER_NOT_FOUND');
      return Object.freeze({ ...payment, scope_id: order.scope, member_id: order.member });
    });
    if (!selected) return;
    if (selected.currency !== 'CNY') throw new Error('PAYMENT_CURRENCY_UNSUPPORTED');
    if (selected.external_minor === 0) return this.completeRefund(refundid, null, execution);
    if (!selected.transaction || selected.external_total <= 0) throw new Error('PAYMENT_TRANSACTION_REFERENCE_MISSING');
    const attempt = `providerattempt:${randomUUID()}`;
    await this.write(execution, async (context, database) => {
      const sequence = await database.query<{ sequence: number }>(`select coalesce(max(sequence),0)+1 sequence from payment.providerattempt where refund_id=$1`, [refundid]);
      await database.query(
        `insert into payment.providerattempt(id,refund_id,sequence,operation,worker_id,outcome,started_at)
        values($1,$2,$3,$4,$5,'started',clock_timestamp())`,
        [attempt, refundid, sequence.rows[0]!.sequence, selected.state === 'requested' ? 'apply' : 'query', worker]
      );
      await this.dependencies.operations.record(context, {
        id: `provideroperation:refund:${refundid}`,
        provider: 'wechat',
        scope: selected.scope_id,
        kind: 'refund',
        idempotency: refundid,
        reference: refundid,
        external: null,
        state: 'processing',
        requestHash: digest(`${refundid}:${selected.external_minor}:${selected.external_total}:${selected.currency}`),
        response: {},
      });
    });
    let result: Readonly<{ state: 'processing' | 'succeeded' | 'failed'; reference: string }>;
    try {
      result =
        selected.state === 'requested'
          ? await this.gateway.refund({ refundNumber: PaymentReference.refund(refundid).text, transaction: selected.transaction, refundMinor: selected.external_minor, totalMinor: selected.external_total, reason: selected.reason })
          : await this.gateway.queryRefund(PaymentReference.refund(refundid).text);
      await this.write(execution, async (context, database) => {
        await database.query(
          `with changed as(
        update payment.providerattempt set outcome='succeeded',provider_state=$2,provider_reference=$3,completed_at=clock_timestamp()
        where id=$1 returning refund_id)
        insert into payment.refundreceipt(id,refund_id,provider_attempt_id,scope_id,outcome,provider_state,provider_reference,receipt_hash,recorded_at)
        select $4,changed.refund_id,$1,$5,'succeeded',$2,$3,$6,clock_timestamp() from changed`,
          [attempt, result.state, result.reference, `refundreceipt:${attempt}`, selected.scope_id, digest(JSON.stringify(result))]
        );
        await this.dependencies.operations.update(context, {
          provider: 'wechat',
          kind: 'refund',
          idempotency: refundid,
          external: result.reference,
          state: result.state === 'failed' ? 'failed' : result.state === 'succeeded' ? 'succeeded' : 'processing',
          response: result,
        });
      });
    } catch (cause) {
      const failure = error(cause);
      await this.write(execution, async (context, database) => {
        await database.query(
          `with changed as(
        update payment.providerattempt set outcome='unknown',error_code=$2,completed_at=clock_timestamp() where id=$1 returning refund_id)
        insert into payment.refundreceipt(id,refund_id,provider_attempt_id,scope_id,outcome,error_code,receipt_hash,recorded_at)
        select $3,changed.refund_id,$1,$4,'unknown',$2,$5,clock_timestamp() from changed`,
          [attempt, failure, `refundreceipt:${attempt}`, selected.scope_id, digest(failure)]
        );
        await this.dependencies.operations.update(context, { provider: 'wechat', kind: 'refund', idempotency: refundid, state: 'unknown', response: { error: failure } });
      });
      throw cause;
    }
    if (result.state === 'failed') {
      await this.write(execution, async (_context, client) => {
        await client.query("update payment.refund set state='failed',external_transaction=$2,version=version+1 where id=$1 and state<>'succeeded'", [refundid, result.reference]);
        await client.query("update payment.refundtender set state='failed',provider_reference=case when kind='wechat' then $2 else null end where refund_id=$1 and state<>'succeeded'", [refundid, result.reference]);
      });
      return;
    }
    await this.write(execution, async (_context, database) => {
      await database.query(
        `with changed as(update payment.refund set state='processing',external_transaction=$2,version=version+1
        where id=$1 and state<>'succeeded' returning id) update payment.refundtender set state='processing',provider_reference=case when kind='wechat' then $2 else provider_reference end
        where refund_id=$1 and state='planned'`,
        [refundid, result.reference]
      );
    });
    if (result.state === 'processing') {
      await this.write(execution, (_context, database) => enqueue(database, 'paymentrefund', 'payment', selected.scope_id, { refund: refundid }, 30));
      return;
    }
    await this.completeRefund(refundid, result.reference, execution);
  }
  async completeRefund(refundid: string, reference: string | null, execution: PaymentRecoveryExecution): Promise<void> {
    await this.write(execution, (context) => this.dependencies.refundSettlement.complete(context, refundid, reference));
  }

  private read<T>(execution: PaymentRecoveryExecution, work: (context: ReadTransactionContext, database: SqlExecutor) => Promise<T>): Promise<T> {
    return this.transactions.read(options(execution), (context) => work(context, this.access.database(context)));
  }

  private write<T>(execution: PaymentRecoveryExecution, work: (context: WriteTransactionContext, database: SqlExecutor) => Promise<T>): Promise<T> {
    return this.transactions.write(options(execution), (context) => work(context, this.access.database(context)));
  }
}

function options(execution: PaymentRecoveryExecution) {
  return { tenant: execution.scope, membership: '', scope: execution.scope, actor: 'job:payment', trace: execution.trace, operation: 'job.payment.refund', workload: 'jobs' as const, signal: execution.signal, deadline: execution.deadline };
}

export function afterSaleRefundRunnable(state: string): boolean {
  return state === 'refunding';
}
