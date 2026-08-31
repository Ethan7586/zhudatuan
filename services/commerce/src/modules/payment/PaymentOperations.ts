import { createHash, randomUUID } from 'node:crypto';
import { DomainError } from '../../foundation/domain/DomainError';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK, type AuditSink } from '../../foundation/application/AuditSink';
import { requireAccess } from '../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, keysetResult, queryPage, textField } from '../../foundation/interface/Validation';
import type { OperationRequest, OperationResult, OperationUsecase } from '../../foundation/application/OperationHandler';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import { organizationScope } from '../../foundation/security/OrganizationScope';
import { PAYMENT_GATEWAY, type PaymentGateway } from './application/port/PaymentGateway';
import { RefundPlanner } from './application/RefundPlanner';
import { PAYMENT_ORDER_PORT } from '../order/public/index';
import type { PaymentOrderPort } from '../order/public/index';
import {
  claimPaymentRequest as claimRequest,
  completePaymentRequest as completeRequest,
  enqueuePaymentRecovery as enqueueRecovery,
  isPaymentOutcomeUnknown as providerOutcomeUnknown,
  paymentTransaction as transaction,
  setPaymentContext as setContext,
} from './PaymentOperationSupport';
import { PaymentWebhook } from './PaymentWebhook';
import { ORGANIZATION_READ_PORT, type OrganizationReadPort } from '../organization/public';
import { MEMBER_ACCESS_PORT, type MemberAccessPort } from '../access/public';
import { ReadPayment } from './application/ReadPayment';

export function paymentOperations(context: ModuleContext): OperationUsecase {
  return new PaymentOperations(
    context.service(DATABASE_POOL).workload('command'),
    context.service(PAYMENT_GATEWAY),
    context.service(AUDIT_SINK),
    context.ports.get(PAYMENT_ORDER_PORT),
    context.ports.get(ORGANIZATION_READ_PORT),
    context.ports.get(MEMBER_ACCESS_PORT)
  );
}

class PaymentOperations implements OperationUsecase {
  private readonly refunds: RefundPlanner;
  private readonly webhook: PaymentWebhook;
  private readonly readPayment: ReadPayment;
  constructor(
    private readonly pool: DatabasePool,
    private readonly gateway: PaymentGateway,
    private readonly audit: AuditSink,
    private readonly orders: PaymentOrderPort,
    private readonly organizations: OrganizationReadPort,
    members: Pick<MemberAccessPort, 'member'>
  ) {
    this.refunds = new RefundPlanner(orders);
    this.webhook = new PaymentWebhook(pool, gateway, audit, orders);
    this.readPayment = new ReadPayment(members, orders);
  }

