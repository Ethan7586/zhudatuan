import { createHash } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { keysetPage } from '../../../../foundation/application/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrganizationReadPort } from '../../../organization/public';
import type { OrderPaymentPort } from '../../../order/public';
import type { RecoveryRepository } from '../../application/port/RecoveryRepository';
import { Refund, type RefundState } from '../../domain/model/Refund';
interface RecoveryRecord {
  readonly id: string;
  readonly scope_id: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly state: string;
  readonly evidence: Record<string, unknown>;
  readonly version: number;
}
export class PgRecoveryRepository implements RecoveryRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants'>,
    private readonly orders: Pick<OrderPaymentPort, 'numbers'>
  ) {}
  async read(context: ReadTransactionContext, input: Parameters<RecoveryRepository['read']>[1]) {
    const database = this.transactions.database(context);
    const scopes = await this.organizations.descendants(context, input.scope);
    const result = await database.query<
      {
        id: string;
        order_id: string | null;
        opened_at: string;
      } & Record<string, unknown>
    >(
      `select recovery.id,recovery.order_id,recovery.resource_type,recovery.resource_id,
      recovery.severity,recovery.state,recovery.error_code,recovery.evidence,recovery.occurrence_count,recovery.opened_at,recovery.resolved_at,
      recovery.resolution_request_id,recovery.version::float8 version from payment.recoverycase recovery
      where recovery.scope_id=any($4::text[]) and ($5::text is null or recovery.order_id=$5)
      and ($1::timestamptz is null or (recovery.opened_at,recovery.id)<($1::timestamptz,$2))
      order by recovery.opened_at desc,recovery.id desc limit $3`,
      [input.page.sort, input.page.id, input.page.fetch, scopes, input.order]
    );
    const numbers = await this.orders.numbers(
      context,
      result.rows.flatMap(({ order_id }) => (order_id ? [order_id] : []))
    );
    return keysetPage(
      result.rows.map((row) => Object.freeze({ ...row, order_number: row.order_id ? (numbers[row.order_id] ?? null) : null })),
      input.page,
      'opened_at'
    );
  }
  async resolve(context: WriteTransactionContext, input: Parameters<RecoveryRepository['resolve']>[1]) {
    const database = this.transactions.database(context);
    const scopes = await this.organizations.descendants(context, input.scope);
    const recovery = (
      await database.query<RecoveryRecord>(
        `select id,scope_id,resource_type,resource_id,state,evidence,version::float8 version from payment.recoverycase
         where id=$1 and scope_id=any($2::text[]) for update`,
        [input.case, scopes]
      )
    ).rows[0];
    if (!recovery) throw new DomainError('RESOURCE_NOT_FOUND');
    if (recovery.state !== 'open') throw new Error('PAYMENT_RECOVERY_ALREADY_RESOLVED');
    if (recovery.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const request = `recoveryrequest:${digest(`${input.case}:${input.idempotency}`).slice(0, 32)}`;
    await database.query(
      `insert into payment.recoveryrequest(id,case_id,scope_id,actor_id,membership_id,reason,evidence_hash,trace_id,created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`,
      [request, input.case, recovery.scope_id, input.actor, input.membership, input.reason, digest(JSON.stringify(recovery.evidence)), input.trace]
    );
    const runtime = new PgRuntimeWriter(database);
    if (input.action === 'replay') await this.replay(runtime, recovery, request);
    if (input.action === 'requery') await this.requery(database, runtime, recovery, request);
    if (input.action === 'retryrefund') await this.retryRefund(database, runtime, recovery, request);
    const changed = await database.query(
      `update payment.recoverycase set state=case when $3='resolve' then 'resolved' else state end,
       resolved_at=case when $3='resolve' then clock_timestamp() else resolved_at end,
       resolution_request_id=$2,version=version+1 where id=$1 and state='open' and version=$4 returning version`,
      [input.case, request, input.action, input.expectedVersion]
    );
    if (!changed.rows[0]) throw new DomainError('VERSION_CONFLICT');
    if (input.action === 'resolve' && recovery.resource_type === 'deadletter') await runtime.reviewDeadletter(recovery.evidence.deadletter, 'payment');
    return Object.freeze({ case: input.case, request, action: input.action, state: input.action === 'resolve' ? ('resolved' as const) : ('accepted' as const) });
  }
  private async replay(runtime: PgRuntimeWriter, recovery: RecoveryRecord, request: string): Promise<void> {
    if (recovery.resource_type !== 'deadletter') throw new Error('PAYMENT_RECOVERY_RESOURCE_INVALID');
    const kind = recovery.evidence.kind;
    const payload = recovery.evidence.payload;
    if ((kind !== 'paymentquery' && kind !== 'paymentrefund') || !record(payload)) throw new Error('PAYMENT_DEADLETTER_EVIDENCE_INVALID');
    await runtime.schedule({ id: `job:${request}`, kind, owner: 'payment', scope: recovery.scope_id, payload, priority: 1 });
    await runtime.reviewDeadletter(recovery.evidence.deadletter, 'payment');
  }
  private async requery(database: ReturnType<PgTransactionAccess['database']>, runtime: PgRuntimeWriter, recovery: RecoveryRecord, request: string): Promise<void> {
    if (recovery.resource_type !== 'intent') throw new Error('PAYMENT_RECOVERY_RESOURCE_INVALID');
    const intent = await database.query('select id from payment.intent where id=$1', [recovery.resource_id]);
    if (!intent.rows[0]) throw new Error('PAYMENT_INTENT_NOT_FOUND');
    await runtime.schedule({ id: `job:${request}`, kind: 'paymentquery', owner: 'payment', scope: recovery.scope_id, payload: { intent: recovery.resource_id }, priority: 1 });
  }
  private async retryRefund(database: ReturnType<PgTransactionAccess['database']>, runtime: PgRuntimeWriter, recovery: RecoveryRecord, request: string): Promise<void> {
    const refund = recovery.resource_type === 'refund' ? recovery.resource_id : typeof recovery.evidence.refund === 'string' ? recovery.evidence.refund : '';
    const selected = await database.query<{ id: string; payment_id: string; amount_minor: number; currency: string; state: RefundState; reason: string; version: number }>(
      `select id,payment_id,amount_minor::float8 amount_minor,currency,state,reason,version::float8 version from payment.refund where id=$1 for update`, [refund]);
    if (!selected.rows[0] || selected.rows[0].state === 'succeeded') throw new Error('PAYMENT_REFUND_NOT_RETRYABLE');
    if (selected.rows[0].state === 'failed') {
      const current = selected.rows[0];
      const retried = new Refund({ id: current.id, payment: current.payment_id, amountMinor: current.amount_minor, currency: current.currency,
        state: current.state, reason: current.reason, version: current.version }).retry();
      const changed = await database.query(`update payment.refund set state=$2,completed_at=null,version=$3 where id=$1 and state='failed' and version=$4 returning id`,
        [refund, retried.value.state, retried.value.version, current.version]);
      if (!changed.rows[0]) throw new DomainError('VERSION_CONFLICT');
      await database.query(`update payment.refundtender set state='planned' where refund_id=$1 and state='failed'`, [refund]);
    }
    await runtime.schedule({ id: `job:${request}`, kind: 'paymentrefund', owner: 'payment', scope: recovery.scope_id, payload: { refund }, priority: 1 });
  }
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function record(value: unknown): value is Readonly<Record<string, string>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((item) => typeof item === 'string');
}
