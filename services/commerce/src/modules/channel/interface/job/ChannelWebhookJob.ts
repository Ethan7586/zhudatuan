import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { WebhookInbox } from '../../domain/model/WebhookInbox';

export class ChannelWebhookJobProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'channelwebhook') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const webhook = text(object(job.payload).webhook, 'CHANNEL_WEBHOOK_ID_REQUIRED');
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const selected = await client.query<WebhookRow>(`update channel.webhookinbox set state='processing',attempts=attempts+1
        where id=$1 and state in('received','processing') returning *`, [webhook]);
      const inbox = selected.rows[0];
      if (!inbox) {
        const done = await client.query('select 1 from channel.webhookinbox where id=$1 and state in(\'applied\',\'ignored\')', [webhook]);
        if (done.rows[0]) { await client.query('commit'); return; }
        throw new Error('CHANNEL_WEBHOOK_NOT_RUNNABLE');
      }
      new WebhookInbox(inbox.id, inbox.connection_id, inbox.external_id, inbox.event_type, 'processing', inbox.attempts,
        inbox.raw_hash, inbox.signature_hash);
      const kind = text(inbox.normalized.kind ?? inbox.normalized.resourceType, 'CHANNEL_WEBHOOK_KIND_REQUIRED').toLowerCase();
      const state = providerState(text(inbox.normalized.state, 'CHANNEL_WEBHOOK_STATE_REQUIRED'));
      const operation = inbox.external_reference === null ? undefined : (await client.query<{ id: string; internal_reference: string }>(`update
        channel.provideroperation set state=$3,response=coalesce(response,'{}'::jsonb)||$4::jsonb,updated_at=clock_timestamp()
        where provider=$1 and external_reference=$2 returning id,internal_reference`,
      [inbox.provider, inbox.external_reference, state, JSON.stringify({ webhook: inbox.id, state: inbox.normalized.state })])).rows[0];
      if (['order','shipment','tracking','delivery'].includes(kind) && operation) {
        await client.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,'tracking','fulfillment',$2,jsonb_build_object('fulfillment',$3),'queued',5,clock_timestamp(),clock_timestamp(),clock_timestamp())
          on conflict(id) do nothing`, [`job:tracking:webhook:${inbox.id}`, inbox.scope_id, operation.internal_reference]);
      }
      const event = kind === 'refund' ? 'channel.refund.changed' : 'channel.webhook.applied';
      await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
        occurred_at,available_at) values($1,$2,1,'webhook',$3,$4,jsonb_build_object('webhook',$3,'provider',$5,'kind',$6,
        'reference',$7,'operation',$8,'internalReference',$9,'state',$10),$11,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [`event:channel:webhook:${inbox.id}`, event, inbox.id, inbox.scope_id, inbox.provider, kind, inbox.external_reference,
        operation?.id ?? null, operation?.internal_reference ?? null, state, inbox.trace_id]);
      await client.query(`update channel.webhookinbox set state=case when $2::boolean then 'applied' else 'ignored' end,
        processed_at=clock_timestamp(),error_code=null where id=$1`, [inbox.id, operation !== undefined]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

interface WebhookRow { readonly id: string; readonly connection_id: string; readonly provider: string; readonly scope_id: string;
  readonly external_id: string; readonly event_type: string; readonly external_reference: string | null; readonly attempts: number;
  readonly raw_hash: string; readonly signature_hash: string; readonly normalized: Readonly<Record<string, unknown>>; readonly trace_id: string }
function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(code); return value.trim(); }
function providerState(value: string): 'processing' | 'succeeded' | 'failed' | 'unknown' {
  const state = value.toLowerCase();
  if (['accepted','submitted','processing','pending'].includes(state)) return 'processing';
  if (['succeeded','success','completed','delivered','refunded'].includes(state)) return 'succeeded';
  if (['failed','cancelled','rejected'].includes(state)) return 'failed';
  return 'unknown';
}
