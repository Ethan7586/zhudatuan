import { createHash, randomUUID } from 'node:crypto';
import type { JsonObject, ProviderCallContext } from '@shop/contract';
import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { ProviderOperationPort } from '../../../channel/public/index';
import type { FulfillmentOrderPort } from '../../../order/public/index';
import type { OrganizationReadPort } from '../../../organization/public';
import { FulfillmentState } from '../../domain/model/FulfillmentState';
import { PgRuntimeWriter, type RuntimeSql } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { FulfillmentJobExecution, FulfillmentJobProcess } from '../../application/port/FulfillmentJobProcess';

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

interface ReturnPlan {
  readonly id: string;
  readonly fulfillment: string;
  readonly group: Readonly<{ provider: string | null; lines: readonly Readonly<{ line: string; quantity: number }>[] }>;
  readonly providerReference: string | null;
  readonly instruction: JsonObject;
  readonly providerResponse: unknown;
  readonly requestHash: string | null;
}

export interface FulfillmentJobDependencies {
  readonly operations: Pick<ProviderOperationPort, 'record' | 'replayReference'>;
  readonly orders: FulfillmentOrderPort;
  readonly organizations: OrganizationReadPort;
}

export class PgFulfillmentJobProcess implements FulfillmentJobProcess {
  private readonly transactions = new PgTransactionAccess();

  constructor(
    private readonly manager: TransactionManager,
    private readonly extensions: ExtensionRegistry,
    private readonly dependencies: FulfillmentJobDependencies
  ) {}

