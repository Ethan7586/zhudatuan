import { DomainError } from '../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../foundation/interface/Validation';
import { requestProjectionExport } from '../../foundation/application/RequestExport';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { ReceiveOrder } from './application/command/ReceiveOrder';
import { PgOutbox } from '../../adapter/database/PgOutbox';
import { SystemClock } from '../../foundation/domain/Clock';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { AFTERSALE_POLICY_PORT } from '../qualification/public';
import { AfterSaleService } from './application/AfterSaleService';
import { OBJECT_STORE } from '../../foundation/infrastructure/ObjectStore';
import { organizationScope } from '../../foundation/security/OrganizationScope';
import { AfterSaleAttachments } from './application/AfterSaleAttachments';

export function orderOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const receive = new ReceiveOrder(new PgOutbox(pool.workload('command')), SystemClock);
  const organizations = context.ports.get(ORGANIZATION_READ_PORT);
  const aftersales = new AfterSaleService(context.ports.get(AFTERSALE_POLICY_PORT), organizations);
  const attachments = new AfterSaleAttachments(context.service(OBJECT_STORE));
  return new ModuleOperations('order', pool, context.service(AUDIT_SINK), {
    'order.orders.read': async (request, database) => {
      const access = requireAccess(request);
      const owner = access.scope.kind === 'owner';
      const supplier = access.scope.kind === 'supplier';
      const store = access.scope.kind === 'store';
      const order = queryValue(request.input.query.order);
      const page = queryPage(request);
      const scopes = owner || supplier || store ? [] : await organizations.descendants(database, organizationScope(access.scope));
      const result = await database.query(
        `select orders.id,orders.order_number,orders.scope_id,orders.member_id,orders.mall_id,
        orders.checkout_id,orders.currency,orders.total_minor,orders.payment_state,orders.fulfillment_state,orders.aftersale_state,
        orders.lifecycle_state,orders.evidence,orders.created_at,orders.updated_at,orders.version,
        coalesce(jsonb_agg(jsonb_build_object('id',line.id,'sku',line.sku_id,'listing',line.listing_id,'title',line.title_snapshot,
        'quantity',line.quantity,'unitMinor',line.unit_minor,'totalMinor',line.total_minor,'discountMinor',line.discount_minor,
        'payableMinor',line.payable_minor,'productType',coalesce(nullif(line.evidence->>'productType',''),'unknown'),
        'category',coalesce(nullif(line.evidence->>'category',''),'unknown'),'provider',line.provider,'partner',line.partner_id))
        filter(where line.id is not null),'[]') lines
        from ordering.orderrecord orders left join ordering.line line on line.order_id=orders.id where (
        ($1::boolean and orders.member_id=$2) or (($3 or $4) and exists(select 1 from ordering.suborder where order_id=orders.id and partner_id=$2))
        or (not $1::boolean and not $3 and not $4 and orders.scope_id=any($5::text[]))
        ) and ($6='' or orders.id=$6) and ($7::timestamptz is null or (orders.created_at,orders.id)<($7::timestamptz,$8))
        group by orders.id order by orders.created_at desc,orders.id desc limit $9`,
        [owner, access.scope.id, supplier, store, scopes, order, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'created_at');
    },
    'order.reminders.create': async (request, database) => {
      const access = requireAccess(request);
      const result = await database.query(
        `insert into ordering.reminder(id,order_id,member_id,kind,state,created_at)
        select $1,orders.id,orders.member_id,'fulfillment','queued',clock_timestamp() from ordering.orderrecord orders
        where orders.id=$2 and orders.member_id=$3 and orders.lifecycle_state in('paid','fulfilling','shipped','received','completed')
          and not exists(select 1 from ordering.reminder prior where prior.order_id=orders.id and prior.created_at>clock_timestamp()-interval '30 minutes')
        returning *`,
        [`reminder:${randomUUID()}`, request.input.path.orderid!, access.scope.id]
      );
      const reminder = result.rows[0] as { id?: string } | undefined;
      if (!reminder?.id) throw new Error('ORDER_REMINDER_NOT_ALLOWED_OR_RATE_LIMITED');
      await database.query(
        `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
        values($1,'notification','order',$2,jsonb_build_object('reminder',$3,'order',$4),'queued',20,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
        [`job:${reminder.id}`, access.scope.id, reminder.id, request.input.path.orderid!]
      );
      return rowResult(result, 202);
    },
    'order.orders.export': async (request, database) => {
      const body = bodyRecord(request);
      return { status: 202, body: await requestProjectionExport(request, database, 'orders', body) };
    },
    'order.orders.receive': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const bodyVersion = body.expectedVersion;
      if (!Number.isSafeInteger(bodyVersion) || bodyVersion !== request.input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
      const receivedAt = body.receivedAt === undefined ? null : textField(body, 'receivedAt');
      const reason = body.reason === undefined ? null : textField(body, 'reason', 1000);
      const member = ['owner', 'self'].includes(access.scope.kind);
      const scopeIds = member ? [] : await organizations.descendants(database, organizationScope(access.scope));
      const result = await receive.execute(database, {
        orderId: request.input.path.orderid!,
        scopeId: access.scope.id,
        scopeIds,
        actorId: access.actor.id,
        membershipId: access.membership.id,
        memberId: member ? access.scope.id : null,
        expectedVersion: bodyVersion as number,
        receivedAt,
        reason,
        traceId: access.trace,
      });
      return { status: 200, body: result };
    },
    'order.aftersales.read': (request, database) => aftersales.read(request, database),
    'order.aftersales.apply': operationLifecycle({
      prepare: (request) => attachments.verify(request),
      execute: (request, database, attachments) => aftersales.apply(request, database, attachments),
    }),
    'order.aftersales.approve': (request, database) => aftersales.review(request, database, 'approved'),
    'order.aftersales.reject': (request, database) => aftersales.review(request, database, 'rejected'),
  });
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 255) ?? '';
}
