import { createHash } from 'node:crypto';
import type { JsonObject } from '@shop/contract';
import type { ExtensionRegistry } from '../../../../composition/ExtensionRegistry';
import type { DeadletterStore } from '../../../../pipeline/DeadletterStore';
import type { KmsClient } from '../../../../pipeline/KmsPort';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import { terminalChannelFailure } from '../../domain/model/Failure';
import type { ChannelWebhookEventPort } from '../port/ChannelWebhookEventPort';
import type { ChannelWebhookReceipt, ChannelWebhookRepository, StandardChannelWebhook } from '../port/ChannelWebhookRepository';

export interface ChannelWebhookExecution {
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class ApplyChannelWebhook {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ChannelWebhookRepository,
    private readonly events: ChannelWebhookEventPort,
    private readonly deadletters: DeadletterStore,
    private readonly extensions: ExtensionRegistry,
    private readonly kms: KmsClient
  ) {}

  async execute(id: string, execution: ChannelWebhookExecution): Promise<void> {
    assertExecution(execution);
    const receipt = await this.transactions.write(this.options(execution, 'claim'), (context) => this.repository.claim(context, id, execution.scope));
    if (!receipt) return;
    if (receipt.scope !== execution.scope) throw new Error('CHANNEL_WEBHOOK_SCOPE_MISMATCH');
    const request = envelope(
      await this.kms.decrypt('evidence', 'channel/webhook', receipt.ciphertext, {
        connection: receipt.connection,
        provider: receipt.provider,
        scope: receipt.scope,
        external: receipt.external,
      })
    );
    assertExecution(execution);
    const port = this.extensions.strategy(receipt.provider, receipt.scope, 'Webhook');
    const providerContext = {
      tenantId: receipt.scope,
      requestId: receipt.external,
      traceId: receipt.trace,
      idempotencyKey: receipt.external,
      deadline: execution.deadline,
      signal: execution.signal,
    };
    if (!(await port.verify(providerContext, request))) throw new Error('PROVIDER_WEBHOOK_SIGNATURE_INVALID');
    assertExecution(execution);
    const webhook = standardize(port.normalize(request));
    await this.transactions.write(this.options(execution, 'apply'), async (context) => {
      const outcome = await this.repository.apply(context, receipt, webhook);
      if (outcome.status === 'applied') await this.events.publish(context, outcome.event, receipt.trace);
      if (outcome.status === 'deadlettered') await this.deadletters.record(context, deadletter(receipt, webhook, outcome.error));
    });
  }

  fail(context: WriteTransactionContext, receipt: string, scope: string, cause: unknown): Promise<void> {
    return this.repository.fail(context, receipt, scope, terminalChannelFailure(cause, 'CHANNEL_WEBHOOK_FAILED'));
  }

  private options(execution: ChannelWebhookExecution, action: string): TransactionOptions {
    return {
      tenant: execution.scope,
      membership: 'system',
      scope: execution.scope,
      actor: 'system',
      trace: execution.trace,
      operation: `job.channel.webhook.${action}`,
      workload: 'jobs',
      signal: execution.signal,
      deadline: execution.deadline,
    };
  }
}

function standardize(value: JsonObject): StandardChannelWebhook {
  const eventType = text(value.eventType ?? value.type, 'CHANNEL_WEBHOOK_EVENT_TYPE_REQUIRED', 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(eventType)) throw new Error('CHANNEL_WEBHOOK_EVENT_TYPE_INVALID');
  const reference = optional(value.externalReference ?? value.reference, 255);
  const kind = text(value.kind ?? value.resourceType, 'CHANNEL_WEBHOOK_KIND_REQUIRED', 64).toLowerCase();
  if (!/^[a-z][a-z0-9]*$/.test(kind)) throw new Error('CHANNEL_WEBHOOK_KIND_INVALID');
  const state = providerState(text(value.state, 'CHANNEL_WEBHOOK_STATE_REQUIRED', 64));
  const normalized: JsonObject = Object.freeze({ eventType, reference, kind, state });
  return Object.freeze({ eventType, reference, kind, state, normalized });
}

function envelope(value: string): Readonly<{ headers: Readonly<Record<string, string>>; body: string; receivedAt: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('CHANNEL_WEBHOOK_ENVELOPE_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('CHANNEL_WEBHOOK_ENVELOPE_INVALID');
  const source = parsed as Readonly<Record<string, unknown>>;
  if (!source.headers || typeof source.headers !== 'object' || Array.isArray(source.headers) || typeof source.body !== 'string' || typeof source.receivedAt !== 'string' || Number.isNaN(Date.parse(source.receivedAt)))
    throw new Error('CHANNEL_WEBHOOK_ENVELOPE_INVALID');
  const headers = source.headers as Readonly<Record<string, unknown>>;
  if (Object.keys(headers).length > 128 || !Object.entries(headers).every(([key, item]) => key.length <= 128 && typeof item === 'string' && item.length <= 8192)) {
    throw new Error('CHANNEL_WEBHOOK_ENVELOPE_INVALID');
  }
  return Object.freeze({ headers: headers as Readonly<Record<string, string>>, body: source.body, receivedAt: source.receivedAt });
}

function deadletter(receipt: ChannelWebhookReceipt, webhook: StandardChannelWebhook, error: string) {
  return Object.freeze({
    id: `provider:${receipt.id}`,
    kind: 'provider',
    source: receipt.id,
    owner: 'channel',
    payload: Object.freeze({
      receipt: receipt.id,
      provider: receipt.provider,
      eventType: webhook.eventType,
      kind: webhook.kind,
      state: webhook.state,
      rawHash: receipt.rawHash,
      signatureHash: receipt.signatureHash,
      externalHash: digest(receipt.external),
      referenceHash: webhook.reference === null ? null : digest(webhook.reference),
    }),
    error,
    attempts: receipt.attempts,
  });
}

function assertExecution(execution: ChannelWebhookExecution): void {
  if (execution.signal.aborted) throw execution.signal.reason ?? new Error('CHANNEL_WEBHOOK_CANCELLED');
  if (Date.now() >= execution.deadline) throw new Error('CHANNEL_WEBHOOK_DEADLINE_EXCEEDED');
}

function text(value: unknown, code: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) throw new Error(code);
  return value.trim();
}

function optional(value: unknown, maximum: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return text(value, 'CHANNEL_WEBHOOK_REFERENCE_INVALID', maximum);
}

function providerState(value: string): StandardChannelWebhook['state'] {
  const state = value.toLowerCase();
  if (['accepted', 'submitted', 'processing', 'pending'].includes(state)) return 'processing';
  if (['succeeded', 'success', 'completed', 'delivered', 'refunded'].includes(state)) return 'succeeded';
  if (['failed', 'cancelled', 'rejected'].includes(state)) return 'failed';
  return 'unknown';
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
