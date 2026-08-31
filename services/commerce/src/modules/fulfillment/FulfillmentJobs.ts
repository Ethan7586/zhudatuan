import { createHash, randomUUID } from 'node:crypto';
import type { JsonObject, ProviderCallContext } from '@shop/contract';
import type { ExtensionRegistry } from '../../bootstrap/ExtensionRegistry';
import type { ClaimedJob, JobProcessor } from '../../foundation/application/JobRunner';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { SecretStore } from '../../foundation/infrastructure/SecretStore';
import type { ProviderOperationPort } from '../channel/public/index';
import type { FulfillmentOrderPort } from '../order/public/index';
import type { OrganizationReadPort } from '../organization/public';
import { FulfillmentState } from './domain/model/FulfillmentState';

interface FulfillmentRow {
  readonly id: string;
  readonly order_id: string;
  readonly provider: string | null;
  readonly scope_id: string;
  readonly member_id: string;
  readonly state: string;
  readonly version: number;
  readonly external_reference: string | null;
  readonly lines: JsonObject[];
}

export interface FulfillmentJobDependencies {
  readonly operations: Pick<ProviderOperationPort, 'record' | 'replayReference'>;
  readonly orders: FulfillmentOrderPort;
  readonly organizations: OrganizationReadPort;
}

export class FulfillmentJobProcessor implements JobProcessor {
  constructor(
    private readonly pool: DatabasePool,
    private readonly extensions: ExtensionRegistry,
    private readonly secrets: SecretStore,
    private readonly kind: 'fulfillment' | 'tracking',
    private readonly dependencies: FulfillmentJobDependencies
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (this.kind === 'fulfillment' && payload.aftersale) return this.authorizeReturn(job, text(payload.aftersale, 'AFTERSALE_REQUIRED'));
    const fulfillment = payload.fulfillment ? text(payload.fulfillment, 'FULFILLMENT_ID_REQUIRED') : await this.replay(text(payload.operation, 'PROVIDER_OPERATION_REQUIRED'));
    if (this.kind === 'fulfillment') return this.submit(job, fulfillment);
    return this.track(job, fulfillment);
  }

