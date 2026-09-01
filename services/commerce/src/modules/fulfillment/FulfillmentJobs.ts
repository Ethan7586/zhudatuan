import { createHash, randomUUID } from 'node:crypto';
import type { JsonObject, ProviderCallContext } from '@shop/contract';
import type { ExtensionRegistry } from '../../bootstrap/ExtensionRegistry';
import type { ClaimedJob, JobProcessor } from '../../foundation/application/JobRunner';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { SecretStore } from '../../foundation/infrastructure/SecretStore';
import { channelOperationPort } from '../channel/ChannelModule';
import { orderPort } from '../order/OrderModule';

interface FulfillmentRow {
  readonly id: string;
  readonly mall_id: string;
  readonly order_id: string;
  readonly provider: string | null;
  readonly provider_scope_id: string;
  readonly member_id: string;
  readonly state: string;
  readonly external_reference: string | null;
  readonly lines: JsonObject[];
}

export class FulfillmentJobProcessor implements JobProcessor {
  constructor(private readonly pool: DatabasePool, private readonly extensions: ExtensionRegistry, private readonly secrets: SecretStore,
    private readonly kind: 'fulfillment' | 'tracking') {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    const fulfillment = payload.fulfillment ? text(payload.fulfillment, 'FULFILLMENT_ID_REQUIRED')
      : await this.replay(text(payload.operation, 'PROVIDER_OPERATION_REQUIRED'));
    const mall = text(job.scope_id, 'FULFILLMENT_JOB_MALL_REQUIRED');
    if (this.kind === 'fulfillment') return this.submit(job, mall, fulfillment);
    return this.track(job, mall, fulfillment);
  }

