import { randomUUID } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { FulfillmentState } from '../../domain/model/FulfillmentState';
import { ReturnState } from '../../domain/model/ReturnState';
import type { FulfillmentRepository } from '../../application/port/FulfillmentRepository';
import type { ReturnRepository } from '../../application/port/ReturnRepository';
import type { TrackingRepository } from '../../application/port/TrackingRepository';
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
      `select fulfillment.id,fulfillment.order_id,fulfillment.state,fulfillment.external_reference,
      coalesce(jsonb_agg(jsonb_build_object('id',milestone.id,'kind',milestone.kind,'state',milestone.state,'tracking',milestone.external_id,
        'evidence',milestone.evidence,'occurredAt',milestone.occurred_at) order by milestone.occurred_at,milestone.id)
        filter(where milestone.id is not null),'[]') milestones from fulfillment.fulfillmentorder fulfillment
      left join fulfillment.milestone milestone on milestone.fulfillment_id=fulfillment.id
      where fulfillment.order_id=$1 group by fulfillment.id order by fulfillment.id`,
      [order]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async ship(context: WriteTransactionContext, input: Parameters<FulfillmentRepository['ship']>[1]) {
    const database = this.transactions.database(context);
    const loaded = await this.scopes.fulfillment(context, input.id, input.scope);
    const next = FulfillmentState.from(loaded.state).transition('ship');
    const result = await database.query(
      `with milestone as (insert into fulfillment.milestone(id,fulfillment_id,kind,state,external_id,evidence,occurred_at)
      values($1,$2,'shipment','shipped',$3,$4::jsonb,clock_timestamp()) returning *), changed as
      (update fulfillment.fulfillmentorder set state=$5,version=version+1,updated_at=clock_timestamp()
        where id=$2 and state=$6 and version=$7 returning *)
      select changed.id,changed.order_id,changed.suborder_id,changed.provider,changed.partner_id,changed.store_id,changed.kind,
      changed.state,changed.external_reference,changed.payment_id,changed.source_effect_id,changed.amount_minor,changed.idempotency_key,
      changed.created_at,changed.updated_at,changed.version,milestone.id milestone_id,milestone.external_id tracking,
      milestone.occurred_at from changed join milestone on true`,
      [`milestone:${randomUUID()}`, input.id, input.tracking, JSON.stringify({ carrier: input.carrier ?? null, actor: input.actor }), next, loaded.state, loaded.version]
    );
    const changed = result.rows[0] as
      | Readonly<{
          id: string;
          order_id: string;
          provider: string | null;
          partner_id: string | null;
          kind: 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';
          state: string;
          external_reference: string | null;
          milestone_id: string;
          tracking: string | null;
          occurred_at: string;
        }>
      | undefined;
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    await this.scopes.orders.recordFulfillments(context, changed.order_id, [
      { id: changed.id, provider: changed.provider, partner: changed.partner_id, kind: changed.kind, state: changed.state, externalReference: changed.external_reference },
    ]);
    await this.scopes.orders.recordFulfillmentMilestones(context, changed.order_id, changed.id, [
      { id: changed.milestone_id, kind: 'shipment', state: 'shipped', tracking: changed.tracking, occurredAt: String(changed.occurred_at) },
    ]);
    return Object.freeze({ ...changed });
  }
  async receive(context: WriteTransactionContext, input: Parameters<ReturnRepository['receive']>[1]) {
    const database = this.transactions.database(context);
    const returned = await this.scopes.returned(context, input.id, input.scope);
    const expected = input.expectedVersion ?? returned.returnVersion;
    if (expected !== returned.returnVersion) throw new DomainError('VERSION_CONFLICT');
    const next = ReturnState.from(returned.returnState).receive();
    const result = await database.query<{
      id: string;
      aftersale_id: string;
    }>(
      `update fulfillment.returnrecord set state=$2,tracking_number=coalesce($3,tracking_number),updated_at=clock_timestamp(),version=version+1
      where id=$1 and state=$4 and version=$5 returning *`,
      [returned.returnId, next, input.tracking ?? null, returned.returnState, expected]
    );
    const changed = result.rows[0];
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    const pending = await database.query(`select id from fulfillment.returnrecord where aftersale_id=$1 and state not in('received','accepted','rejected') limit 1`, [changed.aftersale_id]);
    if (!pending.rows[0]) await this.scopes.orders.markReceived(context, changed.aftersale_id, await evidence(database, changed.aftersale_id), input.actor);
    return Object.freeze({ ...changed });
  }
  async inspect(context: WriteTransactionContext, input: Parameters<ReturnRepository['inspect']>[1]) {
    const database = this.transactions.database(context);
    const loaded = await this.scopes.returned(context, input.id, input.scope);
    const expected = input.expectedVersion ?? loaded.returnVersion;
    if (expected !== loaded.returnVersion) throw new DomainError('VERSION_CONFLICT');
    const next = ReturnState.from(loaded.returnState).inspect(input.accepted);
    const result = await database.query<{
      id: string;
      fulfillment_id: string;
      aftersale_id: string;
      scope_id: string;
    }>(
      `update fulfillment.returnrecord set state=$2,updated_at=clock_timestamp(),version=version+1
      where id=$1 and state=$3 and version=$4 returning *`,
      [loaded.returnId, next, loaded.returnState, expected]
    );
    const returned = result.rows[0];
    if (!returned) throw new DomainError('VERSION_CONFLICT');
    await database.query(
      `insert into fulfillment.inspection(id,return_id,sequence,accepted,evidence,actor_id,inspected_at)
      select $1,$2,coalesce(max(sequence),0)+1,$3,$4::jsonb,$5,clock_timestamp() from fulfillment.inspection where return_id=$2`,
      [`inspection:${randomUUID()}`, returned.id, input.accepted, JSON.stringify(input.evidence ?? {}), input.actor]
    );
    await this.scopes.orders.recordInspection(context, returned.aftersale_id, returned.id, input.accepted, input.actor);
    const runtime = new PgRuntimeWriter(database);
    await runtime.append({
      id: `event:${randomUUID()}`,
      type: 'return.inspected',
      aggregateType: 'return',
      aggregate: returned.id,
      scope: returned.scope_id,
      payload: { return: returned.id, aftersale: returned.aftersale_id, accepted: input.accepted },
      trace: input.trace,
    });
    if (input.accepted) {
      const pending = await database.query(`select id from fulfillment.returnrecord where aftersale_id=$1 and state<>'accepted' limit 1`, [returned.aftersale_id]);
      if (!pending.rows[0]) await this.scopes.orders.markRefunding(context, returned.aftersale_id, await evidence(database, returned.aftersale_id), input.actor);
      await runtime.schedule({ id: `job:return:${returned.id}`, kind: 'inventorysync', owner: 'inventory', scope: returned.scope_id, payload: { return: returned.id }, priority: 20 });
    }
    return Object.freeze({ ...returned });
  }
}
async function evidence(database: ReturnType<PgTransactionAccess['database']>, aftersale: string) {
  const result = await database.query<{
    id: string;
    state: string;
    provider: string | null;
    providerReference: string | null;
    trackingNumber: string | null;
    instruction: Record<string, unknown>;
  }>(
    `select id,state,provider,provider_reference "providerReference",tracking_number "trackingNumber",instruction
    from fulfillment.returnrecord where aftersale_id=$1 order by id`,
    [aftersale]
  );
  return Object.freeze(result.rows.map((row) => Object.freeze(row)));
}
