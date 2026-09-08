import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { PaymentGateway } from '../../application/port/PaymentGateway';
import { PaymentReference } from '../../domain/model/PaymentReference';
import { PaymentSettlement } from './PaymentSettlement';
import { RefundPlanner } from '../../infrastructure/persistence/RefundPlanner';
import { RefundSettlement } from './RefundSettlement';
import { PaymentLifecycle } from '../../domain/policy/PaymentLifecycle';
import { PgRefundRecoveryProcess } from './PgRefundRecoveryProcess';
import {
  assertProviderAmount,
  enqueuePaymentJob as enqueue,
  intentExpired,
  paymentDigest as digest,
  paymentApplication,
  providerError as error,
  recordProviderObservation,
  type IntentTarget,
  type ProviderObservation,
} from './PaymentRecoveryPersistence';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { PaymentRecoveryExecution, PaymentRecoveryProcess } from '../../application/port/PaymentRecoveryProcess';
import { paymentProviderExecution, paymentRecoveryOptions as options, type PaymentRecoveryDependencies } from './PaymentRecoveryContext';
export class PgPaymentRecoveryProcess implements PaymentRecoveryProcess {
  private readonly refunds: RefundPlanner;
  private readonly lifecycle = new PaymentLifecycle();
  private readonly refundJobs: PgRefundRecoveryProcess;
  private readonly access = new PgTransactionAccess();
  constructor(
    private readonly transactions: TransactionManager,
    private readonly gateway: PaymentGateway,
    private readonly dependencies: PaymentRecoveryDependencies
  ) {
    this.refunds = new RefundPlanner(dependencies.orders);
    this.refundJobs = new PgRefundRecoveryProcess(transactions, gateway, dependencies);
  }
  async query(intentid: string, execution: PaymentRecoveryExecution): Promise<void> {
    const selected = await this.read(execution, async (context, database) => {
      const loaded = await database.query<Omit<IntentTarget, 'order_number' | 'scope_id' | 'mall_id' | 'member_id'>>(
        `select intent.id intent,intent.order_id,
      intent.amount_minor::float8 amount_minor,plan.amount_minor::float8 provider_minor,intent.currency,intent.state intent_state,attempt.id attempt,intent.expires_at,
      attempt.scene,attempt.application_hash
      from payment.intent intent join payment.intenttender plan on plan.intent_id=intent.id and plan.kind='wechat'
      join payment.attempt attempt on attempt.intent_id=intent.id where intent.id=$1 and attempt.provider='wechat'
      order by attempt.requested_at desc,attempt.id desc limit 1`,
        [intentid]
      );
      const payment = loaded.rows[0];
      if (!payment) return null;
      const order = await this.dependencies.orders.payment(context, payment.order_id);
      if (!order) throw new Error('ORDER_NOT_FOUND');
      return Object.freeze({ ...payment, order_number: order.number, scope_id: order.scope, mall_id: order.mall, member_id: order.member }) as IntentTarget;
    });
    if (!selected) return;
    const observed = await this.gateway.query(PaymentReference.payment(selected.order_number).text, paymentApplication(selected), paymentProviderExecution(execution));
    await this.write(execution, (_context, database) => recordProviderObservation(database, selected, observed, 'query'));
    assertProviderAmount(selected, observed);
    const action = this.lifecycle.afterQuery(observed.state, intentExpired(selected));
    if (action === 'settle') return this.settleObserved(selected, observed, execution);
    if (action === 'requery') {
      await this.write(execution, (_context, database) => enqueue(database, 'paymentquery', 'payment', selected.scope_id, { intent: selected.intent }, 30));
      return;
    }
    if (action === 'close') return this.closeExpired(selected, execution);
    if (action === 'recover') return this.refundJobs.resolveProviderRefund(selected, observed, execution);
    if (action === 'expire') return this.expire(selected, observed.state, execution);
    await this.resetAttempt(selected, observed.state, execution);
  }
  private async closeExpired(selected: IntentTarget, execution: PaymentRecoveryExecution): Promise<void> {
    let closeFailure: unknown;
    try {
      await this.gateway.close(PaymentReference.payment(selected.order_number).text, paymentApplication(selected), paymentProviderExecution(execution));
    } catch (cause) {
      closeFailure = cause;
    }
    const observed = await this.gateway.query(PaymentReference.payment(selected.order_number).text, paymentApplication(selected), paymentProviderExecution(execution));
    await this.write(execution, (_context, database) => recordProviderObservation(database, selected, observed, 'close'));
    assertProviderAmount(selected, observed);
    const action = this.lifecycle.afterClose(observed.state);
    if (action === 'settle') return this.settleObserved(selected, observed, execution);
    if (action === 'recover') return this.refundJobs.resolveProviderRefund(selected, observed, execution);
    if (action === 'requery') {
      if (closeFailure) throw closeFailure;
      await this.write(execution, (_context, database) => enqueue(database, 'paymentquery', 'payment', selected.scope_id, { intent: selected.intent }, 3));
      return;
    }
    await this.expire(selected, observed.state, execution);
  }
  private settleObserved(selected: IntentTarget, observed: ProviderObservation, execution: PaymentRecoveryExecution): Promise<void> {
    if (!observed.transaction) throw new Error('PAYMENT_PROVIDER_TRANSACTION_MISSING');
    return this.settleSuccess(selected, observed.transaction, execution);
  }
  private settleSuccess(selected: IntentTarget, transaction: string, execution: PaymentRecoveryExecution): Promise<void> {
    return this.write(execution, async (context, client) => {
      const order = await this.dependencies.orders.lockPayment(context, selected.order_id);
      if (!order) throw new Error('ORDER_NOT_FOUND');
      const current = (
        await client.query<{ intent_state: string; payment: string | null }>(
          `select intent.state intent_state,(select id from payment.payment where intent_id=intent.id) payment
        from payment.intent intent join payment.attempt attempt on attempt.intent_id=intent.id
        where intent.id=$1 and attempt.id=$2 for update of intent,attempt`,
          [selected.intent, selected.attempt]
        )
      ).rows[0];
      if (!current) {
        return;
      }
      await client.query(
        `update payment.attempt set state='succeeded',external_transaction=$2,completed_at=clock_timestamp()
        where id=$1 and (external_transaction is null or external_transaction=$2)`,
        [selected.attempt, transaction]
      );
      if (current.payment) {
        return;
      }
      const payable = ['created', 'preparing', 'pending'].includes(current.intent_state) && ['unpaid', 'authorizing'].includes(order.paymentState) && order.lifecycleState !== 'cancelled';
      if (payable) {
        await this.dependencies.settlement.capture(
          context,
          { intent: selected.intent, order: selected.order_id, scope: selected.scope_id, mall: selected.mall_id, member: selected.member_id, amountMinor: selected.amount_minor, currency: selected.currency },
          selected.amount_minor === selected.provider_minor ? 'wechat' : 'mixed'
        );
      } else {
        await this.captureLatePayment(context, client, selected, transaction);
      }
    });
  }
  private async captureLatePayment(context: WriteTransactionContext, database: SqlExecutor, selected: IntentTarget, transaction: string): Promise<void> {
    await this.dependencies.holds.release(context, selected.order_id);
    await database.query(`update payment.intenttender set state=case when kind='wechat' then 'captured' else 'released' end where intent_id=$1`, [selected.intent]);
    await database.query(`update payment.intent set state='captured',version=version+1 where id=$1`, [selected.intent]);
    const payment = `payment:${selected.intent}`;
    await database.query(
      `insert into payment.payment(id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state,version)
      values($1,$2,$3,$4,$3,0,'captured',0)`,
      [payment, selected.intent, selected.provider_minor, selected.currency]
    );
    await database.query(
      `insert into payment.capture(id,scope_id,mall_id,member_id,order_id,source,currency,amount_minor,state,idempotency_key,completed_at,created_at)
      values($1,$2,$3,$4,$5,'latewechat',$6,$7,'succeeded',$8,clock_timestamp(),clock_timestamp())`,
      [`capture:${selected.intent}`, selected.scope_id, selected.mall_id, selected.member_id, selected.order_id, selected.currency, selected.provider_minor, `late:${selected.intent}`]
    );
    await database.query(
      `insert into payment.allocation(payment_id,target_type,target_id,amount_minor,currency)
      values($1,'order',$2,$3,$4)`,
      [payment, selected.order_id, selected.provider_minor, selected.currency]
    );
    const refund = await this.refunds.create(context, {
      id: `refund:late:${selected.intent}`,
      payment,
      amountMinor: selected.provider_minor,
      idempotency: `late:${selected.intent}`,
      reason: 'latepayment',
      scope: selected.scope_id,
      scopes: Object.freeze([selected.scope_id]),
    });
    const evidence = { intent: selected.intent, order: selected.order_id, payment, refund: refund.id, transaction, providerMinor: selected.provider_minor, detectedAt: new Date().toISOString() };
    await database.query(
      `insert into payment.recoverycase(id,scope_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
      occurrence_count,opened_at) values($1,$2,$3,'intent',$4,'critical','open','PAYMENT_LATE_SUCCESS',$5::jsonb,1,clock_timestamp())
      on conflict(resource_type,resource_id) do update set occurrence_count=payment.recoverycase.occurrence_count+1,evidence=excluded.evidence,version=payment.recoverycase.version+1`,
      [`recovery:late:${selected.intent}`, selected.scope_id, selected.order_id, selected.intent, JSON.stringify(evidence)]
    );
    const runtime = new PgRuntimeWriter(database);
    await runtime.reschedule({ id: `job:late:${selected.intent}`, kind: 'paymentrefund', owner: 'payment', scope: selected.scope_id, payload: { refund: refund.id }, priority: 1 });
    for (const [type, aggregate, payload] of [
      ['payment.late.detected', payment, evidence],
      ['payment.autorefund.requested', refund.id, { ...evidence, refund: refund.id }],
    ] as const)
      await runtime.append({ id: `event:${randomUUID()}`, type, aggregateType: 'payment', aggregate, scope: selected.scope_id, payload, trace: `late:${selected.intent}` });
  }
  private expire(selected: IntentTarget, providerState: string, execution: PaymentRecoveryExecution): Promise<void> {
    return this.write(execution, async (context, client) => {
      const changed = await client.query(
        `update payment.intent set state=case when expires_at<=clock_timestamp() then 'expired' else 'cancelled' end,version=version+1 where id=$1
        and state in('created','preparing','pending') returning id`,
        [selected.intent]
      );
      if (changed.rows[0]) {
        await this.dependencies.orders.cancelUnpaid(context, selected.order_id);
        await this.dependencies.holds.release(context, selected.order_id);
        await new PgRuntimeWriter(client).append({
          id: `event:${randomUUID()}`,
          type: 'order.cancelled',
          aggregateType: 'order',
          aggregate: selected.order_id,
          scope: selected.scope_id,
          payload: { order: selected.order_id, reason: providerState === 'closed' ? 'providerclosed' : 'paymenttimeout', providerState },
          trace: `payment:${selected.intent}`,
        });
      }
    });
  }
  private resetAttempt(selected: IntentTarget, providerState: string, execution: PaymentRecoveryExecution): Promise<void> {
    return this.write(execution, async (context, client) => {
      await client.query("update payment.attempt set state='failed',completed_at=clock_timestamp() where id=$1 and state<>'succeeded'", [selected.attempt]);
      await client.query("update payment.action set state='expired',version=version+1 where intent_id=$1 and state='active'", [selected.intent]);
      await client.query("update payment.intent set state='created',version=version+1 where id=$1 and state in('preparing','pending')", [selected.intent]);
      await this.dependencies.orders.resetPayment(context, selected.order_id);
      await new PgRuntimeWriter(client).append({
        id: `event:${randomUUID()}`,
        type: 'payment.attempt.failed',
        aggregateType: 'payment',
        aggregate: selected.intent,
        scope: selected.scope_id,
        payload: { intent: selected.intent, order: selected.order_id, providerState },
        trace: `payment:${selected.intent}`,
      });
    });
  }
  completeEvent(eventid: string, execution: PaymentRecoveryExecution): Promise<void> {
    return this.write(execution, async (_context, client) => {
      const runtime = new PgRuntimeWriter(client);
      const payload = (await runtime.claim('provider.wechatpayment', eventid))?.payload;
      if (!payload) {
        return;
      }
      if (typeof payload.tradeState === 'string')
        await client.query(
          `insert into payment.observation(id,attempt_id,provider_event_id,state,amount_minor,currency,payload_hash,observed_at)
        select $1,attempt.id,$2,$3,$4,'CNY',$5,clock_timestamp() from payment.intent intent join payment.attempt attempt on attempt.intent_id=intent.id
        where intent.provider_reference=$6 order by attempt.requested_at desc limit 1 on conflict(provider_event_id) do nothing`,
          [`observation:${digest(eventid)}`, eventid, payload.tradeState, payload.totalCents, digest(JSON.stringify(payload)), payload.outTradeNo]
        );
      await runtime.completeInbox('provider.wechatpayment', eventid);
    });
  }

  createRefund(aftersale: string, execution: PaymentRecoveryExecution): Promise<string> {
    return this.refundJobs.createRefund(aftersale, execution);
  }

  refund(refund: string, worker: string, execution: PaymentRecoveryExecution): Promise<void> {
    return this.refundJobs.refund(refund, worker, execution);
  }

  private read<T>(execution: PaymentRecoveryExecution, work: (context: ReadTransactionContext, database: SqlExecutor) => Promise<T>): Promise<T> {
    return this.transactions.read(options(execution), (context) => work(context, this.access.database(context)));
  }

  private write<T>(execution: PaymentRecoveryExecution, work: (context: WriteTransactionContext, database: SqlExecutor) => Promise<T>): Promise<T> {
    return this.transactions.write(options(execution), (context) => work(context, this.access.database(context)));
  }
}

export type { PaymentRecoveryDependencies } from './PaymentRecoveryContext';
