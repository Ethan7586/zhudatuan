import { randomUUID } from 'node:crypto';
import type { JsonObject, ProviderCallContext, ProviderOperationResult } from '@shop/contract';
import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { FulfillmentJobExecution, FulfillmentJobProcess } from '../../application/port/FulfillmentJobProcess';
import { enqueueFulfillment as enqueue, fulfillmentDigest as digest, providerSucceeded as success, requiredJobText as text } from './FulfillmentJobValue';
import type { FulfillmentJobDependencies, FulfillmentRow, ReturnPlan } from './FulfillmentJobContext';
import { projectFulfillment } from './FulfillmentProjection';
import { readReturnEvidence } from './ReturnEvidence';
import { PgFulfillmentSaga } from './PgFulfillmentSaga';
import { FulfillmentOrder } from '../../domain/model/FulfillmentOrder';

export class PgFulfillmentJobProcess implements FulfillmentJobProcess {
  private readonly transactions = new PgTransactionAccess();
  private readonly saga = new PgFulfillmentSaga();

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
      const step = `return:${aftersale}`;
      if (!(await this.manager.write(this.options(request.scope, 'fulfillment.return.saga.begin', execution), (context) =>
        this.saga.begin(this.transactions.database(context), fulfillment, step, id, { aftersale })
      ))) continue;
      const source = request.lines.find(({ line }) => group.lines.some((candidate) => candidate.line === line));
      const configured = source?.policy.returnInstruction;
      let providerReference: string | null = null;
      let instruction: JsonObject;
      let providerResult: ProviderOperationResult | null = null;
      let requestHash: string | null = null;
      if (group.provider) {
        const providerRequest = Object.freeze({
          reference: id,
          fulfillmentReference: fulfillment,
          reason: request.reason,
          lines: Object.freeze(group.lines.map(({ line, quantity }) => Object.freeze({ reference: line, quantity }))),
          evidence: Object.freeze({ aftersale, ...(configured && typeof configured === 'object' && !Array.isArray(configured) ? { policy: configured as JsonObject } : {}) }),
        });
        let response;
        try {
          await this.ensure(group.provider, request.scope);
          response = await this.extensions.strategy(group.provider, request.scope, 'Return').authorize(await this.context(request.scope, execution, id), providerRequest);
        } catch (error) {
          await this.manager.write(this.options(request.scope, 'fulfillment.return.saga.fail', execution), (context) => this.saga.fail(this.transactions.database(context), fulfillment, step, error));
          throw error;
        }
        if (!success(response.state) && response.state.toLowerCase() !== 'authorized') throw new Error('PROVIDER_RETURN_NOT_AUTHORIZED');
        if (!['address', 'labelUrl', 'message', 'method'].some((key) => typeof response.instruction[key] === 'string' && response.instruction[key].trim())) {
          throw new Error('PROVIDER_RETURN_INSTRUCTION_INVALID');
        }
        providerReference = response.externalReference;
        instruction = response.instruction;
        providerResult = Object.freeze({ externalReference: response.externalReference, state: response.state });
        requestHash = digest(JSON.stringify(providerRequest));
      } else {
        instruction = configured && typeof configured === 'object' && !Array.isArray(configured) ? (configured as JsonObject) : { state: 'authorized', method: 'internal' };
      }
      planned.push(Object.freeze({ id, fulfillment, group, providerReference, instruction, providerResult, requestHash }));
    }
    await this.manager.write(this.options(request.scope, 'fulfillment.return.persist', execution), async (context) => {
      const database = this.transactions.database(context);
      for (const plan of planned) {
        const { id, fulfillment, group, providerReference, instruction, providerResult, requestHash } = plan;
        await database.query(
          `insert into fulfillment.returnrecord(id,aftersale_id,fulfillment_id,scope_id,state,provider,provider_reference,instruction,created_at,updated_at,version)
          values($1,$2,$3,$4,'authorized',$5,$6,$7::jsonb,clock_timestamp(),clock_timestamp(),0)
          on conflict(aftersale_id,fulfillment_id) do nothing`,
          [id, aftersale, fulfillment, request.scope, group.provider, providerReference, JSON.stringify(instruction)]
        );
        for (const line of group.lines) await database.query(`insert into fulfillment.returnline(return_id,order_line_id,quantity) values($1,$2,$3) on conflict do nothing`, [id, line.line, line.quantity]);
        if (group.provider && providerResult && requestHash)
          await this.dependencies.operations.record(context, {
            id: `provideroperation:${digest(id)}`,
            provider: group.provider,
            scope: request.scope,
            kind: 'return',
            idempotency: id,
            reference: id,
            state: 'succeeded',
            requestHash,
            result: providerResult,
          });
        await this.saga.succeed(database, fulfillment, `return:${aftersale}`, { return: id, providerReference });
      }
      const returns = await readReturnEvidence(database, aftersale);
      await this.dependencies.orders.markReturning(context, aftersale, returns, execution.trace);
    });
  }

  async submit(id: string, execution: FulfillmentJobExecution): Promise<void> {
    const loaded = await this.load(id, ['pending', 'failed', 'submitted', 'accepted', 'processing', 'ready', 'completed'], execution);
    if (!['pending', 'failed'].includes(loaded.state)) return;
    const aggregate = fulfillment(loaded);
    const step = 'submit';
    if (!(await this.manager.write(this.options(loaded.scope_id, 'fulfillment.saga.begin', execution), (context) =>
      this.saga.begin(this.transactions.database(context), id, step, `fulfillment:${id}`, { route: loaded.route, kind: loaded.kind })
    ))) return;
    if (loaded.provider === null) {
      try {
        await this.manager.write(this.options(loaded.scope_id, 'fulfillment.internal.accept', execution), async (context) => {
          const database = this.transactions.database(context);
          const state = aggregate.internalAccepted();
          let reference = loaded.external_reference;
          let issued = 0;
          if (loaded.route === 'voucher') {
            const demand = lines(loaded);
            const subjects = await this.dependencies.orders.lineSkus(context, loaded.order_id, demand.map(({ line }) => line));
            if (subjects.length !== demand.length) throw new Error('VOUCHER_FULFILLMENT_SUBJECT_MISMATCH');
            const byLine = new Map(subjects.map((subject) => [subject.line, subject]));
            const receipt = await this.dependencies.vouchers.issue(context, {
              fulfillment: loaded.id,
              order: loaded.order_id,
              scope: loaded.scope_id,
              member: loaded.member_id,
              items: demand.map(({ line, quantity }) => {
                const subject = byLine.get(line);
                if (!subject) throw new Error('VOUCHER_FULFILLMENT_SUBJECT_MISMATCH');
                return Object.freeze({ line, quantity, sku: subject.sku, product: subject.product });
              }),
            });
            reference = receipt.reference;
            issued = receipt.vouchers.length;
          }
          const result = await database.query(
            `update fulfillment.fulfillmentorder set state=$2,external_reference=$5,updated_at=clock_timestamp(),version=version+1
            where id=$1 and state=$3 and version=$4 returning id`,
            [id, state, loaded.state, loaded.version, reference]
          );
          if (!result.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
          if (state === 'completed') {
            await this.synthetic(database, { ...loaded, external_reference: reference }, execution);
            await this.dependencies.orders.completeFulfillment(context, loaded.order_id, lines(loaded));
          }
          await projectFulfillment(this.transactions, this.dependencies.orders, context, id, loaded.order_id);
          await this.saga.succeed(database, id, step, { state, ...(reference ? { reference } : {}), ...(issued > 0 ? { issued } : {}) });
        });
      } catch (error) {
        await this.manager.write(this.options(loaded.scope_id, 'fulfillment.internal.saga.fail', execution), (context) =>
          this.saga.fail(this.transactions.database(context), id, step, error)
        );
        throw error;
      }
      return;
    }
    const provider = loaded.provider;
    const draft = { reference: id, payload: { order: loaded.order_id, lines: loaded.lines, route: loaded.route, kind: loaded.kind } as JsonObject };
    let receipt;
    try {
      await this.ensure(provider, loaded.scope_id);
      receipt = await this.extensions.strategy(provider, loaded.scope_id, ['Order', 'Issue', 'DirectCharge', 'SeatLock']).submit(await this.context(loaded.scope_id, execution, `fulfillment:${id}`), draft);
    } catch (error) {
      await this.manager.write(this.options(loaded.scope_id, 'fulfillment.saga.fail', execution), (context) => this.saga.fail(this.transactions.database(context), id, step, error));
      throw error;
    }
    const serialized = JSON.stringify(draft.payload);
    await this.manager.write(this.options(loaded.scope_id, 'fulfillment.submit.persist', execution), async (context) => {
      const database = this.transactions.database(context);
      const accepted = aggregate.providerAccepted(success(receipt.state));
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
        state: success(receipt.state) ? 'succeeded' : 'processing',
        requestHash: digest(serialized),
        result: { externalReference: receipt.externalReference, state: receipt.state },
      });
      if (accepted === 'completed') {
        await this.synthetic(database, { ...loaded, external_reference: receipt.externalReference }, execution);
        await this.dependencies.orders.completeFulfillment(context, loaded.order_id, lines(loaded));
      } else if (accepted === 'accepted') await enqueue(database, 'tracking', loaded.scope_id, { fulfillment: id }, 60);
      await projectFulfillment(this.transactions, this.dependencies.orders, context, id, loaded.order_id);
      await this.saga.succeed(database, id, step, { state: accepted, externalReference: receipt.externalReference });
    });
  }

  async track(id: string, execution: FulfillmentJobExecution): Promise<void> {
    const loaded = await this.load(id, ['accepted', 'processing', 'ready', 'completed', 'cancelled'], execution);
    if (loaded.state === 'completed' || loaded.state === 'cancelled') return;
    if (!loaded.provider || !loaded.external_reference) return;
    const step = `tracking:${execution.trace}`;
    if (!(await this.manager.write(this.options(loaded.scope_id, 'fulfillment.saga.begin', execution), (context) =>
      this.saga.begin(this.transactions.database(context), id, step, `tracking:${id}:${execution.trace}`, { externalReference: loaded.external_reference })
    ))) return;
    let snapshot;
    try {
      await this.ensure(loaded.provider, loaded.scope_id);
      snapshot = await this.extensions.strategy(loaded.provider, loaded.scope_id, ['Shipment', 'Logistics', 'Delivery', 'Pickup', 'Query']).pullTracking(await this.context(loaded.scope_id, execution), loaded.external_reference);
    } catch (error) {
      await this.manager.write(this.options(loaded.scope_id, 'fulfillment.saga.fail', execution), (context) => this.saga.fail(this.transactions.database(context), id, step, error));
      throw error;
    }
    await this.manager.write(this.options(loaded.scope_id, 'fulfillment.tracking.persist', execution), async (context) => {
      const database = this.transactions.database(context);
      let completed = false;
      let shipped = false;
      let observed = 0;
      const shipment = `shipment:${digest(`${id}:${snapshot.externalReference}`)}`;
      const tracking = snapshot.milestones.map((value) => typeof value.tracking === 'string' ? value.tracking : typeof value.trackingNumber === 'string' ? value.trackingNumber : null).find(Boolean) ?? snapshot.externalReference;
      const packageId = `package:${digest(shipment)}`;
      await database.query(
        `insert into fulfillment.shipment(id,fulfillment_id,state,provider_reference,shipped_at,delivered_at,created_at,updated_at,version)
        values($1,$2,'draft',$3,null,null,clock_timestamp(),clock_timestamp(),0) on conflict(id) do nothing`,
        [shipment, id, snapshot.externalReference]
      );
      await database.query(
        `insert into fulfillment.package(id,shipment_id,carrier,tracking_number,provider_reference,state,created_at,updated_at,version)
        values($1,$2,null,$3,$4,'created',clock_timestamp(),clock_timestamp(),0) on conflict(id) do nothing`,
        [packageId, shipment, tracking, snapshot.externalReference]
      );
      for (const line of lines(loaded)) await database.query(`insert into fulfillment.packageline(package_id,order_line_id,quantity) values($1,$2,$3) on conflict do nothing`, [packageId, line.line, line.quantity]);
      for (const value of snapshot.milestones) {
        const state = trackingState(text(value.state, 'TRACKING_STATE_INVALID'));
        const external = typeof value.externalId === 'string' ? value.externalId : digest(JSON.stringify(value));
        const occurred = typeof value.occurredAt === 'string' ? value.occurredAt : new Date().toISOString();
        completed ||= ['delivered', 'completed', 'pickedup'].includes(state);
        shipped ||= ['shipped', 'intransit', 'outfordelivery', 'delivered', 'completed', 'pickedup'].includes(state);
        const inserted = await database.query(
          `insert into fulfillment.trackingevent(id,package_id,provider_event_id,state,description,location,evidence,occurred_at,received_at)
          values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,clock_timestamp()) on conflict(package_id,provider_event_id) do nothing returning id`,
          [`tracking:${digest(`${id}:${external}`)}`, packageId, external, state, typeof value.description === 'string' ? value.description : state,
            typeof value.location === 'string' ? value.location : null, JSON.stringify(value), occurred]
        );
        if (inserted.rows[0]) {
          observed += 1;
          await database.query(
          `update fulfillment.package set state=$2,updated_at=clock_timestamp(),version=version+1 where id=$1 and $2<>'exception'
          and array_position(array['created','accepted','ready','shipped','intransit','outfordelivery','delivered','pickedup','completed','returned'],state)
            <=array_position(array['created','accepted','ready','shipped','intransit','outfordelivery','delivered','pickedup','completed','returned'],$2)`,
          [packageId, state]
          );
        }
      }
      if (observed === 0) {
        await enqueue(database, 'tracking', loaded.scope_id, { fulfillment: id }, 300);
        await this.saga.succeed(database, id, step, { state: loaded.state, milestones: 0, duplicate: true });
        return;
      }
      const next = fulfillment(loaded).observed(completed);
      const changed = await database.query(
        `update fulfillment.fulfillmentorder set state=$2,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state=$3 and version=$4 returning id`,
        [id, next, loaded.state, loaded.version]
      );
      if (!changed.rows[0]) throw new Error('FULFILLMENT_STATE_CONFLICT');
      await database.query(
        `update fulfillment.shipment set state=case when $2::boolean then 'delivered' when $3::boolean then 'shipped' else state end,
        shipped_at=case when $3::boolean then coalesce(shipped_at,clock_timestamp()) else shipped_at end,
        delivered_at=case when $2::boolean then coalesce(delivered_at,clock_timestamp()) else delivered_at end,
        updated_at=clock_timestamp(),version=version+1 where id=$1`,
        [shipment, completed, shipped]
      );
      await projectFulfillment(this.transactions, this.dependencies.orders, context, id, loaded.order_id);
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
          lines(loaded)
        );
      else await enqueue(database, 'tracking', loaded.scope_id, { fulfillment: id }, 300);
      await this.saga.succeed(database, id, step, { state: next, milestones: snapshot.milestones.length });
    });
  }

  private load(id: string, states: readonly string[], execution: FulfillmentJobExecution): Promise<FulfillmentRow> {
    return this.manager.read(this.options('system', 'fulfillment.load', execution), async (context) => {
      const result = await this.transactions.database(context).query<FulfillmentRow>(
        `select fulfillment.id,fulfillment.order_id,fulfillment.provider,fulfillment.state,fulfillment.version::float8 version,
        fulfillment.scope_id,fulfillment.member_id,fulfillment.route,fulfillment.kind,
        fulfillment.external_reference,coalesce(jsonb_agg(jsonb_build_object('line',line.order_line_id,'quantity',line.quantity)
        order by line.order_line_id) filter(where line.order_line_id is not null),'[]') lines from fulfillment.fulfillmentorder fulfillment
        left join fulfillment.line line on line.fulfillment_id=fulfillment.id
        where fulfillment.id=$1 and fulfillment.state=any($2::text[]) group by fulfillment.id`,
        [id, states]
      );
      const row = result.rows[0];
      if (!row) throw new Error('FULFILLMENT_NOT_RUNNABLE');
      return Object.freeze(row);
    });
  }

  private async synthetic(database: ReturnType<PgTransactionAccess['database']>, loaded: FulfillmentRow, execution: FulfillmentJobExecution): Promise<void> {
    const shipment = `shipment:${digest(`${loaded.id}:digital`)}`;
    const packageId = `package:${digest(`${loaded.id}:digital`)}`;
    await database.query(
      `insert into fulfillment.shipment(id,fulfillment_id,state,provider_reference,shipped_at,delivered_at,created_at,updated_at,version)
      values($1,$2,'delivered',$3,clock_timestamp(),clock_timestamp(),clock_timestamp(),clock_timestamp(),0) on conflict(id) do nothing`,
      [shipment, loaded.id, loaded.external_reference]
    );
    await database.query(
      `insert into fulfillment.package(id,shipment_id,carrier,tracking_number,provider_reference,state,created_at,updated_at,version)
      values($1,$2,null,$3,$4,'completed',clock_timestamp(),clock_timestamp(),0) on conflict(id) do nothing`,
      [packageId, shipment, `DIGITAL-${digest(loaded.id).slice(0, 16)}`, loaded.external_reference]
    );
    for (const line of lines(loaded)) await database.query(`insert into fulfillment.packageline(package_id,order_line_id,quantity) values($1,$2,$3) on conflict do nothing`, [packageId, line.line, line.quantity]);
    await database.query(
      `insert into fulfillment.trackingevent(id,package_id,provider_event_id,state,description,location,evidence,occurred_at,received_at)
      values($1,$2,$3,'completed','权益已发放',null,$4::jsonb,clock_timestamp(),clock_timestamp()) on conflict(package_id,provider_event_id) do nothing`,
      [`tracking:${digest(`${loaded.id}:completed`)}`, packageId, `completed:${loaded.id}`, JSON.stringify({ route: loaded.route, trace: execution.trace })]
    );
    await new PgRuntimeWriter(database).append({
      id: `event:fulfillment:shipped:${digest(loaded.id)}`, type: 'fulfillment.shipped', aggregateType: 'fulfillment', aggregate: loaded.id,
      scope: loaded.scope_id, payload: { fulfillment: loaded.id, order: loaded.order_id, member: loaded.member_id, state: 'delivered' }, trace: execution.trace,
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

function lines(loaded: FulfillmentRow): readonly Readonly<{ line: string; quantity: number }>[] {
  return loaded.lines.map((value) => {
    const line = text(value.line, 'FULFILLMENT_LINE_REQUIRED');
    const quantity = Number(value.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('FULFILLMENT_QUANTITY_INVALID');
    return Object.freeze({ line, quantity });
  });
}

function fulfillment(loaded: FulfillmentRow): FulfillmentOrder {
  return FulfillmentOrder.load({
    id: loaded.id, order: loaded.order_id, route: loaded.route, kind: loaded.kind,
    state: loaded.state as Parameters<typeof FulfillmentOrder.load>[0]['state'], lines: lines(loaded), version: loaded.version,
  });
}

type TrackingState = 'created' | 'accepted' | 'ready' | 'shipped' | 'intransit' | 'outfordelivery' | 'delivered' | 'pickedup' | 'completed' | 'exception' | 'returned';
function trackingState(value: string): TrackingState {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
  if ((['created', 'accepted', 'ready', 'shipped', 'intransit', 'outfordelivery', 'delivered', 'pickedup', 'completed', 'exception', 'returned'] as readonly string[]).includes(normalized)) {
    return normalized as TrackingState;
  }
  throw new Error('TRACKING_STATE_INVALID');
}

export type { FulfillmentJobDependencies } from './FulfillmentJobContext';
