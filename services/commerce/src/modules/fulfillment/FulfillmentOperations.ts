import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export function fulfillmentOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('fulfillment', pool, context.container.get(AUDIT_SINK), {
    'fulfillment.tracking.read': async (request, database) => {
      const access = requireAccess(request);
      const raw = request.input.query.order;
      const order = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 255) ?? '';
      if (!order) throw new Error('VALIDATION_FAILED:order');
      const result = await database.query(`select fulfillment.id,fulfillment.order_id,fulfillment.state,fulfillment.external_reference,
        coalesce(jsonb_agg(jsonb_build_object('id',milestone.id,'kind',milestone.kind,'state',milestone.state,'tracking',milestone.external_id,
          'evidence',milestone.evidence,'occurredAt',milestone.occurred_at) order by milestone.occurred_at,milestone.id)
          filter(where milestone.id is not null),'[]') milestones from fulfillment.fulfillmentorder fulfillment
        join ordering.orderrecord orders on orders.id=fulfillment.order_id left join fulfillment.milestone milestone on milestone.fulfillment_id=fulfillment.id
        where fulfillment.order_id=$1 and orders.member_id=$2 group by fulfillment.id order by fulfillment.id`, [order, access.scope.id]);
      return { status: 200, body: { items: result.rows, count: result.rows.length } };
    },
    'fulfillment.shipments.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const fulfillment = request.input.path.fulfillmentid!;
      const loaded = await database.query<{ order_id: string }>(`select fulfillment.order_id from fulfillment.fulfillmentorder fulfillment
        join ordering.orderrecord orders on orders.id=fulfillment.order_id where fulfillment.id=$1 and (exists(select 1 from organization.unitclosure
        where ancestor_id=$2 and descendant_id=orders.mall_id) or fulfillment.partner_id=$2 or fulfillment.store_id=$2) for update of fulfillment`, [fulfillment, access.scope.id]);
      if (!loaded.rows[0]) throw new Error('RESOURCE_NOT_FOUND');
      const tracking = textField(body, 'tracking', 128);
      const result = await database.query(`with milestone as (insert into fulfillment.milestone(id,fulfillment_id,kind,state,external_id,evidence,occurred_at)
        values($1,$2,'shipment','shipped',$3,$4::jsonb,clock_timestamp()) returning *), changed as
        (update fulfillment.fulfillmentorder set state='processing',version=version+1,updated_at=clock_timestamp() where id=$2 returning *) select changed.*,milestone.external_id tracking from changed join milestone on true`,
      [`milestone:${randomUUID()}`, fulfillment, tracking, JSON.stringify({ carrier: body.carrier ?? null, actor: access.actor.id })]);
      return rowResult(result, 201);
    },
    'fulfillment.returns.receive': async (request, database) => {
      const access = requireAccess(request);
      return rowResult(await database.query(`update fulfillment.returnrecord returned set state='received',tracking_number=coalesce($2,tracking_number),version=returned.version+1
        from fulfillment.fulfillmentorder fulfillment join ordering.orderrecord orders on orders.id=fulfillment.order_id
        where returned.id=$1 and fulfillment.id=returned.fulfillment_id and returned.state in('authorized','intransit')
          and (fulfillment.partner_id=$3 or fulfillment.store_id=$3 or exists(select 1 from organization.unitclosure where ancestor_id=$3 and descendant_id=orders.mall_id))
          and ($4::bigint is null or returned.version=$4) returning returned.*`, [request.input.path.returnid!, bodyRecord(request).tracking ?? null, access.scope.id, request.input.expectedVersion ?? null]));
    },
    'fulfillment.returns.inspect': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await database.query(`update fulfillment.returnrecord returned set state=$2,inspection=$3::jsonb,version=returned.version+1
        from fulfillment.fulfillmentorder fulfillment join ordering.orderrecord orders on orders.id=fulfillment.order_id
        where returned.id=$1 and fulfillment.id=returned.fulfillment_id and returned.state='received'
          and (fulfillment.partner_id=$4 or fulfillment.store_id=$4 or exists(select 1 from organization.unitclosure where ancestor_id=$4 and descendant_id=orders.mall_id))
          and ($5::bigint is null or returned.version=$5) returning returned.*`, [request.input.path.returnid!, body.accepted === true ? 'accepted' : 'rejected', JSON.stringify(body.inspection ?? {}), access.scope.id, request.input.expectedVersion ?? null]);
      const returned = result.rows[0] as { id?: string; fulfillment_id?: string } | undefined;
      if (!returned?.id) throw new Error('RETURN_INSPECTION_CONFLICT');
      if (body.accepted === true) await database.query(`insert into runtime.job(id,kind,owner,payload,state,priority,available_at,created_at,updated_at)
        values($1,'inventorysync','inventory',jsonb_build_object('return',$2),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`, [`job:return:${returned.id}`, returned.id]);
      return rowResult(result);
    },
  });
}
