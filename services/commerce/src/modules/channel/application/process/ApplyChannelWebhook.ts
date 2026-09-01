import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { ChannelWebhookRepository } from '../port/ChannelJobRepository';

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
    private readonly extensions: ExtensionRegistry,
    private readonly kms: KmsClient
  ) {}

  async execute(webhook: string, execution: ChannelWebhookExecution): Promise<void> {
    const options = this.options(execution);
    const inbox = await this.transactions.write(options, (context) => this.repository.claim(context, webhook));
    if (!inbox) return;
    const request = envelope(
      await this.kms.decrypt('evidence', 'channel/webhook', inbox.ciphertext, {
        connection: inbox.connection,
        provider: inbox.provider,
        scope: inbox.scope,
        external: inbox.external,
      })
    );
    const port = this.extensions.require(inbox.provider, inbox.scope, 'Webhook', 'webhook');
    const providerContext = {
      tenantId: inbox.scope,
      requestId: inbox.external,
      traceId: inbox.trace,
      idempotencyKey: inbox.external,
      deadline: execution.deadline,
    };
    if (!(await port.verify(providerContext, request))) throw new Error('PROVIDER_WEBHOOK_SIGNATURE_INVALID');
    const normalized = port.normalize(request);
    const eventType = text(normalized.eventType ?? normalized.type, 'CHANNEL_WEBHOOK_EVENT_TYPE_REQUIRED');
    const reference = optional(normalized.externalReference ?? normalized.reference);
    const kind = text(normalized.kind ?? normalized.resourceType, 'CHANNEL_WEBHOOK_KIND_REQUIRED').toLowerCase();
    const state = providerState(text(normalized.state, 'CHANNEL_WEBHOOK_STATE_REQUIRED'));
    await this.transactions.write(options, (context) => this.repository.apply(context, inbox, normalized, eventType, reference, kind, state));
  }

  private options(execution: ChannelWebhookExecution): TransactionOptions {
    return {
      tenant: execution.scope,
      membership: '',
      scope: execution.scope,
      actor: 'job:channelwebhook',
      trace: execution.trace,
      operation: 'job.channel.webhook',
      workload: 'jobs',
      signal: execution.signal,
      deadline: execution.deadline,
    };
  }
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
  if (!source.headers || typeof source.headers !== 'object' || Array.isArray(source.headers) || typeof source.body !== 'string' || typeof source.receivedAt !== 'string') {
    throw new Error('CHANNEL_WEBHOOK_ENVELOPE_INVALID');
  }
  const headers = source.headers as Readonly<Record<string, unknown>>;
  if (!Object.values(headers).every((value) => typeof value === 'string')) throw new Error('CHANNEL_WEBHOOK_ENVELOPE_INVALID');
  return Object.freeze({ headers: headers as Readonly<Record<string, string>>, body: source.body, receivedAt: source.receivedAt });
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function optional(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function providerState(value: string): 'processing' | 'succeeded' | 'failed' | 'unknown' {
  const state = value.toLowerCase();
  if (['accepted', 'submitted', 'processing', 'pending'].includes(state)) return 'processing';
  if (['succeeded', 'success', 'completed', 'delivered', 'refunded'].includes(state)) return 'succeeded';
  if (['failed', 'cancelled', 'rejected'].includes(state)) return 'failed';
  return 'unknown';
}
