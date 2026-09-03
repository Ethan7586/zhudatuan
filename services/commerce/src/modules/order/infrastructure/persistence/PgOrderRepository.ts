import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { randomUUID } from 'node:crypto';
import type { OperationId, OperationInputFor } from '@shop/contract';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import { requestProjectionExport } from '../../../../adapter/database/PgProjectionExport';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { SystemClock } from '../../../../foundation/domain/Clock';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../../foundation/interface/Validation';
import type { OutboxWriter } from '../../../../foundation/messaging/Outbox';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { OrganizationReadPort } from '../../../organization/public';
import type { ExportRepository } from '../../application/port/ExportRepository';
import type { OrderRepository } from '../../application/port/OrderRepository';
import type { ReminderRepository } from '../../application/port/ReminderRepository';
import { OrderReadFilter } from '../../application/model/OrderReadFilter';
import { ReceiveOrder } from './ReceiveOrder';
import { ORDER_READ_FILTER_SQL, orderReadFilterValues } from './OrderReadSql';
export class PgOrderRepository implements OrderRepository, ReminderRepository, ExportRepository {
  private readonly receiver: ReceiveOrder;
  constructor(
    private readonly transactions: PgTransactionAccess,
    outbox: OutboxWriter,
    private readonly organizations: Pick<OrganizationReadPort, 'descendants' | 'scope'>
  ) {
    this.receiver = new ReceiveOrder(transactions, outbox, SystemClock);
  }
  async read(context: ReadTransactionContext, input: OperationInputFor<'order.orders.read'>, execution: ExecutionContext<'order.orders.read'>) {
    const access = requireSession(execution.security);
    const owner = access.scope.kind === 'owner';
    const supplier = access.scope.kind === 'supplier';
    const store = access.scope.kind === 'store';
    const filter = OrderReadFilter.from(input);
    const page = queryPage(input);
    const database = this.transactions.database(context);
    const scopes = owner || supplier || store ? [] : await this.organizations.descendants(context, organizationScope(access.scope));
    const timezone = filter.placed === 'today' ? (await this.organizations.scope(context, access.organization)).timezone : 'UTC';
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
      ) ${ORDER_READ_FILTER_SQL}
      and ($14::timestamptz is null or (orders.created_at,orders.id)<($14::timestamptz,$15))
      group by orders.id order by orders.created_at desc,orders.id desc limit $16`,
      [owner, access.scope.id, supplier, store, scopes, ...orderReadFilterValues(filter, timezone), page.sort, page.id, page.fetch]
    );
    return keysetResult(result, page, 'created_at') as never;
  }
  async schedule(context: WriteTransactionContext, input: OperationInputFor<'order.reminders.create'>, execution: ExecutionContext<'order.reminders.create'>) {
    const access = requireSession(execution.security);
    const database = this.transactions.database(context);
    const result = await database.query(
      `insert into ordering.reminder(id,order_id,member_id,kind,state,created_at)
      select $1,orders.id,orders.member_id,'fulfillment','queued',clock_timestamp() from ordering.orderrecord orders
      where orders.id=$2 and orders.member_id=$3 and orders.lifecycle_state in('paid','fulfilling','shipped','received','completed')
        and not exists(select 1 from ordering.reminder prior where prior.order_id=orders.id and prior.created_at>clock_timestamp()-interval '30 minutes')
      returning *`,
      [`reminder:${randomUUID()}`, input.path.orderid, access.scope.id]
    );
    const reminder = result.rows[0] as
      | {
          id?: string;
        }
      | undefined;
    if (!reminder?.id) throw new Error('ORDER_REMINDER_NOT_ALLOWED_OR_RATE_LIMITED');
    await new PgRuntimeWriter(database).schedule({ id: `job:${reminder.id}`, kind: 'notification', owner: 'order', scope: access.scope.id, payload: { reminder: reminder.id, order: input.path.orderid }, priority: 20 });
    return { status: 202, body: Object.freeze({ ...reminder }) } as never;
  }
  async create(context: WriteTransactionContext, input: OperationInputFor<'order.orders.export'>, execution: ExecutionContext<'order.orders.export'>) {
    const database = this.transactions.database(context);
    const result = await requestProjectionExport(orderRequest('order.orders.export', input, execution), this.transactions.database(context), 'orders', bodyRecord(input));
    return { status: 202, body: result } as never;
  }
  async receive(context: WriteTransactionContext, input: OperationInputFor<'order.orders.receive'>, execution: ExecutionContext<'order.orders.receive'>) {
    const access = requireSession(execution.security);
    const body = bodyRecord(input);
    const bodyVersion = body.expectedVersion;
    if (!Number.isSafeInteger(bodyVersion) || bodyVersion !== execution.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const member = ['owner', 'self'].includes(access.scope.kind);
    const database = this.transactions.database(context);
    const scopeIds = member ? [] : await this.organizations.descendants(context, organizationScope(access.scope));
    const result = await this.receiver.execute(context, {
      orderId: input.path.orderid,
      scopeId: access.scope.id,
      scopeIds,
      actorId: access.actor.id,
      membershipId: access.membership.id,
      memberId: member ? access.scope.id : null,
      expectedVersion: bodyVersion as number,
      receivedAt: body.receivedAt === undefined ? null : textField(body, 'receivedAt'),
      reason: body.reason === undefined ? null : textField(body, 'reason', 1000),
      traceId: access.trace,
    });
    return { status: 200, body: result } as never;
  }
}
export function orderRequest<TKey extends OperationId>(type: TKey, input: OperationInputFor<TKey>, execution: ExecutionContext<TKey>): OperationRequest {
  const wire = input as Readonly<{
    path?: Readonly<Record<string, string>>;
    query?: Readonly<Record<string, string | readonly string[]>>;
    body?: unknown;
  }>;
  return {
    type,
    input: {
      path: wire.path ?? {},
      query: wire.query ?? {},
      headers: execution.headers,
      body: wire.body,
      rawBody: execution.rawBody,
      deadline: execution.deadline,
      signal: execution.signal,
      ...(execution.publicActor === undefined ? {} : { publicActor: execution.publicActor }),
      ...(execution.idempotencyKey === undefined ? {} : { idempotency: execution.idempotencyKey }),
      ...(execution.expectedVersion === undefined ? {} : { expectedVersion: execution.expectedVersion }),
    },
    security: execution.security,
  };
}
