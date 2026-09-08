import type { PaymentApplication, PaymentGateway } from '../../application/port/PaymentGateway';
import type { PaymentCancellationEvent, PaymentCancellationProcess } from '../../application/port/PaymentCancellationProcess';
import { PaymentReference } from '../../domain/model/PaymentReference';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { PaymentHoldReleaser } from './PaymentSettlement';
import { mapParallel } from '@shop/kernel';

interface CancellationTarget {
  readonly intent: string;
  readonly orderNumber: string;
  readonly scene: PaymentApplication['scene'] | null;
  readonly applicationHash: string | null;
}

/**
 * Owns the Payment side of order cancellation. The local transition and hold
 * release commit before any provider I/O; provider close is therefore
 * retry-safe and a deterministic query job resolves every unknown outcome.
 */
export class PgPaymentCancellationProcess implements PaymentCancellationProcess {
  private readonly access = new PgTransactionAccess();

  constructor(
    private readonly transactions: TransactionManager,
    private readonly gateway: PaymentGateway,
    private readonly holds: Pick<PaymentHoldReleaser, 'release'>
  ) {}

  async process(event: PaymentCancellationEvent, signal: AbortSignal, deadline: number): Promise<void> {
    const targets = await this.transactions.write(options(event, signal, deadline, 'prepare'), async (context) => {
      const database = this.access.database(context);
      const inbox = await claim(database, event);
      await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`paymentcancel:${event.scopeId}:${event.orderId}`]);
      const selected = await database.query<CancellationTarget>(
        `select intent.id intent,intent.order_number "orderNumber",attempt.scene,attempt.application_hash "applicationHash"
        from payment.intent intent
        left join lateral(
          select candidate.scene,candidate.application_hash from payment.attempt candidate
          where candidate.intent_id=intent.id and candidate.provider='wechat'
          order by candidate.requested_at desc,candidate.id desc limit 1
        ) attempt on true
        where intent.order_id=$1 and intent.scope_id=$2
          and intent.state in('created','preparing','pending','cancelled')
          and not exists(select 1 from payment.payment captured where captured.intent_id=intent.id)
        order by intent.id for update of intent`,
        [event.orderId, event.scopeId]
      );
      await database.query(
        `update payment.intent set state='cancelled',version=version+1
        where order_id=$1 and scope_id=$2 and state in('created','preparing','pending')
          and not exists(select 1 from payment.payment captured where captured.intent_id=payment.intent.id)`,
        [event.orderId, event.scopeId]
      );
      await database.query(
        `update payment.action set state='expired',version=version+1
        where intent_id in(select id from payment.intent where order_id=$1 and scope_id=$2)
          and state='active'`,
        [event.orderId, event.scopeId]
      );
      await this.holds.release(context, event.orderId);
      return Object.freeze(selected.rows.map((row) => validate(row, inbox.id)));
    });

    await mapParallel(targets, 4, async (target) => {
      if (!target.scene || !target.applicationHash) return;
      try {
        await this.gateway.close(PaymentReference.payment(target.orderNumber).text, { scene: target.scene, applicationHash: target.applicationHash }, { requestId: event.eventId, traceId: event.eventId, signal, deadline });
      } catch {
        // The deterministic paymentquery job below is the source of truth for an
        // unknown provider outcome, including a close request that timed out.
      }
    });

    await this.transactions.write(options(event, signal, deadline, 'complete'), async (context) => {
      const database = this.access.database(context);
      await claim(database, event);
      const runtime = new PgRuntimeWriter(database);
      for (const target of targets) {
        if (!target.scene || !target.applicationHash) continue;
        await runtime.schedule({
          id: `job:cancelquery:${event.eventId}:${target.intent}`,
          kind: 'paymentquery',
          owner: 'payment',
          scope: event.scopeId,
          payload: { intent: target.intent },
          priority: 1,
        });
      }
      if (!(await runtime.completeInbox('job:paymentcancel', event.eventId))) throw new Error('PAYMENT_CANCELLATION_INBOX_CONFLICT');
    });
  }
}

async function claim(database: SqlExecutor, event: PaymentCancellationEvent) {
  const inbox = await new PgRuntimeWriter(database).claim('job:paymentcancel', event.eventId);
  if (!inbox) throw new Error('PAYMENT_CANCELLATION_CONTEXT_MISSING');
  if (inbox.type !== 'order.cancelled' || inbox.version !== 1 || inbox.scope !== event.scopeId || inbox.aggregate !== event.orderId) {
    throw new Error('PAYMENT_CANCELLATION_CONTEXT_MISMATCH');
  }
  const payload = record(inbox.payload);
  if (payload.order !== event.orderId || payload.reason !== event.reason) throw new Error('PAYMENT_CANCELLATION_EVIDENCE_MISMATCH');
  return inbox;
}

function validate(target: CancellationTarget, event: string): Readonly<CancellationTarget> {
  if (!target.intent || !target.orderNumber) throw new Error(`PAYMENT_CANCELLATION_TARGET_INVALID:${event}`);
  if ((target.scene === null) !== (target.applicationHash === null)) throw new Error('PAYMENT_CANCELLATION_APPLICATION_INVALID');
  return Object.freeze(target);
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('PAYMENT_CANCELLATION_EVIDENCE_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function options(event: PaymentCancellationEvent, signal: AbortSignal, deadline: number, phase: string) {
  return {
    tenant: event.scopeId,
    membership: '',
    scope: event.scopeId,
    actor: 'system:payment',
    trace: event.eventId,
    operation: `paymentcancel:${phase}`,
    workload: 'jobs' as const,
    signal,
    deadline,
  };
}
