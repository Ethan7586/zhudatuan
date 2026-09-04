import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';

export function fulfillmentOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('fulfillment', pool, context.container.get(AUDIT_SINK), {
    'fulfillment.tracking.read': async (request, database) => {
      const access = requireAccess(request);
      const mall = access.mall_id;
      if (!mall) throw new Error('SCOPE_DENIED');
      const raw = request.input.query.order;
      const order = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 255) ?? '';
      if (!order) throw new Error('VALIDATION_FAILED:order');
      const result = await database.query(`select fulfillment.id,fulfillment.order_id,fulfillment.state,fulfillment.external_reference,
        coalesce(jsonb_agg(jsonb_build_object('id',milestone.id,'kind',milestone.kind,'state',milestone.state,'tracking',milestone.external_id,
          'evidence',milestone.evidence,'occurredAt',milestone.occurred_at) order by milestone.occurred_at,milestone.id)
          filter(where milestone.id is not null),'[]') milestones from fulfillment.fulfillmentorder fulfillment
        left join fulfillment.milestone milestone on milestone.mall_id=fulfillment.mall_id and milestone.fulfillment_id=fulfillment.id
        where fulfillment.mall_id=$1 and fulfillment.order_id=$2 and fulfillment.member_id=$3
        group by fulfillment.id order by fulfillment.id`, [mall, order, access.scope.id]);
      return { status: 200, body: { items: result.rows, count: result.rows.length } };
    },
    'fulfillment.shipments.create': async (request, database) => {
      const access = requireAccess(request);
      const mall = access.mall_id;
      if (!mall) throw new Error('SCOPE_DENIED');
      const body = bodyRecord(request);
      const fulfillment = request.input.path.fulfillmentid!;
      const loaded = await database.query<{ order_id: string }>(`select order_id from fulfillment.fulfillmentorder
        where mall_id=$1 and id=$2 for update`, [mall, fulfillment]);
      if (!loaded.rows[0]) throw new Error('RESOURCE_NOT_FOUND');
      const tracking = textField(body, 'tracking', 128);
      const result = await database.query(`with milestone as (insert into fulfillment.milestone(id,mall_id,fulfillment_id,kind,state,external_id,evidence,occurred_at)
        values($1,$2,$3,'shipment','shipped',$4,$5::jsonb,clock_timestamp()) returning *), changed as
        (update fulfillment.fulfillmentorder set state='processing',version=version+1,updated_at=clock_timestamp()
          where mall_id=$2 and id=$3 and state in('pending','failed') returning *) select changed.*,milestone.external_id tracking from changed join milestone on true`,
      [`milestone:${randomUUID()}`, mall, fulfillment, tracking, JSON.stringify({ carrier: body.carrier ?? null, actor: access.actor.id })]);
      return rowResult(result, 201);
    },
    'fulfillment.returns.receive': async (request, database) => {
      const access = requireAccess(request);
      const mall = access.mall_id;
      if (!mall) throw new Error('SCOPE_DENIED');
      const body = bodyRecord(request);
      return rowResult(await database.query(`update fulfillment.returnrecord returned
        set state='received',tracking_number=coalesce($3,tracking_number),version=returned.version+1
        where returned.mall_id=$1 and returned.id=$2 and returned.state in('authorized','intransit')
          and ($4::bigint is null or returned.version=$4) returning returned.*`,
      [mall, request.input.path.returnid!, body.tracking ?? null, request.input.expectedVersion ?? null]));
    },
    'fulfillment.returns.inspect': async (request, database) => {
      const access = requireAccess(request);
      const mall = access.mall_id;
      if (!mall) throw new Error('SCOPE_DENIED');
      const body = bodyRecord(request);
      const result = await database.query(`update fulfillment.returnrecord returned set state=$3,inspection=$4::jsonb,version=returned.version+1
        where returned.mall_id=$1 and returned.id=$2 and returned.state='received'
          and ($5::bigint is null or returned.version=$5) returning returned.*`,
      [mall, request.input.path.returnid!, body.accepted === true ? 'accepted' : 'rejected', JSON.stringify(body.inspection ?? {}), request.input.expectedVersion ?? null]);
      const returned = result.rows[0] as { id?: string; mall_id?: string; fulfillment_id?: string } | undefined;
      if (!returned?.id) throw new Error('RETURN_INSPECTION_CONFLICT');
      if (body.accepted === true) await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,'inventorysync','inventory',$2,jsonb_build_object('mall',$2,'return',$3),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
      [`job:return:${returned.id}`, returned.mall_id, returned.id]);
      return rowResult(result);
    },
  });
}
