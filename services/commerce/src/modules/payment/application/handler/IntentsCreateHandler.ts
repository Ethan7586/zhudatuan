import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply, OperationRequest, OperationResult } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { MemberAccessPort } from '../../../access/public';
import type { OrderPaymentPort, PaymentOrderSnapshot } from '../../../order/public';
import type { PaymentContinuation } from '../port/PaymentContinuation';
import type { PaymentGatewayRegistry } from '../service/PaymentGatewayRegistry';
import type { PaymentPort, PaymentScene, PaymentIntentReceipt } from '../../public';

interface LoadedIntent {
  readonly order: PaymentOrderSnapshot;
  readonly member: string;
}

interface PreparedIntent extends LoadedIntent {
  readonly scene: PaymentScene;
}

interface IntentCheckpoint {
  readonly order: string;
  readonly scene: PaymentScene;
  readonly payment: PaymentIntentReceipt;
}

type Reply = OperationReply<OperationOutputFor<'payment.intents.create'>>;

export class IntentsCreateHandler implements DurableOperationHandler<'payment.intents.create', PreparedIntent, IntentCheckpoint, 'write', LoadedIntent> {
  readonly operation = 'payment.intents.create' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly members: Pick<MemberAccessPort, 'member'>,
    private readonly orders: Pick<OrderPaymentPort, 'payment'>,
    private readonly payments: Pick<PaymentPort, 'prepare'>,
    private readonly gateways: Pick<PaymentGatewayRegistry, 'require'>,
    private readonly continuation: PaymentContinuation
  ) {}

  async load(input: OperationInputFor<'payment.intents.create'>, context: HandlerContext<'payment.intents.create'>): Promise<LoadedIntent> {
    const access = requireSession(context.security);
    const orderid = textField(bodyRecord(input), 'order');
    const member = await this.members.member(context.transaction, access.membership.id);
    const order = await this.orders.payment(context.transaction, orderid, member);
    if (!order) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ order, member });
  }

  async prepare(input: OperationInputFor<'payment.intents.create'>, _context: PrepareContext<'payment.intents.create'>, loaded: LoadedIntent): Promise<PreparedIntent> {
    if (!['unpaid', 'authorizing'].includes(loaded.order.paymentState) || loaded.order.lifecycleState === 'cancelled') throw new DomainError('PAYMENT_INTENT_NOT_PAYABLE');
    const scene = sceneField(bodyRecord(input).scene);
    this.gateways.require('prepay', scene).application(scene);
    return Object.freeze({ ...loaded, scene });
  }

  transactionScope(_input: OperationInputFor<'payment.intents.create'>, prepared: PreparedIntent): string {
    return prepared.order.scope;
  }

  async commit(_input: OperationInputFor<'payment.intents.create'>, prepared: PreparedIntent, context: CommitContext<'payment.intents.create'>): Promise<DurableCommit<IntentCheckpoint, OperationOutputFor<'payment.intents.create'>>> {
    const payment = await this.payments.prepare(context.transaction, {
      order: prepared.order.id,
      orderNumber: prepared.order.number,
      scope: prepared.order.scope,
      mall: prepared.order.mall,
      member: prepared.member,
      currency: prepared.order.currency,
      amountMinor: prepared.order.totalMinor,
      idempotency: required(context.idempotencyKey),
      tenders: prepared.order.totalMinor === 0 ? Object.freeze([]) : Object.freeze([{ kind: 'wechat', reference: null, amountMinor: prepared.order.totalMinor }]),
    });
    const checkpoint = Object.freeze({ order: prepared.order.id, scene: prepared.scene, payment });
    return { checkpoint, response: response(202, checkpoint, { state: 'preparing', payment: payment.intent }) };
  }

  async finalize(input: OperationInputFor<'payment.intents.create'>, checkpoint: IntentCheckpoint, context: FinalizeContext<'payment.intents.create'>): Promise<Reply> {
    const result = await this.continuation.continue(request(input, context), { order: checkpoint.order, scene: checkpoint.scene });
    return response(result.status, checkpoint, result.body);
  }
}

function response(status: number, checkpoint: IntentCheckpoint, value: unknown): Reply {
  const body = record(value);
  const state = body.state;
  if (state === 'captured' && typeof body.payment === 'string')
    return { status, body: { intentId: checkpoint.payment.intent, orderId: checkpoint.order, paymentId: body.payment, state, action: null, expiresAt: checkpoint.payment.expiresAt, retryAfter: 0 } };
  if (body.parameters && typeof body.parameters === 'object' && !Array.isArray(body.parameters))
    return {
      status,
      body: { intentId: checkpoint.payment.intent, orderId: checkpoint.order, paymentId: checkpoint.payment.intent, state: 'pending', action: stringRecord(body.parameters), expiresAt: checkpoint.payment.expiresAt, retryAfter: 0 },
    };
  const normalized = state === 'failed' ? 'failed' : state === 'reconciling' ? 'recovery' : 'preparing';
  return {
    status,
    body: { intentId: checkpoint.payment.intent, orderId: checkpoint.order, paymentId: checkpoint.payment.intent, state: normalized, action: null, expiresAt: checkpoint.payment.expiresAt, retryAfter: normalized === 'failed' ? 0 : 5 },
  };
}

function request(input: OperationInputFor<'payment.intents.create'>, context: FinalizeContext<'payment.intents.create'>): OperationRequest {
  return Object.freeze({
    type: context.operation,
    security: context.security,
    input: Object.freeze({
      path: Object.freeze({}),
      query: Object.freeze({}),
      headers: context.headers,
      body: input.body,
      rawBody: context.rawBody,
      deadline: context.deadline,
      signal: context.signal,
      ...(context.idempotencyKey === undefined ? {} : { idempotency: context.idempotencyKey }),
      ...(context.expectedVersion === undefined ? {} : { expectedVersion: context.expectedVersion }),
    }),
  });
}

function sceneField(value: unknown): PaymentScene {
  if (value === 'miniapp' || value === 'jsapi') return value;
  throw new DomainError('VALIDATION_FAILED', { field: 'scene' });
}

function required(value: string | undefined): string {
  if (!value) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED');
  return value;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
  return value as Readonly<Record<string, unknown>>;
}

function stringRecord(value: object): Readonly<Record<string, string>> {
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== 'string')) throw new DomainError('PAYMENT_INTENT_CONFLICT');
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}