  async invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.type === 'payment.intents.read') return this.readIntent(request);
    if (request.type === 'payment.refunds.request') return this.refund(request);
    if (request.type === 'payment.recoveries.read') return this.readRecoveries(request);
    if (request.type === 'payment.recoveries.resolve') return this.resolveRecovery(request);
    if (request.type === 'payment.webhooks.wechat') return this.webhook.handle(request);
    throw new Error(`OPERATION_ACTION_MISSING:${request.type}`);
  }

  private readIntent(request: OperationRequest): Promise<OperationResult> {
    const access = requireAccess(request);
    const paymentid = request.input.path.paymentid;
    if (!paymentid) throw new DomainError('VALIDATION_FAILED', { field: 'paymentid' });
    return transaction(this.pool, request, async (database) => ({ status: 200, body: await this.readPayment.execute(database, access.membership.id, paymentid) }));
  }

  private async refund(request: OperationRequest): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    const id = `refund:${randomUUID()}`;
    const amount = integerField(body, 'amountMinor', 1);
    const payment = textField(body, 'payment');
    const reason = textField(body, 'reason', 500);
    return transaction(this.pool, request, async (database) => {
      const cached = await claimRequest(database, request, access.actor.id, access.scope.id);
      if (cached) return cached;
      const scopes = await this.organizations.descendants(database, organizationScope(access.scope));
      const refund = await this.refunds.create(database, { id, payment, amountMinor: amount, idempotency: request.input.idempotency!, reason, scope: access.scope.id, scopes });
      await database.query(
        `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,'paymentrefund','payment',$2,jsonb_build_object('refund',$3::text,'actor',$4::text),'queued',10,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
        [`job:${refund.id}`, access.scope.id, refund.id, access.actor.id]
      );
      const response = { status: 202, body: refund } satisfies OperationResult;
      await completeRequest(this.audit, database, request, response, access.actor.id, access.scope.id);
      return response;
    });
  }

  private async readRecoveries(request: OperationRequest): Promise<OperationResult> {
    const access = requireAccess(request);
    const page = queryPage(request);
    return transaction(this.pool, request, async (database) => {
      const scopes = await this.organizations.descendants(database, organizationScope(access.scope));
      const result = await database.query<{ order_id: string | null; opened_at: string } & Record<string, unknown>>(
        `select recovery.id,recovery.order_id,recovery.resource_type,recovery.resource_id,
        recovery.severity,recovery.state,recovery.error_code,recovery.evidence,recovery.occurrence_count,recovery.opened_at,recovery.resolved_at,
        recovery.resolution_request_id from payment.recoverycase recovery
        where recovery.scope_id=any($4::text[]) and ($1::timestamptz is null or (recovery.opened_at,recovery.id)<($1::timestamptz,$2))
        order by recovery.opened_at desc,recovery.id desc limit $3`,
        [page.sort, page.id, page.fetch, scopes]
      );
      const numbers = await this.orders.numbers(
        database,
        result.rows.flatMap(({ order_id }) => (typeof order_id === 'string' ? [order_id] : []))
      );
      return keysetResult({ ...result, rows: result.rows.map((row) => ({ ...row, order_number: row.order_id ? (numbers[row.order_id] ?? null) : null })) }, page, 'opened_at');
    });
  }

  private async resolveRecovery(request: OperationRequest): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    const action = textField(body, 'action', 32);
    if (!['replay', 'requery', 'retryrefund', 'resolve'].includes(action)) throw new Error('PAYMENT_RECOVERY_ACTION_INVALID');
    const reason = textField(body, 'reason', 500);
    const caseid = request.input.path.caseid!;
    return transaction(this.pool, request, async (database) => {
      const cached = await claimRequest(database, request, access.actor.id, access.scope.id);
      if (cached) return cached;
      const scopes = await this.organizations.descendants(database, organizationScope(access.scope));
      const recovery = (
        await database.query<{ id: string; scope_id: string; resource_type: string; resource_id: string; state: string; evidence: Record<string, unknown> }>(
          `select id,scope_id,resource_type,resource_id,state,evidence from payment.recoverycase
        where id=$1 and scope_id=any($2::text[]) for update`,
          [caseid, scopes]
        )
      ).rows[0];
      if (!recovery) throw new Error('PAYMENT_RECOVERY_NOT_FOUND');
      if (recovery.state !== 'open') throw new Error('PAYMENT_RECOVERY_ALREADY_RESOLVED');
      const requestid = `recoveryrequest:${createHash('sha256').update(`${caseid}:${request.input.idempotency}`).digest('hex').slice(0, 32)}`;
      await database.query(
        `insert into payment.recoveryrequest(id,case_id,scope_id,actor_id,membership_id,reason,evidence_hash,trace_id,created_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`,
        [requestid, caseid, recovery.scope_id, access.actor.id, access.membership.id, reason, createHash('sha256').update(JSON.stringify(recovery.evidence)).digest('hex'), access.trace]
      );
      if (action === 'replay') {
        if (recovery.resource_type !== 'deadletter') throw new Error('PAYMENT_RECOVERY_RESOURCE_INVALID');
        const kind = recovery.evidence.kind;
        const payload = recovery.evidence.payload;
        if ((kind !== 'paymentquery' && kind !== 'paymentrefund') || payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('PAYMENT_DEADLETTER_EVIDENCE_INVALID');
        }
        await enqueueRecovery(database, requestid, kind, recovery.scope_id, payload as Readonly<Record<string, string>>);
        await database.query(`update runtime.deadletter set reviewed_at=clock_timestamp() where id=$1 and owner='payment'`, [recovery.evidence.deadletter]);
      }
      if (action === 'requery') {
        if (recovery.resource_type !== 'intent') throw new Error('PAYMENT_RECOVERY_RESOURCE_INVALID');
        const intent = await database.query('select id from payment.intent where id=$1', [recovery.resource_id]);
        if (!intent.rows[0]) throw new Error('PAYMENT_INTENT_NOT_FOUND');
        await enqueueRecovery(database, requestid, 'paymentquery', recovery.scope_id, { intent: recovery.resource_id });
      }
      if (action === 'retryrefund') {
        const refund = recovery.resource_type === 'refund' ? recovery.resource_id : String(recovery.evidence.refund ?? '');
        const refundable = await database.query<{ state: string }>('select state from payment.refund where id=$1 for update', [refund]);
        if (!refundable.rows[0] || refundable.rows[0].state === 'succeeded') throw new Error('PAYMENT_REFUND_NOT_RETRYABLE');
        if (refundable.rows[0].state === 'failed') {
          await database.query(`update payment.refund set state='requested',version=version+1 where id=$1`, [refund]);
          await database.query(`update payment.refundtender set state='planned' where refund_id=$1 and state='failed'`, [refund]);
        }
        await enqueueRecovery(database, requestid, 'paymentrefund', recovery.scope_id, { refund });
      }
      if (action === 'resolve') {
        await database.query(`update payment.recoverycase set state='resolved',resolved_at=clock_timestamp(),resolution_request_id=$2 where id=$1`, [caseid, requestid]);
        if (recovery.resource_type === 'deadletter')
          await database.query(
            `update runtime.deadletter set reviewed_at=clock_timestamp()
          where id=$1 and owner='payment'`,
            [recovery.evidence.deadletter]
          );
      }
      const response = { status: 202, body: { case: caseid, request: requestid, action, state: action === 'resolve' ? 'resolved' : 'accepted' } } satisfies OperationResult;
      await completeRequest(this.audit, database, request, response, access.actor.id, access.scope.id);
      return response;
    });
  }
}
