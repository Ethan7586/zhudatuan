import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { WebhookInbox } from '../../domain/model/WebhookInbox';

export class ChannelWebhookJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly extensions: ExtensionRegistry,
    private readonly kms: KmsClient
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'channelwebhook') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const webhook = text(object(job.payload).webhook, 'CHANNEL_WEBHOOK_ID_REQUIRED');
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const selected = await client.query<WebhookRow>(
        `update channel.webhookinbox set state='processing',attempts=attempts+1
        where id=$1 and state in('received','processing') returning *`,
        [webhook]
      );
      const inbox = selected.rows[0];
      if (!inbox) {
        const done = await client.query("select 1 from channel.webhookinbox where id=$1 and state in('applied','ignored')", [webhook]);
        if (done.rows[0]) {
          await client.query('commit');
          return;
        }
        throw new Error('CHANNEL_WEBHOOK_NOT_RUNNABLE');
      }
      const request = envelope(
        await this.kms.decrypt('evidence', 'channel/webhook', inbox.raw_ciphertext, {
          connection: inbox.connection_id,
          provider: inbox.provider,
          scope: inbox.scope_id,
          external: inbox.external_id,
        })
      );
      const port = this.extensions.require(inbox.provider, inbox.scope_id, 'Webhook', 'webhook');
      if (!(await port.verify({ tenantId: inbox.scope_id, requestId: inbox.external_id, traceId: inbox.trace_id, idempotencyKey: inbox.external_id, deadline: Date.now() + 15_000 }, request))) {
        throw new Error('PROVIDER_WEBHOOK_SIGNATURE_INVALID');
      }
      const normalized = port.normalize(request);
      const eventType = text(normalized.eventType ?? normalized.type, 'CHANNEL_WEBHOOK_EVENT_TYPE_REQUIRED');
      const reference = optional(normalized.externalReference ?? normalized.reference);
      await client.query(
        `update channel.webhookinbox set event_type=$2,external_reference=$3,normalized=$4::jsonb
        where id=$1 and state='processing'`,
        [inbox.id, eventType, reference, JSON.stringify(normalized)]
      );
      new WebhookInbox(inbox.id, inbox.connection_id, inbox.external_id, eventType, 'processing', inbox.attempts, inbox.raw_hash, inbox.signature_hash);
      const kind = text(normalized.kind ?? normalized.resourceType, 'CHANNEL_WEBHOOK_KIND_REQUIRED').toLowerCase();
      const state = providerState(text(normalized.state, 'CHANNEL_WEBHOOK_STATE_REQUIRED'));
      const operation =
        reference === null
          ? undefined
          : (
              await client.query<{ id: string; internal_reference: string }>(
                `update channel.provideroperation set state=$3,response=coalesce(response,'{}'::jsonb)||$4::jsonb,updated_at=clock_timestamp()
          where provider=$1 and external_reference=$2 returning id,internal_reference`,
                [inbox.provider, reference, state, JSON.stringify({ webhook: inbox.id, state: normalized.state })]
              )
            ).rows[0];
      if (['order', 'shipment', 'tracking', 'delivery'].includes(kind) && operation) {
        await client.query(
          `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,'tracking','fulfillment',$2,jsonb_build_object('fulfillment',$3),'queued',5,clock_timestamp(),clock_timestamp(),clock_timestamp())
          on conflict(id) do nothing`,
          [`job:tracking:webhook:${inbox.id}`, inbox.scope_id, operation.internal_reference]
        );
      }
      const event = kind === 'refund' ? 'channel.refund.changed' : 'channel.webhook.applied';
      await client.query(
        `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
        occurred_at,available_at) values($1,$2,1,'webhook',$3,$4,jsonb_build_object('webhook',$3,'provider',$5,'kind',$6,
        'reference',$7,'operation',$8,'internalReference',$9,'state',$10),$11,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
        [`event:channel:webhook:${inbox.id}`, event, inbox.id, inbox.scope_id, inbox.provider, kind, reference, operation?.id ?? null, operation?.internal_reference ?? null, state, inbox.trace_id]
      );
      await client.query(
        `update channel.webhookinbox set state=case when $2::boolean then 'applied' else 'ignored' end,
        processed_at=clock_timestamp(),error_code=null where id=$1`,
        [inbox.id, operation !== undefined]
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}

interface WebhookRow {
  readonly id: string;
  readonly connection_id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly external_id: string;
  readonly attempts: number;
  readonly raw_ciphertext: string;
  readonly raw_hash: string;
  readonly signature_hash: string;
  readonly trace_id: string;
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
  if (!source.headers || typeof source.headers !== 'object' || Array.isArray(source.headers) || typeof source.body !== 'string' || typeof source.receivedAt !== 'string') throw new Error('CHANNEL_WEBHOOK_ENVELOPE_INVALID');
  const headers = source.headers as Readonly<Record<string, unknown>>;
  if (!Object.values(headers).every((value) => typeof value === 'string')) throw new Error('CHANNEL_WEBHOOK_ENVELOPE_INVALID');
  return Object.freeze({ headers: headers as Readonly<Record<string, string>>, body: source.body, receivedAt: source.receivedAt });
}
function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
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