  async authorizeReturn(aftersale: string, execution: FulfillmentJobExecution): Promise<void> {
    const request = await this.manager.read(this.options('system', 'fulfillment.return.read', execution), (context) => this.dependencies.orders.returnRequest(context, aftersale));
    if (!request || request.state === 'returning') return;
    if (request.state !== 'approved' || !request.requiresReturn || request.lines.length === 0) throw new Error('AFTERSALE_RETURN_NOT_RUNNABLE');
    const mapped = await this.manager.read(this.options(request.scope, 'fulfillment.return.map', execution), (context) =>
      this.transactions.database(context).query<{ fulfillment: string; provider: string | null; line: string; quantity: number }>(
        `select fulfillment.id fulfillment,fulfillment.provider,line.order_line_id line,
        least(line.quantity,requested.quantity)::float8 quantity from fulfillment.fulfillmentorder fulfillment
        join fulfillment.line line on line.fulfillment_id=fulfillment.id
        join jsonb_to_recordset($1::jsonb) requested(line text,quantity bigint) on requested.line=line.order_line_id
        where fulfillment.order_id=$2 and fulfillment.state='completed' order by fulfillment.id,line.order_line_id`,
        [JSON.stringify(request.lines), request.order]
      )
    );
    if (new Set(mapped.rows.map(({ line }) => line)).size !== request.lines.length) throw new Error('AFTERSALE_FULFILLMENT_LINE_MISSING');
    const grouped = new Map<string, { provider: string | null; lines: { line: string; quantity: number }[] }>();
    for (const row of mapped.rows) {
      const current = grouped.get(row.fulfillment) ?? { provider: row.provider, lines: [] };
      current.lines.push({ line: row.line, quantity: row.quantity });
      grouped.set(row.fulfillment, current);
    }
    const planned: ReturnPlan[] = [];
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
        const response = await this.extensions.require(group.provider, request.scope, 'Return', 'return').authorize(await this.context(request.scope, execution, id), providerRequest);
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
    await this.manager.write(this.options(request.scope, 'fulfillment.return.persist', execution), async (context) => {
      const database = this.transactions.database(context);
      const returns: Array<Readonly<{ id: string; state: string; provider: string | null; providerReference: string | null; trackingNumber: null; instruction: JsonObject }>> = [];
      for (const plan of planned) {
        const { id, fulfillment, group, providerReference, instruction, providerResponse, requestHash } = plan;
        await database.query(
          `insert into fulfillment.returnrecord(id,aftersale_id,fulfillment_id,scope_id,state,provider,provider_reference,instruction,created_at,updated_at,version)
          values($1,$2,$3,$4,'authorized',$5,$6,$7::jsonb,clock_timestamp(),clock_timestamp(),0)
          on conflict(aftersale_id,fulfillment_id) do nothing`,
          [id, aftersale, fulfillment, request.scope, group.provider, providerReference, JSON.stringify(instruction)]
        );
        for (const line of group.lines) await database.query(`insert into fulfillment.returnline(return_id,order_line_id,quantity) values($1,$2,$3) on conflict do nothing`, [id, line.line, line.quantity]);
        if (group.provider && providerResponse && requestHash)
          await this.dependencies.operations.record(context, {
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
      await this.dependencies.orders.markReturning(context, aftersale, returns, execution.trace);
    });
  }

  async submit(id: string, execution: FulfillmentJobExecution): Promise<void> {
    const loaded = await this.load(id, ['pending', 'failed'], execution);
    const accepted = FulfillmentState.from(loaded.state).transition('submit');
    if (loaded.provider === null) {
      const changed = await this.manager.write(this.options(loaded.scope_id, 'fulfillment.internal.accept', execution), async (context) => {
        const result = await this.transactions.database(context).query(
          `update fulfillment.fulfillmentorder set state=$2,updated_at=clock_timestamp(),version=version+1
          where id=$1 and state=$3 returning id`,
          [id, accepted, loaded.state]
        );
        return result.rows[0] !== undefined;
      });
      if (!changed) throw new Error('FULFILLMENT_STATE_CONFLICT');
      return;
    }
    const provider = loaded.provider;
    await this.ensure(provider, loaded.scope_id);
    const providerContext = await this.context(loaded.scope_id, execution, `fulfillment:${id}`);
    const draft = { reference: id, payload: { order: loaded.order_id, lines: loaded.lines } as JsonObject };
    const receipt = await this.extensions.require(provider, loaded.scope_id, 'Order', 'order').submit(providerContext, draft);
    const serialized = JSON.stringify(draft.payload);
    await this.manager.write(this.options(loaded.scope_id, 'fulfillment.submit.persist', execution), async (context) => {
      const database = this.transactions.database(context);
      const result = await database.query(
        `update fulfillment.fulfillmentorder set state=$3,external_reference=$2,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state=$4 and version=$5 returning id`,
        [id, receipt.externalReference, accepted, loaded.state, loaded.version]
      );
      if (!result.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
      await this.dependencies.operations.record(context, {
        id: `provideroperation:${randomUUID()}`,
        provider,
        scope: loaded.scope_id,
        kind: 'order',
        idempotency: id,
        reference: id,
        external: receipt.externalReference,
        state: success(receipt.state) ? 'succeeded' : 'processing',
        requestHash: digest(serialized),
        response: receipt,
      });
      await this.project(context, id, loaded.order_id);
      await enqueue(database, 'tracking', loaded.scope_id, { fulfillment: id }, 60);
    });
  }

  async track(id: string, execution: FulfillmentJobExecution): Promise<void> {
    const loaded = await this.load(id, ['accepted', 'processing', 'ready'], execution);
    if (!loaded.provider || !loaded.external_reference) return;
    await this.ensure(loaded.provider, loaded.scope_id);
    const snapshot = await this.extensions.require(loaded.provider, loaded.scope_id, 'Logistics', 'tracking').pullTracking(await this.context(loaded.scope_id, execution), loaded.external_reference);
    await this.manager.write(this.options(loaded.scope_id, 'fulfillment.tracking.persist', execution), async (context) => {
      const database = this.transactions.database(context);
      let completed = false;
      let shipped = false;
      for (const value of snapshot.milestones) {
        const kind = text(value.kind, 'TRACKING_KIND_INVALID');
        const state = text(value.state, 'TRACKING_STATE_INVALID');
        const external = typeof value.externalId === 'string' ? value.externalId : digest(JSON.stringify(value));
        const occurred = typeof value.occurredAt === 'string' ? value.occurredAt : new Date().toISOString();
        completed ||= ['delivered', 'completed', 'pickedup'].includes(state.toLowerCase());
        shipped ||= ['shipped', 'intransit', 'outfordelivery', 'delivered', 'completed', 'pickedup'].includes(state.toLowerCase());
        await database.query(
          `insert into fulfillment.milestone(id,fulfillment_id,kind,state,external_id,evidence,occurred_at)
          values($1,$2,$3,$4,$5,$6::jsonb,$7) on conflict(fulfillment_id,kind,external_id) do nothing`,
          [`milestone:${digest(`${id}:${kind}:${external}`)}`, id, kind, state, external, JSON.stringify(value), occurred]
        );
      }
      const next = FulfillmentState.from(loaded.state).transition(completed ? 'complete' : 'progress');
      const changed = await database.query(
        `update fulfillment.fulfillmentorder set state=$2,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state=$3 and version=$4 returning id`,
        [id, next, loaded.state, loaded.version]
      );
      if (!changed.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
      await this.project(context, id, loaded.order_id);
      if (shipped) {
        await new PgRuntimeWriter(database).append({
          id: `event:fulfillment:shipped:${digest(id)}`,
          type: 'fulfillment.shipped',
          aggregateType: 'fulfillment',
          aggregate: id,
          scope: loaded.scope_id,
          payload: { fulfillment: id, order: loaded.order_id, member: loaded.member_id, state: completed ? 'delivered' : 'shipped' },
          trace: execution.trace,
        });
      }
      if (completed)
        await this.dependencies.orders.completeFulfillment(
          context,
          loaded.order_id,
          loaded.lines.map((line) => ({ line: String(line.line), quantity: Number(line.quantity) }))
        );
      else await enqueue(database, 'tracking', loaded.scope_id, { fulfillment: id }, 300);
    });
  }

  private async project(context: import('../../../../foundation/persistence/TransactionContext').WriteTransactionContext, id: string, order: string): Promise<void> {
    const database = this.transactions.database(context);
    const fulfillment = await database.query<{
      id: string;
      provider: string | null;
      partner: string | null;
      kind: 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';
      state: string;
      externalReference: string | null;
    }>(
      `select id,provider,partner_id partner,kind,state,external_reference "externalReference"
      from fulfillment.fulfillmentorder where id=$1 and order_id=$2`,
      [id, order]
    );
    const selected = fulfillment.rows[0];
    if (!selected) throw new Error('FULFILLMENT_PROJECTION_SOURCE_MISSING');
    await this.dependencies.orders.recordFulfillments(context, order, [selected]);
    const milestones = await database.query<{ id: string; kind: string; state: string; tracking: string | null; occurredAt: string }>(
      `select id,kind,state,external_id tracking,occurred_at "occurredAt"
      from fulfillment.milestone where fulfillment_id=$1 order by occurred_at,id`,
      [id]
    );
    await this.dependencies.orders.recordFulfillmentMilestones(context, order, id, milestones.rows);
  }

  private load(id: string, states: readonly string[], execution: FulfillmentJobExecution): Promise<FulfillmentRow> {
    return this.manager.read(this.options('system', 'fulfillment.load', execution), async (context) => {
      const result = await this.transactions.database(context).query<Omit<FulfillmentRow, 'scope_id' | 'member_id'>>(
        `select fulfillment.id,fulfillment.order_id,fulfillment.provider,fulfillment.state,fulfillment.version::float8 version,
        fulfillment.external_reference,coalesce(jsonb_agg(jsonb_build_object('line',line.order_line_id,'quantity',line.quantity)
        order by line.order_line_id) filter(where line.order_line_id is not null),'[]') lines from fulfillment.fulfillmentorder fulfillment
        left join fulfillment.line line on line.fulfillment_id=fulfillment.id
        where fulfillment.id=$1 and fulfillment.state=any($2::text[]) group by fulfillment.id`,
        [id, states]
      );
      const row = result.rows[0];
      if (!row) throw new Error('FULFILLMENT_NOT_RUNNABLE');
      const order = await this.dependencies.orders.snapshot(context, row.order_id);
      if (!order) throw new Error('FULFILLMENT_ORDER_NOT_FOUND');
      return Object.freeze({ ...row, scope_id: order.scope, member_id: order.member });
    });
  }

  replay(operation: string, execution: FulfillmentJobExecution): Promise<string> {
    return this.manager.read(this.options('system', 'fulfillment.replay', execution), (context) => this.dependencies.operations.replayReference(context, operation, 'order'));
  }

  private async ensure(provider: string, scope: string): Promise<void> {
    if (!this.extensions.has(provider, scope)) throw new Error('PROVIDER_INSTALLATION_NOT_ACTIVE');
  }

  private async context(scope: string, execution: FulfillmentJobExecution, key?: string): Promise<ProviderCallContext> {
    const organization = await this.manager.read(this.options(scope, 'fulfillment.provider.context', execution), (context) => this.dependencies.organizations.scope(context, scope));
    return { tenantId: organization.tenant ?? scope, requestId: execution.trace, traceId: execution.trace, ...(key ? { idempotencyKey: key } : {}), deadline: execution.deadline };
  }

  private options(scope: string, operation: string, execution: FulfillmentJobExecution): TransactionOptions {
    return { tenant: scope, membership: 'system', scope, actor: 'system', trace: execution.trace, operation, deadline: execution.deadline, signal: execution.signal, workload: 'jobs' };
  }
}

async function enqueue(database: RuntimeSql, kind: string, scope: string, payload: unknown, delay: number) {
  await new PgRuntimeWriter(database).schedule({ id: `job:${randomUUID()}`, kind, owner: 'fulfillment', scope, payload: object(payload), priority: 20, availableAt: new Date(Date.now() + delay * 1000).toISOString() });
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
