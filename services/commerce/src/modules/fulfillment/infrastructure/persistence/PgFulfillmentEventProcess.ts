import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrderFulfillmentPort } from '../../../order/public';
import type { FulfillmentEventProcess, FulfillmentProcessEvent } from '../../application/port/FulfillmentEventProcess';
import { FulfillmentPolicy } from '../../domain/policy/FulfillmentPolicy';
import { fulfillmentDigest as digest } from './FulfillmentJobValue';
import { projectFulfillment } from './FulfillmentProjection';

export class PgFulfillmentEventProcess implements FulfillmentEventProcess {
  private readonly access = new PgTransactionAccess();
  private readonly policy = new FulfillmentPolicy();

  constructor(
    private readonly manager: TransactionManager,
    private readonly orders: OrderFulfillmentPort
  ) {}

  process(event: FulfillmentProcessEvent, signal: AbortSignal, deadline: number): Promise<void> {
    return this.manager.write(options(event, signal, deadline), async (context) => {
      const database = this.access.database(context);
      const runtime = new PgRuntimeWriter(database);
      await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`fulfillment:${event.scopeId}:${event.resourceId}`]);
      const inbox = await runtime.claim('job:fulfillmentevent', event.eventId);
      if (!inbox) throw new Error('FULFILLMENT_EVENT_CONTEXT_MISSING');
      if (inbox.type !== event.eventType || inbox.version !== 1 || inbox.scope !== event.scopeId || inbox.aggregate !== event.sourceId) {
        throw new Error('FULFILLMENT_EVENT_CONTEXT_MISMATCH');
      }
      const payload = object(inbox.payload);
      if (event.eventType === 'order.paid') await this.paid(context, database, runtime, event, payload);
      if (event.eventType === 'aftersale.changed') await this.returnApproved(context, runtime, event, payload);
      if (event.eventType === 'channel.webhook.applied') await this.channel(database, runtime, event, payload);
      if (event.eventType === 'verification.completed') await this.verified(context, database, runtime, event, payload);
      if (!(await runtime.completeInbox('job:fulfillmentevent', event.eventId))) throw new Error('FULFILLMENT_EVENT_INBOX_CONFLICT');
    });
  }

  private async returnApproved(
    context: WriteTransactionContext,
    runtime: PgRuntimeWriter,
    event: FulfillmentProcessEvent,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void> {
    if (payload.aftersale !== event.resourceId || payload.state !== event.kind) throw new Error('FULFILLMENT_AFTERSALE_EVIDENCE_MISMATCH');
    if (event.kind !== 'approved') return;
    const request = await this.orders.returnRequest(context, event.resourceId);
    if (!request || request.scope !== event.scopeId) throw new Error('FULFILLMENT_AFTERSALE_CONTEXT_MISMATCH');
    if (!request.requiresReturn) return;
    await runtime.schedule({ id: `job:return:${event.eventId}`, kind: 'fulfillment', owner: 'fulfillment', scope: event.scopeId, payload: { aftersale: event.resourceId }, priority: 10 });
  }

  private async paid(
    context: WriteTransactionContext,
    database: SqlExecutor,
    runtime: PgRuntimeWriter,
    event: FulfillmentProcessEvent,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void> {
    if (payload.order !== event.resourceId || payload.payment !== event.paymentId) throw new Error('FULFILLMENT_PAYMENT_EVIDENCE_MISMATCH');
    const order = await this.orders.snapshot(context, event.resourceId);
    if (!order || order.scope !== event.scopeId || payload.member !== order.member) throw new Error('FULFILLMENT_ORDER_CONTEXT_MISMATCH');
    const plans = this.policy.split(await this.orders.fulfillment(context, event.resourceId));
    for (const plan of plans) {
      const id = `fulfillment:${digest(`${event.eventId}:${plan.key}`)}`;
      await database.query(
        `insert into fulfillment.fulfillmentorder(id,order_id,suborder_id,provider,partner_id,store_id,kind,scope_id,member_id,route,state,
        payment_id,source_effect_id,amount_minor,idempotency_key,created_at,updated_at,version)
        values($1,$2,$3,$4,$5,null,$6,$7,$8,$9,'pending',$10,$11,$12,$13,clock_timestamp(),clock_timestamp(),0)
        on conflict(source_effect_id,idempotency_key) do nothing`,
        [id, event.resourceId, plan.suborder, plan.provider, plan.partner, plan.kind, event.scopeId, order.member, plan.route, event.paymentId, event.eventId, plan.amountMinor, plan.key]
      );
      for (const line of plan.lines) {
        await database.query(
          `insert into fulfillment.line(fulfillment_id,order_line_id,quantity) values($1,$2,$3) on conflict do nothing`,
          [id, line.line, line.quantity]
        );
      }
      await runtime.schedule({ id: `job:fulfillment:${digest(`${event.eventId}:${plan.key}`)}`, kind: 'fulfillment', owner: 'fulfillment', scope: event.scopeId, payload: { fulfillment: id }, priority: 10 });
    }
    const created = await database.query<{
      id: string; provider: string | null; partner: string | null; kind: 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';
      state: string; externalReference: string | null; version: number;
    }>(
      `select id,provider,partner_id partner,kind,state,external_reference "externalReference",version::float8 version
      from fulfillment.fulfillmentorder where source_effect_id=$1 order by id`,
      [event.eventId]
    );
    if (created.rows.length !== plans.length) throw new Error('FULFILLMENT_PLAN_PERSISTENCE_MISMATCH');
    await this.orders.recordFulfillments(context, event.resourceId, created.rows);
  }

  private async channel(database: SqlExecutor, runtime: PgRuntimeWriter, event: FulfillmentProcessEvent, payload: Readonly<Record<string, unknown>>): Promise<void> {
    if (payload.webhook !== event.sourceId || payload.kind !== event.kind) throw new Error('FULFILLMENT_CHANNEL_EVIDENCE_MISMATCH');
    const reference = payload.internalReference;
    if (!['order', 'shipment', 'tracking', 'delivery'].includes(String(event.kind)) || typeof reference !== 'string' || !reference) return;
    const target = await database.query(`select id from fulfillment.fulfillmentorder where id=$1 and scope_id=$2`, [reference, event.scopeId]);
    if (!target.rows[0]) throw new Error('FULFILLMENT_CHANNEL_TARGET_MISSING');
    await runtime.schedule({ id: `job:tracking:webhook:${event.eventId}`, kind: 'tracking', owner: 'fulfillment', scope: event.scopeId, payload: { fulfillment: reference }, priority: 5 });
  }

  private async verified(
    context: WriteTransactionContext,
    database: SqlExecutor,
    runtime: PgRuntimeWriter,
    event: FulfillmentProcessEvent,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void> {
    if (payload.verification !== event.sourceId || payload.subject !== event.resourceId || payload.subjectType !== event.subjectType) {
      throw new Error('FULFILLMENT_VERIFICATION_EVIDENCE_MISMATCH');
    }
    if (event.subjectType !== 'fulfillment') return;
    const target = await database.query<{ id: string; order_id: string; member_id: string; state: string; lines: unknown }>(
      `select target.id,target.order_id,target.member_id,target.state,
      coalesce(jsonb_agg(jsonb_build_object('line',line.order_line_id,'quantity',line.quantity) order by line.order_line_id),'[]') lines
      from fulfillment.fulfillmentorder target join fulfillment.line line on line.fulfillment_id=target.id
      where target.id=$1 and target.scope_id=$2 and target.route in('digital','voucher') group by target.id`,
      [event.resourceId, event.scopeId]
    );
    const row = target.rows[0];
    if (!row) throw new Error('FULFILLMENT_VERIFICATION_TARGET_MISSING');
    if (row.state === 'completed') {
      await projectFulfillment(this.access, this.orders, context, row.id, row.order_id);
      return;
    }
    const changed = await database.query(
      `update fulfillment.fulfillmentorder set state='completed',version=version+1,updated_at=clock_timestamp()
      where id=$1 and state in('accepted','processing','ready') returning id`,
      [row.id]
    );
    if (!changed.rows[0]) throw new Error('FULFILLMENT_VERIFICATION_STATE_CONFLICT');
    await projectFulfillment(this.access, this.orders, context, row.id, row.order_id);
    const lines = array(row.lines).map((line) => ({ line: text(line.line, 'FULFILLMENT_LINE_REQUIRED'), quantity: integer(line.quantity) }));
    await this.orders.completeFulfillment(context, row.order_id, lines);
    await runtime.append({
      id: `event:fulfillment:verified:${digest(event.eventId)}`,
      type: 'fulfillment.shipped', aggregateType: 'fulfillment', aggregate: row.id, scope: event.scopeId,
      payload: { fulfillment: row.id, order: row.order_id, member: row.member_id, state: 'delivered' }, trace: event.eventId,
    });
  }
}

function options(event: FulfillmentProcessEvent, signal: AbortSignal, deadline: number) {
  return { tenant: event.scopeId, membership: '', scope: event.scopeId, actor: 'system:fulfillment', trace: event.eventId, operation: 'fulfillmentevent', workload: 'jobs' as const, signal, deadline };
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('FULFILLMENT_EVENT_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function array(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value)) throw new Error('FULFILLMENT_LINES_INVALID');
  return value.map(object);
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

function integer(value: unknown): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('FULFILLMENT_QUANTITY_INVALID');
  return result;
}
