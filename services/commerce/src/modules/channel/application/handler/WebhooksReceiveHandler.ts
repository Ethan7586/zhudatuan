import { createHash } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableCommit, DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { CipherEnvelope, KmsClient } from '../../../../foundation/application/KmsPort';
import type { WebhookConnection, WebhookRepository } from '../port/WebhookRepository';

interface PreparedWebhook {
  readonly connection: string;
  readonly external: string;
  readonly envelope: CipherEnvelope;
  readonly rawHash: string;
  readonly signatureHash: string;
  readonly receivedAt: string;
  readonly trace: string;
  readonly scope: string;
}

export class WebhooksReceiveHandler implements DurableOperationHandler<'channel.webhooks.receive', PreparedWebhook, Readonly<{ id: string; state: string; replayed: boolean }>, 'write', WebhookConnection> {
  readonly operation = 'channel.webhooks.receive' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly webhooks: WebhookRepository,
    private readonly kms: KmsClient
  ) {}

  load(input: OperationInputFor<'channel.webhooks.receive'>, context: HandlerContext<'channel.webhooks.receive'>): Promise<WebhookConnection> {
    return this.webhooks.connection(context.transaction, required(input.path.connectionid, 'CHANNEL_WEBHOOK_CONNECTION_REQUIRED'));
  }

  async prepare(input: OperationInputFor<'channel.webhooks.receive'>, context: PrepareContext<'channel.webhooks.receive'>, connection: WebhookConnection): Promise<PreparedWebhook> {
    if (connection.status !== 'enabled') throw new Error('CHANNEL_WEBHOOK_CONNECTION_UNAVAILABLE');
    const declaredLength = Number(context.headers['content-length'] ?? 0);
    if ((Number.isFinite(declaredLength) && declaredLength > 1024 * 1024) || Buffer.byteLength(context.rawBody) > 1024 * 1024) throw new Error('CHANNEL_WEBHOOK_BODY_TOO_LARGE');
    const id = required(input.path.connectionid, 'CHANNEL_WEBHOOK_CONNECTION_REQUIRED');
    const external = required(context.headers['x-provider-event-id'], 'CHANNEL_WEBHOOK_EVENT_ID_REQUIRED', 255);
    const receivedAt = new Date().toISOString();
    const headers = providerHeaders(context.headers);
    const request = JSON.stringify({ headers, body: context.rawBody, receivedAt });
    const envelope = await this.kms.encrypt('evidence', 'channel/webhook', request, { connection: id, provider: connection.provider, scope: connection.scope, external });
    return Object.freeze({ connection: id, external, envelope, rawHash: digest(context.rawBody), signatureHash: digest(context.headers['x-provider-signature'] ?? ''), receivedAt, trace: context.traceId, scope: connection.scope });
  }

  transactionScope(_input: OperationInputFor<'channel.webhooks.receive'>, prepared: PreparedWebhook): string { return prepared.scope; }

  async commit(
    _input: OperationInputFor<'channel.webhooks.receive'>,
    prepared: PreparedWebhook,
    context: CommitContext<'channel.webhooks.receive'>
  ): Promise<DurableCommit<Readonly<{ id: string; state: string; replayed: boolean }>, OperationOutputFor<'channel.webhooks.receive'>>> {
    const accepted = await this.webhooks.accept(context.transaction, {
      connection: prepared.connection,
      external: prepared.external,
      ciphertext: prepared.envelope.ciphertext,
      keyVersion: prepared.envelope.keyVersion,
      rawHash: prepared.rawHash,
      signatureHash: prepared.signatureHash,
      receivedAt: prepared.receivedAt,
      trace: prepared.trace,
    });
    return { checkpoint: accepted, response: { status: accepted.replayed ? 200 : 202, body: { webhook: accepted.id, state: accepted.state, replayed: accepted.replayed } as OperationOutputFor<'channel.webhooks.receive'> } };
  }

  async finalize(
    _input: OperationInputFor<'channel.webhooks.receive'>,
    checkpoint: Readonly<{ id: string; state: string; replayed: boolean }>,
    _context: FinalizeContext<'channel.webhooks.receive'>
  ): Promise<OperationReply<OperationOutputFor<'channel.webhooks.receive'>>> {
    return { status: checkpoint.replayed ? 200 : 202, body: { webhook: checkpoint.id, state: checkpoint.state, replayed: checkpoint.replayed } as OperationOutputFor<'channel.webhooks.receive'> };
  }
}

function required(value: string | null | undefined, code: string, maximum = 255): string {
  if (!value?.trim() || value.trim().length > maximum) throw new Error(code);
  return value.trim();
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function providerHeaders(headers: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const entries = Object.entries(headers);
  if (entries.length > 128 || entries.some(([key, value]) => key.length > 128 || value.length > 8192)) throw new Error('CHANNEL_WEBHOOK_HEADERS_TOO_LARGE');
  return Object.freeze(Object.fromEntries(entries));
}
