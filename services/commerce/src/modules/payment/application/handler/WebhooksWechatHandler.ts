import { createHash } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { PaymentGateway, PaymentNotification } from '../port/PaymentGateway';
import type { VerifiedPaymentWebhook, WebhookInboxRepository } from '../port/WebhookInboxRepository';
import type { WebhookScopeReader } from '../port/WebhookScopeReader';

interface PreparedWebhook {
  readonly notification: VerifiedPaymentWebhook;
  readonly raw: string;
  readonly rawHash: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly trace: string;
  readonly scope: string;
}

export class WebhooksWechatHandler implements DurableOperationHandler<'payment.webhooks.wechat', PreparedWebhook, Readonly<{ replayed: boolean }>, 'write'> {
  readonly operation = 'payment.webhooks.wechat' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly gateway: PaymentGateway,
    private readonly scopes: WebhookScopeReader,
    private readonly webhooks: WebhookInboxRepository
  ) {}

  async prepare(_input: OperationInputFor<'payment.webhooks.wechat'>, context: PrepareContext<'payment.webhooks.wechat'>): Promise<PreparedWebhook> {
    if (!context.rawBody) throw new Error('WECHAT_PAY_NOTIFICATION_BODY_MISSING');
    const notification = verified(await this.gateway.verifyNotification(context.headers, context.rawBody,
      { requestId: context.requestId, traceId: context.traceId, signal: context.signal, deadline: context.deadline }));
    return Object.freeze({
      notification,
      raw: context.rawBody,
      rawHash: createHash('sha256').update(context.rawBody).digest('hex'),
      headers: providerHeaders(context.headers),
      trace: context.headers['request-id'] ?? `wechat:${notification.id}`,
      scope: await this.scopes.resolve(notification, context.signal, context.deadline),
    });
  }

  transactionScope(_input: OperationInputFor<'payment.webhooks.wechat'>, prepared: PreparedWebhook): string {
    return prepared.scope;
  }

  async commit(
    _input: OperationInputFor<'payment.webhooks.wechat'>,
    prepared: PreparedWebhook,
    context: CommitContext<'payment.webhooks.wechat'>
  ): Promise<DurableCommit<Readonly<{ replayed: boolean }>, OperationOutputFor<'payment.webhooks.wechat'>>> {
    const checkpoint = await this.webhooks.accept(context.transaction, prepared);
    return { checkpoint, response: { status: 204, body: {} } };
  }

  async finalize(
    _input: OperationInputFor<'payment.webhooks.wechat'>,
    _checkpoint: Readonly<{ replayed: boolean }>,
    _context: FinalizeContext<'payment.webhooks.wechat'>
  ): Promise<OperationReply<OperationOutputFor<'payment.webhooks.wechat'>>> {
    return { status: 204, body: {} };
  }
}

function verified(notification: PaymentNotification): VerifiedPaymentWebhook {
  return notification;
}

function providerHeaders(headers: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(['wechatpay-serial', 'wechatpay-timestamp', 'wechatpay-nonce', 'request-id'].flatMap((name) => (headers[name] ? [[name, headers[name]!]] : []))));
}