  private async submit(job: ClaimedJob, mall: string, id: string): Promise<void> {
    const loaded = await this.load(mall, id, ['pending', 'failed']);
    if (loaded.provider === null) {
      await this.pool.query(`update fulfillment.fulfillmentorder set state='accepted',updated_at=clock_timestamp(),version=version+1
        where mall_id=$1 and id=$2 and state='pending'`, [mall, id]);
      return;
    }
    await this.ensure(loaded.provider, loaded.provider_scope_id);
    const context = await this.context(job, loaded.provider_scope_id, `fulfillment:${id}`);
    const draft = { reference: id, payload: { order: loaded.order_id, lines: loaded.lines } as JsonObject };
    const receipt = await this.extensions.require(loaded.provider, loaded.provider_scope_id, 'Order', 'order').submit(context, draft);
    const serialized = JSON.stringify(draft.payload);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(`update fulfillment.fulfillmentorder set state='accepted',external_reference=$2,updated_at=clock_timestamp(),version=version+1
        where mall_id=$1 and id=$3 and state in('pending','failed')`, [mall, receipt.externalReference, id]);
      await channelOperationPort.record(client, { id: `provideroperation:${randomUUID()}`, provider: loaded.provider, scope: loaded.provider_scope_id,
        kind: 'order', idempotency: id, reference: id, external: receipt.externalReference,
        state: success(receipt.state) ? 'succeeded' : 'processing', requestHash: digest(serialized), response: receipt });
      await enqueue(client, 'tracking', loaded.mall_id, { fulfillment: id }, 60);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async track(job: ClaimedJob, mall: string, id: string): Promise<void> {
    const loaded = await this.load(mall, id, ['accepted', 'processing', 'ready']);
    if (!loaded.provider || !loaded.external_reference) return;
    await this.ensure(loaded.provider, loaded.provider_scope_id);
    const snapshot = await this.extensions.require(loaded.provider, loaded.provider_scope_id, 'Logistics', 'tracking')
      .pullTracking(await this.context(job, loaded.provider_scope_id), loaded.external_reference);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      let completed = false;
      let shipped = false;
      for (const value of snapshot.milestones) {
        const kind = text(value.kind, 'TRACKING_KIND_INVALID');
        const state = text(value.state, 'TRACKING_STATE_INVALID');
        const external = typeof value.externalId === 'string' ? value.externalId : digest(JSON.stringify(value));
        const occurred = typeof value.occurredAt === 'string' ? value.occurredAt : new Date().toISOString();
        completed ||= ['delivered', 'completed', 'pickedup'].includes(state.toLowerCase());
        shipped ||= ['shipped', 'intransit', 'outfordelivery', 'delivered', 'completed', 'pickedup'].includes(state.toLowerCase());
        await client.query(`insert into fulfillment.milestone(id,mall_id,fulfillment_id,kind,state,external_id,evidence,occurred_at)
          values($1,$2,$3,$4,$5,$6,$7::jsonb,$8) on conflict(mall_id,fulfillment_id,kind,external_id) do nothing`,
        [`milestone:${digest(`${id}:${kind}:${external}`)}`, loaded.mall_id, id, kind, state, external, JSON.stringify(value), occurred]);
      }
      await client.query(`update fulfillment.fulfillmentorder set state=$3,updated_at=clock_timestamp(),version=version+1
        where mall_id=$1 and id=$2`, [loaded.mall_id, id, completed ? 'completed' : 'processing']);
      if (shipped) await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'fulfillment.shipped',1,'fulfillment',$2,$3,jsonb_build_object('mall',$3,'fulfillment',$2,'order',$4,'member',$5,'state',$6),$7,clock_timestamp(),clock_timestamp())
        on conflict(id) do nothing`, [`event:fulfillment:shipped:${digest(id)}`, id, loaded.mall_id, loaded.order_id, loaded.member_id, completed ? 'delivered' : 'shipped', job.id]);
      if (completed) await orderPort.completeFulfillment(client, loaded.order_id);
      else await enqueue(client, 'tracking', loaded.mall_id, { fulfillment: id }, 300);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async load(mall: string, id: string, states: readonly string[]): Promise<FulfillmentRow> {
    const result = await this.pool.query<FulfillmentRow>(`select fulfillment.id,fulfillment.mall_id,fulfillment.order_id,fulfillment.provider,
      fulfillment.provider_scope_id,fulfillment.member_id,fulfillment.state,
      fulfillment.external_reference,coalesce(jsonb_agg(jsonb_build_object('line',line.order_line_id,'quantity',line.quantity)
      order by line.order_line_id) filter(where line.order_line_id is not null),'[]') lines from fulfillment.fulfillmentorder fulfillment
      left join fulfillment.line line on line.mall_id=fulfillment.mall_id and line.fulfillment_id=fulfillment.id
      where fulfillment.mall_id=$1 and fulfillment.id=$2 and fulfillment.state=any($3::text[]) group by fulfillment.id`, [mall, id, states]);
    if (!result.rows[0]) throw new Error('FULFILLMENT_NOT_RUNNABLE');
    return result.rows[0];
  }

  private async replay(operation: string): Promise<string> {
    return channelOperationPort.replayReference(this.pool, operation, 'order');
  }

  private async ensure(provider: string, scope: string): Promise<void> {
    if (!this.extensions.has(provider, scope)) throw new Error('PROVIDER_INSTALLATION_NOT_ACTIVE');
  }

  private async context(job: ClaimedJob, scope: string, key?: string): Promise<ProviderCallContext> {
    const result = await this.pool.query<{ tenant: string | null }>(`select access.scope_object($1)->>'tenant' tenant`, [scope]);
    return { tenantId: result.rows[0]?.tenant ?? scope, requestId: job.id, traceId: job.id, ...(key ? { idempotencyKey: key } : {}), deadline: Date.now()+300_000 };
  }
}

async function enqueue(database: { query(text: string, values?: readonly unknown[]): Promise<unknown> }, kind: string, scope: string, payload: unknown, delay: number) {
  await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,$2,'fulfillment',$3,$4::jsonb,'queued',20,clock_timestamp()+make_interval(secs=>$5),clock_timestamp(),clock_timestamp())`,
  [`job:${randomUUID()}`, kind, scope, JSON.stringify(payload), delay]);
}

function object(value: unknown): Record<string, unknown> { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID'); return value as Record<string, unknown>; }
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function success(value: string): boolean { return ['accepted', 'submitted', 'succeeded'].includes(value.toLowerCase()); }