  private async authorizeReturn(job: ClaimedJob, aftersale: string): Promise<void> {
    const request = await this.dependencies.orders.returnRequest(this.pool, aftersale);
    if (!request || request.state === 'returning') return;
    if (request.state !== 'approved' || !request.requiresReturn || request.lines.length === 0) throw new Error('AFTERSALE_RETURN_NOT_RUNNABLE');
    const mapped = await this.pool.query<{ fulfillment: string; provider: string | null; line: string; quantity: number }>(
      `select fulfillment.id fulfillment,fulfillment.provider,line.order_line_id line,
      least(line.quantity,requested.quantity)::float8 quantity from fulfillment.fulfillmentorder fulfillment
      join fulfillment.line line on line.fulfillment_id=fulfillment.id
      join jsonb_to_recordset($1::jsonb) requested(line text,quantity bigint) on requested.line=line.order_line_id
      where fulfillment.order_id=$2 and fulfillment.state='completed' order by fulfillment.id,line.order_line_id`,
      [JSON.stringify(request.lines), request.order]
    );
    if (new Set(mapped.rows.map(({ line }) => line)).size !== request.lines.length) throw new Error('AFTERSALE_FULFILLMENT_LINE_MISSING');
    const grouped = new Map<string, { provider: string | null; lines: { line: string; quantity: number }[] }>();
    for (const row of mapped.rows) {
      const current = grouped.get(row.fulfillment) ?? { provider: row.provider, lines: [] };
      current.lines.push({ line: row.line, quantity: row.quantity });
      grouped.set(row.fulfillment, current);
    }
    const planned = [];
    for (const [fulfillment, group] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
      const id = `return:${aftersale}:${fulfillment}`;
      const source = request.lines.find(({ line }) => group.lines.some((candidate) => candidate.line === line));
      const configured = source?.policy.returnInstruction;
      let providerReference: string | null = null;
      let instruction: JsonObject;
      let providerResponse: unknown = null;
      let requestHash: string | null = null;
      if (group.provider) {
        await this.ensure(group.provider, request.scope);
        const providerRequest = Object.freeze({
          reference: id,
          fulfillmentReference: fulfillment,
          reason: request.reason,
          lines: Object.freeze(group.lines.map(({ line, quantity }) => Object.freeze({ reference: line, quantity }))),
          evidence: Object.freeze({ aftersale, ...(configured && typeof configured === 'object' && !Array.isArray(configured) ? { policy: configured as JsonObject } : {}) }),
        });
        const response = await this.extensions.require(group.provider, request.scope, 'Return', 'return').authorize(await this.context(job, request.scope, id), providerRequest);
        if (!success(response.state) && response.state.toLowerCase() !== 'authorized') throw new Error('PROVIDER_RETURN_NOT_AUTHORIZED');
        if (!['address', 'labelUrl', 'message', 'method'].some((key) => typeof response.instruction[key] === 'string' && response.instruction[key].trim())) {
          throw new Error('PROVIDER_RETURN_INSTRUCTION_INVALID');
        }
        providerReference = response.externalReference;
        instruction = response.instruction;
        providerResponse = response;
        requestHash = digest(JSON.stringify(providerRequest));
      } else {
        instruction = configured && typeof configured === 'object' && !Array.isArray(configured) ? (configured as JsonObject) : { state: 'authorized', method: 'internal' };
      }
      planned.push(Object.freeze({ id, fulfillment, group, providerReference, instruction, providerResponse, requestHash }));
    }
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const returns: Array<Readonly<{ id: string; state: string; provider: string | null; providerReference: string | null; trackingNumber: null; instruction: JsonObject }>> = [];
      for (const plan of planned) {
        const { id, fulfillment, group, providerReference, instruction, providerResponse, requestHash } = plan;
        await client.query(
          `insert into fulfillment.returnrecord(id,aftersale_id,fulfillment_id,scope_id,state,provider,provider_reference,instruction,created_at,updated_at,version)
          values($1,$2,$3,$4,'authorized',$5,$6,$7::jsonb,clock_timestamp(),clock_timestamp(),0)
          on conflict(aftersale_id,fulfillment_id) do nothing`,
          [id, aftersale, fulfillment, request.scope, group.provider, providerReference, JSON.stringify(instruction)]
        );
        for (const line of group.lines) await client.query(`insert into fulfillment.returnline(return_id,order_line_id,quantity) values($1,$2,$3) on conflict do nothing`, [id, line.line, line.quantity]);
        if (group.provider && providerResponse && requestHash)
          await this.dependencies.operations.record(client, {
            id: `provideroperation:${digest(id)}`,
            provider: group.provider,
            scope: request.scope,
            kind: 'return',
            idempotency: id,
            reference: id,
            external: providerReference,
            state: 'succeeded',
            requestHash,
            response: providerResponse,
          });
        returns.push(Object.freeze({ id, state: 'authorized', provider: group.provider, providerReference, trackingNumber: null, instruction }));
      }
      await this.dependencies.orders.markReturning(client, aftersale, returns, job.id);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async submit(job: ClaimedJob, id: string): Promise<void> {
    const loaded = await this.load(id, ['pending', 'failed']);
    const accepted = FulfillmentState.from(loaded.state).transition('submit');
    if (loaded.provider === null) {
      const result = await this.pool.query(
        `update fulfillment.fulfillmentorder set state=$2,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state=$3 returning id`,
        [id, accepted, loaded.state]
      );
      if (!result.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
      return;
    }
    await this.ensure(loaded.provider, loaded.scope_id);
    const context = await this.context(job, loaded.scope_id, `fulfillment:${id}`);
    const draft = { reference: id, payload: { order: loaded.order_id, lines: loaded.lines } as JsonObject };
    const receipt = await this.extensions.require(loaded.provider, loaded.scope_id, 'Order', 'order').submit(context, draft);
    const serialized = JSON.stringify(draft.payload);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const changed = await client.query(
        `update fulfillment.fulfillmentorder set state=$3,external_reference=$2,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state=$4 and version=$5 returning id`,
        [id, receipt.externalReference, accepted, loaded.state, loaded.version]
      );
      if (!changed.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
      await this.dependencies.operations.record(client, {
        id: `provideroperation:${randomUUID()}`,
        provider: loaded.provider,
        scope: loaded.scope_id,
        kind: 'order',
        idempotency: id,
        reference: id,
        external: receipt.externalReference,
        state: success(receipt.state) ? 'succeeded' : 'processing',
        requestHash: digest(serialized),
        response: receipt,
      });
      await enqueue(client, 'tracking', loaded.scope_id, { fulfillment: id }, 60);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async track(job: ClaimedJob, id: string): Promise<void> {
    const loaded = await this.load(id, ['accepted', 'processing', 'ready']);
    if (!loaded.provider || !loaded.external_reference) return;
    await this.ensure(loaded.provider, loaded.scope_id);
    const snapshot = await this.extensions.require(loaded.provider, loaded.scope_id, 'Logistics', 'tracking').pullTracking(await this.context(job, loaded.scope_id), loaded.external_reference);
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
        await client.query(
          `insert into fulfillment.milestone(id,fulfillment_id,kind,state,external_id,evidence,occurred_at)
          values($1,$2,$3,$4,$5,$6::jsonb,$7) on conflict(fulfillment_id,kind,external_id) do nothing`,
          [`milestone:${digest(`${id}:${kind}:${external}`)}`, id, kind, state, external, JSON.stringify(value), occurred]
        );
      }
      const next = FulfillmentState.from(loaded.state).transition(completed ? 'complete' : 'progress');
      const changed = await client.query(
        `update fulfillment.fulfillmentorder set state=$2,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state=$3 and version=$4 returning id`,
        [id, next, loaded.state, loaded.version]
      );
      if (!changed.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
      if (shipped)
        await client.query(
          `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'fulfillment.shipped',1,'fulfillment',$2,$3,jsonb_build_object('fulfillment',$2,'order',$4,'member',$5,'state',$6),$7,clock_timestamp(),clock_timestamp())
        on conflict(id) do nothing`,
          [`event:fulfillment:shipped:${digest(id)}`, id, loaded.scope_id, loaded.order_id, loaded.member_id, completed ? 'delivered' : 'shipped', job.id]
        );
      if (completed)
        await this.dependencies.orders.completeFulfillment(
          client,
          loaded.order_id,
          loaded.lines.map((line) => ({ line: String(line.line), quantity: Number(line.quantity) }))
        );
      else await enqueue(client, 'tracking', loaded.scope_id, { fulfillment: id }, 300);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async load(id: string, states: readonly string[]): Promise<FulfillmentRow> {
    const result = await this.pool.query<Omit<FulfillmentRow, 'scope_id' | 'member_id'>>(
      `select fulfillment.id,fulfillment.order_id,fulfillment.provider,fulfillment.state,fulfillment.version::float8 version,
      fulfillment.external_reference,coalesce(jsonb_agg(jsonb_build_object('line',line.order_line_id,'quantity',line.quantity)
      order by line.order_line_id) filter(where line.order_line_id is not null),'[]') lines from fulfillment.fulfillmentorder fulfillment
      left join fulfillment.line line on line.fulfillment_id=fulfillment.id
      where fulfillment.id=$1 and fulfillment.state=any($2::text[]) group by fulfillment.id`,
      [id, states]
    );
    const row = result.rows[0];
    if (!row) throw new Error('FULFILLMENT_NOT_RUNNABLE');
    const order = await this.dependencies.orders.snapshot(this.pool, row.order_id);
    if (!order) throw new Error('FULFILLMENT_ORDER_NOT_FOUND');
    return Object.freeze({ ...row, scope_id: order.scope, member_id: order.member });
  }

  private async replay(operation: string): Promise<string> {
    return this.dependencies.operations.replayReference(this.pool, operation, 'order');
  }

  private async ensure(provider: string, scope: string): Promise<void> {
    if (!this.extensions.has(provider, scope)) throw new Error('PROVIDER_INSTALLATION_NOT_ACTIVE');
  }

  private async context(job: ClaimedJob, scope: string, key?: string): Promise<ProviderCallContext> {
    const organization = await this.dependencies.organizations.scope(this.pool, scope);
    return { tenantId: organization.tenant ?? scope, requestId: job.id, traceId: job.id, ...(key ? { idempotencyKey: key } : {}), deadline: Date.now() + 300_000 };
  }
}

async function enqueue(database: { query(text: string, values?: readonly unknown[]): Promise<unknown> }, kind: string, scope: string, payload: unknown, delay: number) {
  await database.query(
    `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,$2,'fulfillment',$3,$4::jsonb,'queued',20,clock_timestamp()+make_interval(secs=>$5),clock_timestamp(),clock_timestamp())`,
    [`job:${randomUUID()}`, kind, scope, JSON.stringify(payload), delay]
  );
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function success(value: string): boolean {
  return ['accepted', 'submitted', 'succeeded'].includes(value.toLowerCase());
}
