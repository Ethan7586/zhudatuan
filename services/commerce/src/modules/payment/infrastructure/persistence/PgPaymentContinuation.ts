import { createHash, randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { PaymentContinuation } from '../../application/port/PaymentContinuation';
import type { PaymentGateway } from '../../application/port/PaymentGateway';
import { PaymentHoldReleaser, PaymentSettlement } from './PaymentSettlement';
import type { SettlementOrders } from './PaymentSettlementCore';
import { PaymentReference } from '../../domain/model/PaymentReference';
import { transportErrorCode } from '../../../../foundation/domain/SafeError';
import type { WechatScene } from '@shop/config/server';
import type { MemberAccessPort } from '../../../access/public';
import type { PaymentOrderPort } from '../../../order/public';
import type { PaymentIdentityPort } from '../../../identity/public';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { sessionAccess } from '../../../../foundation/security/OperationSecurityContext';

interface IntentState {
  readonly intent: string;
  readonly attempt: string | null;
  readonly order_id: string;
  readonly order_number: string;
  readonly scope_id: string;
  readonly mall_id: string;
  readonly member_id: string;
  readonly total_minor: number;
  readonly amount_minor: number;
  readonly payer_identity: string | null;
  readonly payer_ciphertext: string | null;
  readonly state: string | null;
  readonly parameters: unknown | null;
  readonly scene: WechatScene | null;
  readonly application_hash: string | null;
  readonly expires_at: string;
}
export interface PaymentOrders extends SettlementOrders {
  payment: PaymentOrderPort['payment'];
  lockPayment: PaymentOrderPort['lockPayment'];
  markAuthorizing(context: WriteTransactionContext, order: string): Promise<void>;
  resetPayment(context: WriteTransactionContext, order: string): Promise<void>;
}

export class PgPaymentContinuation implements PaymentContinuation {
  private readonly transactions: PgTransactionManager;
  private readonly access = new PgTransactionAccess();
  constructor(
    private readonly pool: DatabasePool,
    private readonly gateway: PaymentGateway,
    private readonly kms: KmsClient,
    private readonly settlement: PaymentSettlement,
    private readonly orders: PaymentOrders,
    private readonly members: Pick<MemberAccessPort, 'member'>,
    private readonly identities: PaymentIdentityPort,
    private readonly holds: Pick<PaymentHoldReleaser, 'release'>
  ) {
    this.transactions = new PgTransactionManager(pool);
  }

  async continue(request: OperationRequest, input: Readonly<{ order: string; scene: WechatScene }>): Promise<OperationResult> {
    const access = requireAccess(request);
    const order = input.order;
    if (!order) throw new DomainError('VALIDATION_FAILED', { field: 'order' });
    const sceneValue = input.scene;
    if (sceneValue !== 'miniapp' && sceneValue !== 'jsapi') throw new Error('PAYMENT_SCENE_INVALID');
    const scene: WechatScene = sceneValue;
    const application = this.gateway.application(scene);
    let state: IntentState;
    const immediate = await this.write(request, async (context, client) => {
      const member = await this.members.member(context, access.membership.id);
      const target = await this.orders.lockPayment(context, order, member);
      if (!target || !['unpaid', 'authorizing'].includes(target.paymentState) || target.lifecycleState === 'cancelled') {
        throw new Error('PAYMENT_INTENT_NOT_PAYABLE');
      }
      const payer = await this.identities.subject(context, access.actor.id, application.applicationHash);
      const existing = await client.query<Omit<IntentState, 'order_number' | 'scope_id' | 'mall_id' | 'member_id' | 'total_minor'>>(
        `select intent.id intent,intent.order_id,coalesce(wechat.amount_minor,0)::float8 amount_minor,
        attempt.id attempt,attempt.state,attempt.scene,
        attempt.application_hash,action.parameters,intent.expires_at
        from payment.intent intent
        left join payment.intenttender wechat on wechat.intent_id=intent.id and wechat.kind='wechat'
        left join lateral(select candidate.id,candidate.state,candidate.scene,candidate.application_hash from payment.attempt candidate where candidate.intent_id=intent.id
          and candidate.provider='wechat' order by candidate.requested_at desc,candidate.id desc limit 1) attempt on true
        left join lateral(select candidate.parameters from payment.action candidate where candidate.intent_id=intent.id
          and candidate.state='active' and candidate.expires_at>clock_timestamp() order by candidate.created_at desc,candidate.id desc limit 1) action on true
        where intent.order_id=$1 and intent.state in('created','preparing','pending')
        for update of intent`,
        [order]
      );
      const payment = existing.rows[0];
      if (!payment) throw new Error('PAYMENT_INTENT_NOT_PAYABLE');
      const prior: IntentState = Object.freeze({
        ...payment,
        order_number: target.number,
        scope_id: target.scope,
        mall_id: target.mall,
        member_id: target.member,
        total_minor: target.totalMinor,
        payer_identity: payer?.id ?? null,
        payer_ciphertext: payer?.ciphertext ?? null,
      });
      if (prior.attempt && (prior.scene !== scene || prior.application_hash !== application.applicationHash)) {
        throw new Error('PAYMENT_APPLICATION_CONFLICT');
      }
      if (prior?.parameters) {
        return { response: { status: 200, body: { intent: prior.intent, parameters: prior.parameters } } satisfies OperationResult } as const;
      }
      if (prior.state !== null && ['unknown', 'pending'].includes(prior.state)) {
        return { response: { status: 202, body: { intent: prior.intent, state: 'reconciling' } } satisfies OperationResult } as const;
      }
      if (prior.amount_minor === 0) {
        const payment = await this.settlement.capture(
          context,
          { intent: prior.intent, order: prior.order_id, scope: prior.scope_id, mall: prior.mall_id, member: prior.member_id, amountMinor: prior.total_minor, currency: 'CNY' },
          'internal'
        );
        return { response: { status: 200, body: { intent: prior.intent, payment, state: 'captured' } } satisfies OperationResult } as const;
      }
      if (!prior.payer_identity || !prior.payer_ciphertext) throw new Error('WECHAT_IDENTITY_REQUIRED');
      if (prior.attempt) {
        await client.query("update payment.attempt set state='started',requested_at=clock_timestamp(),completed_at=null where id=$1", [prior.attempt]);
        state = prior;
      } else {
        const attempt = `attempt:${randomUUID()}`;
        await client.query(
          `insert into payment.attempt(id,intent_id,tender_id,provider,scene,application_hash,state,requested_at)
          values($1,$2,'tender:wechat','wechat',$3,$4,'started',clock_timestamp())`,
          [attempt, prior.intent, scene, application.applicationHash]
        );
        await client.query("update payment.intent set state='preparing',version=version+1 where id=$1 and state='created'", [prior.intent]);
        await this.orders.markAuthorizing(context, order);
        state = { ...prior, attempt, state: 'started' };
      }
      return { state } as const;
    });
    if ('response' in immediate) return immediate.response;
    state = immediate.state;
    try {
      const payer = await this.kms.decrypt('pii', 'identity/wechat', state.payer_ciphertext!, { identity: state.payer_identity! });
      const payerHash = createHash('sha256').update(payer).digest('hex');
      await this.write(request, (_context, database) =>
        database.query(
          `update payment.attempt set payer_hash=$2
        where id=$1 and state in('started','unknown','pending')`,
          [state.attempt!, payerHash]
        )
      );
      const parameters = await this.gateway.prepay({
        description: `智慧翼福利商城-${state.order_number}`,
        orderNumber: PaymentReference.payment(state.order_number).text,
        amountMinor: state.amount_minor,
        payer,
        application,
        expiresAt: wechatTime(state.expires_at),
      });
      const response = { status: 201, body: { intent: state.intent, parameters } } satisfies OperationResult;
      await this.write(request, async (_context, database) => {
        await database.query(
          `with saved as (insert into payment.action(id,intent_id,attempt_id,kind,state,parameters,provider_request_id,expires_at,created_at,version)
        values($6,$1,$4,'wechat','active',$2::jsonb,$3,$7,clock_timestamp(),0)
        on conflict(intent_id,attempt_id) do update set parameters=excluded.parameters,provider_request_id=excluded.provider_request_id,
          expires_at=excluded.expires_at,version=payment.action.version+1 returning parameters)
        update payment.attempt set state='pending',payer_hash=$5,completed_at=clock_timestamp() where id=$4`,
          [state.intent, JSON.stringify(parameters), parameters.providerRequestId || null, state.attempt!, payerHash, `action:${state.attempt}`, state.expires_at]
        );
        await database.query("update payment.intent set state='pending',version=version+1 where id=$1 and state='preparing'", [state.intent]);
        await new PgRuntimeWriter(database).reschedule({
          id: `job:query:${state.intent}`,
          kind: 'paymentquery',
          owner: 'payment',
          scope: state.scope_id,
          payload: { intent: state.intent },
          priority: 10,
          availableAt: new Date(Date.now() + 5_000).toISOString(),
        });
      });
      return response;
    } catch (cause) {
      if (providerOutcomeUnknown(cause)) {
        const response = { status: 202, body: { intent: state.intent, state: 'reconciling' } } satisfies OperationResult;
        await this.write(request, async (_context, database) => {
          await database.query("update payment.attempt set state='unknown',completed_at=clock_timestamp() where id=$1 and state='started'", [state.attempt!]);
          await new PgRuntimeWriter(database).reschedule({ id: `job:query:${state.intent}`, kind: 'paymentquery', owner: 'payment', scope: state.scope_id, payload: { intent: state.intent }, priority: 1 });
        });
        return response;
      }
      const response = { status: 200, body: { intent: state.intent, state: 'failed' } } satisfies OperationResult;
      await this.write(request, async (context, database) => {
        await database.query("update payment.attempt set state='failed',completed_at=clock_timestamp() where id=$1 and state='started'", [state.attempt!]);
        await database.query("update payment.intent set state='failed',version=version+1 where id=$1 and state in('created','preparing','pending')", [state.intent]);
        await database.query("update payment.action set state='expired',version=version+1 where intent_id=$1 and state='active'", [state.intent]);
        await this.orders.resetPayment(context, state.order_id);
        await this.holds.release(context, state.order_id);
      });
      return response;
    }
  }

  private write<T>(request: OperationRequest, work: (context: WriteTransactionContext, database: SqlExecutor) => Promise<T>): Promise<T> {
    const current = sessionAccess(request.security);
    return this.transactions.write(
      {
        tenant: current?.scope.tenant ?? '',
        membership: current?.membership.id ?? '',
        scope: current?.scope.id ?? 'public:payment',
        actor: current?.actor.id ?? 'provider:wechat',
        trace: current?.trace ?? request.input.headers['request-id'] ?? request.type,
        operation: request.type,
        deadline: request.input.deadline,
        signal: request.input.signal,
      },
      async (context) => work(context, this.access.database(context))
    );
  }
}

function wechatTime(value: string): string {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) throw new Error('PAYMENT_EXPIRY_INVALID');
  return time.toISOString().replace('Z', '+00:00');
}

function providerOutcomeUnknown(cause: unknown): boolean {
  return /(?:NETWORK|TIMEOUT|DEADLINE|TRANSPORT)/.test(transportErrorCode(cause) ?? '');
}
