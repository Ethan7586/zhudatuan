import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { FulfillmentRepository } from '../../application/port/FulfillmentRepository';
import type { ReturnRepository } from '../../application/port/ReturnRepository';
import type { TrackingRepository } from '../../application/port/TrackingRepository';
import { FulfillmentState } from '../../domain/model/FulfillmentState';
import { Package } from '../../domain/model/Package';
import { Return } from '../../domain/model/Return';
import { Shipment } from '../../domain/model/Shipment';
import { fulfillmentDigest as digest } from './FulfillmentJobValue';
import { projectFulfillment } from './FulfillmentProjection';
import { readReturnEvidence } from './ReturnEvidence';
import { FulfillmentScopeReader } from './FulfillmentScopeReader';

export class PgFulfillmentRepository implements FulfillmentRepository, ReturnRepository, TrackingRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly scopes: FulfillmentScopeReader
  ) {}

  async read(context: ReadTransactionContext, order: string, member: string) {
    const database = this.transactions.database(context);
    await this.scopes.member(context, order, member);
    const result = await database.query(
      `select target.id,target.order_id,target.route,target.state,target.external_reference,
      coalesce((select jsonb_agg(jsonb_build_object('id',shipment.id,'state',shipment.state,'providerReference',shipment.provider_reference,
        'shippedAt',shipment.shipped_at,'deliveredAt',shipment.delivered_at,'version',shipment.version,
        'packages',coalesce((select jsonb_agg(jsonb_build_object('id',package.id,'carrier',package.carrier,'tracking',package.tracking_number,
          'providerReference',package.provider_reference,'state',package.state,'version',package.version,
          'lines',coalesce((select jsonb_agg(jsonb_build_object('line',line.order_line_id,'quantity',line.quantity) order by line.order_line_id)
            from fulfillment.packageline line where line.package_id=package.id),'[]'::jsonb),
          'events',coalesce((select jsonb_agg(jsonb_build_object('id',event.id,'external',event.provider_event_id,'state',event.state,
            'description',event.description,'location',event.location,'evidence',event.evidence,'occurredAt',event.occurred_at,
            'receivedAt',event.received_at) order by event.occurred_at,event.id)
            from fulfillment.trackingevent event where event.package_id=package.id),'[]'::jsonb)) order by package.created_at,package.id)
          from fulfillment.package package where package.shipment_id=shipment.id),'[]'::jsonb)) order by shipment.created_at,shipment.id)
        from fulfillment.shipment shipment where shipment.fulfillment_id=target.id),'[]'::jsonb) shipments
      from fulfillment.fulfillmentorder target where target.order_id=$1 order by target.created_at,target.id`,
      [order]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async ship(context: WriteTransactionContext, input: Parameters<FulfillmentRepository['ship']>[1]) {
    const database = this.transactions.database(context);
    const loaded = await this.scopes.fulfillment(context, input.id, input.scope);
    if (loaded.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const lineRows = await database.query<{ line: string; quantity: number; packed: number }>(
      `select source.order_line_id line,source.quantity::float8 quantity,
      coalesce((select sum(packed.quantity) from fulfillment.packageline packed join fulfillment.package package on package.id=packed.package_id
        join fulfillment.shipment shipment on shipment.id=package.shipment_id
        where shipment.fulfillment_id=source.fulfillment_id and packed.order_line_id=source.order_line_id),0)::float8 packed
      from fulfillment.line source where source.fulfillment_id=$1 order by source.order_line_id for update`,
      [input.id]
    );
    const remaining = lineRows.rows.map(({ line, quantity, packed }) => Object.freeze({ line, quantity: quantity - packed })).filter(({ quantity }) => quantity > 0);
    const selected = input.lines ?? remaining;
    if (selected.length === 0) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
    const shipmentId = `shipment:${digest(`${input.id}:${input.idempotency}`)}`;
    const packageId = `package:${digest(`${shipmentId}:${input.tracking}`)}`;
    const packageValue = Package.create({ id: packageId, shipment: shipmentId, carrier: input.carrier, tracking: input.tracking, providerReference: null, state: 'shipped', lines: selected, version: 0 });
    Shipment.create({ id: shipmentId, fulfillment: input.id, state: 'draft', limits: remaining, packages: [], version: 0 }).add(packageValue);
    const next = FulfillmentState.from(loaded.state).transition('ship');
    const changed = await database.query<{
      id: string;
      order_id: string;
      suborder_id: string;
      provider: string | null;
      partner_id: string | null;
      store_id: string | null;
      kind: 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';
      route: string;
      state: string;
      external_reference: string | null;
      payment_id: string | null;
      source_effect_id: string | null;
      amount_minor: number | null;
      idempotency_key: string | null;
      created_at: string;
      updated_at: string;
      version: number;
    }>(
      `update fulfillment.fulfillmentorder set state=$2,version=version+1,updated_at=clock_timestamp()
      where id=$1 and state=$3 and version=$4 returning *,version::float8 version,amount_minor::float8 amount_minor`,
      [input.id, next, loaded.state, input.expectedVersion]
    );
    const fulfillment = changed.rows[0];
    if (!fulfillment) throw new DomainError('VERSION_CONFLICT');
    await database.query(
      `insert into fulfillment.shipment(id,fulfillment_id,state,provider_reference,shipped_at,delivered_at,created_at,updated_at,version)
      values($1,$2,'shipped',null,clock_timestamp(),null,clock_timestamp(),clock_timestamp(),0)`,
      [shipmentId, input.id]
    );
    await database.query(
      `insert into fulfillment.package(id,shipment_id,carrier,tracking_number,provider_reference,state,created_at,updated_at,version)
      values($1,$2,$3,$4,null,'shipped',clock_timestamp(),clock_timestamp(),0)`,
      [packageId, shipmentId, input.carrier, input.tracking]
    );
    for (const line of selected) await database.query(`insert into fulfillment.packageline(package_id,order_line_id,quantity) values($1,$2,$3)`, [packageId, line.line, line.quantity]);
    const eventId = `tracking:${digest(`${packageId}:shipped`)}`;
    await database.query(
      `insert into fulfillment.trackingevent(id,package_id,provider_event_id,state,description,location,evidence,occurred_at,received_at)
      values($1,$2,$3,'shipped','商家已发货',null,$4::jsonb,clock_timestamp(),clock_timestamp())`,
      [eventId, packageId, input.idempotency, JSON.stringify({ actor: input.actor, carrier: input.carrier })]
    );
    await projectFulfillment(this.transactions, this.scopes.orders, context, input.id, loaded.order);
    await new PgRuntimeWriter(database).append({
      id: `event:fulfillment:shipped:${digest(`${input.id}:${input.idempotency}`)}`,
      type: 'fulfillment.shipped',
      aggregateType: 'fulfillment',
      aggregate: input.id,
      scope: input.scope,
      payload: { fulfillment: input.id, order: loaded.order, member: loaded.member, state: 'shipped' },
      trace: input.trace,
    });
    return Object.freeze({ ...fulfillment, shipment_id: shipmentId, package_id: packageId, tracking: input.tracking, shipped_quantity: selected.reduce((sum, line) => sum + line.quantity, 0) });
  }

  async receive(context: WriteTransactionContext, input: Parameters<ReturnRepository['receive']>[1]) {
    const database = this.transactions.database(context);
    const loaded = await this.loadReturn(database, context, input.id, input.scope);
    const expected = input.expectedVersion ?? loaded.returnVersion;
    if (expected !== loaded.returnVersion) throw new DomainError('VERSION_CONFLICT');
    const aggregate = Return.create({ id: loaded.returnId, fulfillment: loaded.id, state: loaded.returnState, lines: loaded.lines, fulfilled: loaded.fulfilled, version: loaded.returnVersion }).receive();
    const changed = await database.query<{ aftersale_id: string }>(
      `update fulfillment.returnrecord set state=$2,tracking_number=coalesce($3,tracking_number),updated_at=clock_timestamp(),version=version+1
      where id=$1 and state=$4 and version=$5 returning aftersale_id`,
      [loaded.returnId, aggregate.value.state, input.tracking ?? null, loaded.returnState, expected]
    );
    const row = changed.rows[0];
    if (!row) throw new DomainError('VERSION_CONFLICT');
    const pending = await database.query(`select id from fulfillment.returnrecord where aftersale_id=$1 and state not in('received','accepted','rejected') limit 1`, [row.aftersale_id]);
    if (!pending.rows[0]) await this.scopes.orders.markReceived(context, row.aftersale_id, await readReturnEvidence(database, row.aftersale_id), input.actor);
    return this.returnDetail(database, loaded.returnId);
  }

  async inspect(context: WriteTransactionContext, input: Parameters<ReturnRepository['inspect']>[1]) {
    const database = this.transactions.database(context);
    const loaded = await this.loadReturn(database, context, input.id, input.scope);
    const expected = input.expectedVersion ?? loaded.returnVersion;
    if (expected !== loaded.returnVersion) throw new DomainError('VERSION_CONFLICT');
    const aggregate = Return.create({ id: loaded.returnId, fulfillment: loaded.id, state: loaded.returnState, lines: loaded.lines, fulfilled: loaded.fulfilled, version: loaded.returnVersion }).inspect(input.accepted);
    const changed = await database.query<{ id: string; aftersale_id: string; scope_id: string }>(
      `update fulfillment.returnrecord set state=$2,updated_at=clock_timestamp(),version=version+1
      where id=$1 and state=$3 and version=$4 returning id,aftersale_id,scope_id`,
      [loaded.returnId, aggregate.value.state, loaded.returnState, expected]
    );
    const returned = changed.rows[0];
    if (!returned) throw new DomainError('VERSION_CONFLICT');
    const inspectionId = `inspection:${digest(`${returned.id}:${expected + 1}`)}`;
    await database.query(
      `insert into fulfillment.inspection(id,return_id,sequence,accepted,evidence,actor_id,inspected_at)
      select $1,$2,coalesce(max(sequence),0)+1,$3,$4::jsonb,$5,clock_timestamp() from fulfillment.inspection where return_id=$2`,
      [inspectionId, returned.id, input.accepted, JSON.stringify(input.evidence ?? {}), input.actor]
    );
    await this.scopes.orders.recordInspection(context, returned.aftersale_id, returned.id, input.accepted, input.actor);
    const runtime = new PgRuntimeWriter(database);
    await runtime.append({
      id: `event:return:inspected:${digest(inspectionId)}`,
      type: 'return.inspected',
      aggregateType: 'return',
      aggregate: returned.id,
      scope: returned.scope_id,
      payload: { return: returned.id, aftersale: returned.aftersale_id, accepted: input.accepted },
      trace: input.trace,
    });
    if (input.accepted) {
      const pending = await database.query(`select id from fulfillment.returnrecord where aftersale_id=$1 and state<>'accepted' limit 1`, [returned.aftersale_id]);
      if (!pending.rows[0]) await this.scopes.orders.markRefunding(context, returned.aftersale_id, await readReturnEvidence(database, returned.aftersale_id), input.actor);
      await runtime.schedule({ id: `job:return:${returned.id}`, kind: 'inventorysync', owner: 'inventory', scope: returned.scope_id, payload: { return: returned.id }, priority: 20 });
    }
    return this.returnDetail(database, returned.id);
  }

  private async loadReturn(database: SqlExecutor, context: WriteTransactionContext, id: string, scope: string) {
    const loaded = await this.scopes.returned(context, id, scope);
    const lines = await database.query<{ line: string; quantity: number }>(`select order_line_id line,quantity::float8 quantity from fulfillment.returnline where return_id=$1 order by order_line_id`, [loaded.returnId]);
    const fulfilled = await database.query<{ line: string; quantity: number }>(`select order_line_id line,quantity::float8 quantity from fulfillment.line where fulfillment_id=$1 order by order_line_id`, [loaded.id]);
    return Object.freeze({ ...loaded, lines: lines.rows, fulfilled: fulfilled.rows });
  }

  private async returnDetail(database: SqlExecutor, id: string): Promise<Readonly<Record<string, unknown>>> {
    const result = await database.query(
      `select returned.id,returned.aftersale_id,returned.fulfillment_id,returned.scope_id,returned.state,returned.provider,
      returned.provider_reference,returned.instruction,returned.tracking_number,returned.created_at,returned.updated_at,returned.version::float8 version,
      coalesce((select jsonb_agg(jsonb_build_object('line',line.order_line_id,'quantity',line.quantity) order by line.order_line_id)
        from fulfillment.returnline line where line.return_id=returned.id),'[]'::jsonb) lines,
      coalesce((select jsonb_agg(jsonb_build_object('id',inspection.id,'sequence',inspection.sequence,'accepted',inspection.accepted,
        'evidence',inspection.evidence,'actor',inspection.actor_id,'inspectedAt',inspection.inspected_at) order by inspection.sequence)
        from fulfillment.inspection inspection where inspection.return_id=returned.id),'[]'::jsonb) inspections
      from fulfillment.returnrecord returned where returned.id=$1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze(row);
  }
}
