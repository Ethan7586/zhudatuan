import { DomainError } from '../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { FULFILLMENT_ORDER_PORT } from '../order/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { FulfillmentAccess } from './application/FulfillmentAccess';
import { FulfillmentState } from './domain/model/FulfillmentState';
import { ReturnState } from './domain/model/ReturnState';

export function fulfillmentOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const accessPolicy = new FulfillmentAccess(context.ports.get(FULFILLMENT_ORDER_PORT), context.ports.get(ORGANIZATION_READ_PORT));
  return new ModuleOperations('fulfillment', pool, context.service(AUDIT_SINK), {
    'fulfillment.tracking.read': async (request, database) => {
      const access = requireAccess(request);
      const raw = request.input.query.order;
      const order = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 255) ?? '';
      if (!order) throw new DomainError('VALIDATION_FAILED', { field: 'order' });
      await accessPolicy.member(database, order, access.scope.id);
      const result = await database.query(
        `select fulfillment.id,fulfillment.order_id,fulfillment.state,fulfillment.external_reference,
        coalesce(jsonb_agg(jsonb_build_object('id',milestone.id,'kind',milestone.kind,'state',milestone.state,'tracking',milestone.external_id,
          'evidence',milestone.evidence,'occurredAt',milestone.occurred_at) order by milestone.occurred_at,milestone.id)
          filter(where milestone.id is not null),'[]') milestones from fulfillment.fulfillmentorder fulfillment
        left join fulfillment.milestone milestone on milestone.fulfillment_id=fulfillment.id
        where fulfillment.order_id=$1 group by fulfillment.id order by fulfillment.id`,
        [order]
      );
      return { status: 200, body: { items: result.rows, count: result.rows.length } };
    },
    'fulfillment.shipments.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const fulfillment = request.input.path.fulfillmentid!;
      const loaded = await accessPolicy.fulfillment(database, fulfillment, access.scope.id);
      const next = FulfillmentState.from(loaded.state).transition('ship');
      const tracking = textField(body, 'tracking', 128);
      const result = await database.query(
        `with milestone as (insert into fulfillment.milestone(id,fulfillment_id,kind,state,external_id,evidence,occurred_at)
        values($1,$2,'shipment','shipped',$3,$4::jsonb,clock_timestamp()) returning *), changed as
        (update fulfillment.fulfillmentorder set state=$5,version=version+1,updated_at=clock_timestamp()
          where id=$2 and state=$6 and version=$7 returning *)
        select changed.id,changed.order_id,changed.suborder_id,changed.provider,changed.partner_id,changed.store_id,changed.kind,
          changed.state,changed.external_reference,changed.payment_id,changed.source_effect_id,changed.amount_minor,changed.idempotency_key,
          changed.created_at,changed.updated_at,changed.version,milestone.external_id tracking from changed join milestone on true`,
        [`milestone:${randomUUID()}`, fulfillment, tracking, JSON.stringify({ carrier: body.carrier ?? null, actor: access.actor.id }), next, loaded.state, loaded.version]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      return rowResult(result, 201);
    },
    'fulfillment.returns.receive': async (request, database) => {
      const access = requireAccess(request);
      const returned = await accessPolicy.returned(database, request.input.path.returnid!, access.scope.id);
      const expected = request.input.expectedVersion ?? returned.returnVersion;
      if (expected !== returned.returnVersion) throw new DomainError('VERSION_CONFLICT');
      const next = ReturnState.from(returned.returnState).receive();
      const result = await database.query<{ id: string; aftersale_id: string }>(
        `update fulfillment.returnrecord set state=$2,tracking_number=coalesce($3,tracking_number),updated_at=clock_timestamp(),version=version+1
          where id=$1 and state=$4 and version=$5 returning *`,
        [returned.returnId, next, bodyRecord(request).tracking ?? null, returned.returnState, expected]
      );
      const changed = result.rows[0];
      if (!changed) throw new DomainError('VERSION_CONFLICT');
      const pending = await database.query(`select id from fulfillment.returnrecord where aftersale_id=$1 and state not in('received','accepted','rejected') limit 1`, [changed.aftersale_id]);
      if (!pending.rows[0]) {
        const all = await returnEvidence(database, changed.aftersale_id);
        await accessPolicy.orders.markReceived(database, changed.aftersale_id, all, access.actor.id);
      }
      return rowResult(result);
    },
    'fulfillment.returns.inspect': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const loaded = await accessPolicy.returned(database, request.input.path.returnid!, access.scope.id);
      const expected = request.input.expectedVersion ?? loaded.returnVersion;
      if (expected !== loaded.returnVersion) throw new DomainError('VERSION_CONFLICT');
      const next = ReturnState.from(loaded.returnState).inspect(body.accepted === true);
      const result = await database.query<{ id: string; fulfillment_id: string; aftersale_id: string; scope_id: string }>(
        `update fulfillment.returnrecord set state=$2,updated_at=clock_timestamp(),version=version+1
        where id=$1 and state=$3 and version=$4 returning *`,
        [loaded.returnId, next, loaded.returnState, expected]
      );
      const returned = result.rows[0];
      if (!returned?.id) throw new Error('RETURN_INSPECTION_CONFLICT');
      await database.query(
        `insert into fulfillment.inspection(id,return_id,sequence,accepted,evidence,actor_id,inspected_at)
        select $1,$2,coalesce(max(sequence),0)+1,$3,$4::jsonb,$5,clock_timestamp()
        from fulfillment.inspection where return_id=$2`,
        [`inspection:${randomUUID()}`, returned.id, body.accepted === true, JSON.stringify(body.inspection ?? {}), access.actor.id]
      );
      await accessPolicy.orders.recordInspection(database, returned.aftersale_id, returned.id, body.accepted === true, access.actor.id);
      await database.query(
        `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'return.inspected',1,'return',$2,$3,jsonb_build_object('return',$2,'aftersale',$4,'accepted',$5),$6,clock_timestamp(),clock_timestamp())`,
        [`event:${randomUUID()}`, returned.id, returned.scope_id, returned.aftersale_id, body.accepted === true, access.trace]
      );
      if (body.accepted === true) {
        const pending = await database.query(`select id from fulfillment.returnrecord where aftersale_id=$1 and state<>'accepted' limit 1`, [returned.aftersale_id]);
        if (!pending.rows[0]) {
          const all = await returnEvidence(database, returned.aftersale_id);
          await accessPolicy.orders.markRefunding(database, returned.aftersale_id, all, access.actor.id);
        }
      }
      if (body.accepted === true)
        await database.query(
          `insert into runtime.job(id,kind,owner,payload,state,priority,available_at,created_at,updated_at)
        values($1,'inventorysync','inventory',jsonb_build_object('return',$2),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
          [`job:return:${returned.id}`, returned.id]
        );
      return rowResult(result);
    },
  });
}

async function returnEvidence(database: import('../../foundation/application/ModuleOperations').OperationDatabase, aftersale: string) {
  const result = await database.query<{ id: string; state: string; provider: string | null; providerReference: string | null; trackingNumber: string | null; instruction: Record<string, unknown> }>(
    `select id,state,provider,provider_reference "providerReference",tracking_number "trackingNumber",instruction
    from fulfillment.returnrecord where aftersale_id=$1 order by id`,
    [aftersale]
  );
  return Object.freeze(result.rows.map((row) => Object.freeze(row)));
}
