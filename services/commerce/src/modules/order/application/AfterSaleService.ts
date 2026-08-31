import { randomUUID } from 'node:crypto';
import { DomainError } from '../../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { requireAccess, rowResult } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest, OperationResult } from '../../../foundation/application/OperationExecution';
import { bodyRecord, keysetRows, queryPage, textField } from '../../../foundation/interface/Validation';
import type { AfterSalePolicyPort, AfterSaleDecision } from '../../qualification/public';
import { AfterSale } from '../domain/model/AfterSale';
import { Order, type AftersaleState, type CommerceState, type FulfillmentState, type PaymentState } from '../domain/model/Order';
import { AfterSaleRefundPolicy } from '../domain/policy/AfterSaleRefundPolicy';
import type { VerifiedAfterSaleAttachment } from './AfterSaleAttachments';
import type { OrganizationReadPort } from '../../organization/public';
import { organizationScope } from '../../../foundation/security/OrganizationScope';

interface OrderRow {
  readonly id: string;
  readonly scope_id: string;
  readonly member_id: string;
  readonly currency: string;
  readonly lifecycle_state: CommerceState;
  readonly payment_state: PaymentState;
  readonly fulfillment_state: FulfillmentState;
  readonly aftersale_state: AftersaleState;
  readonly evidence: Record<string, unknown>;
}
interface LineRow {
  readonly id: string;
  readonly sku_id: string;
  readonly listing_id: string;
  readonly title_snapshot: string;
  readonly quantity: number;
  readonly fulfilled_quantity: number;
  readonly aftersale_quantity: number;
  readonly payable_minor: number;
  readonly provider: string | null;
  readonly product_type: string;
  readonly fulfilled_at: string | null;
  readonly provider_rule: Record<string, unknown>;
}
interface RequestedLine {
  readonly lineId: string;
  readonly quantity: number;
}
export class AfterSaleService {
  private readonly refunds = new AfterSaleRefundPolicy();
  constructor(
    private readonly policies: AfterSalePolicyPort,
    private readonly organizations: OrganizationReadPort
  ) {}

  async read(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = requireAccess(request);
    const orderId = queryValue(request.input.query.order);
    const member = access.scope.kind === 'owner' || access.scope.kind === 'self';
    const supplier = access.scope.kind === 'supplier';
    const store = access.scope.kind === 'store';
    const scopes = member || supplier || store ? [] : await this.organizations.descendants(database, organizationScope(access.scope));
    const page = queryPage(request);
    const rows = await database.query(
      `select aftersale.id,aftersale.order_id "orderId",aftersale.state,aftersale.reason_code "reasonCode",
      aftersale.description,aftersale.currency,aftersale.expected_refund_minor::float8 "expectedRefundMinor",aftersale.expected_refund "expectedRefund",
      aftersale.requires_return "requiresReturn",aftersale.unavailable_reason "unavailableReason",
      aftersale.requested_by "requestedBy",aftersale.created_at "createdAt",aftersale.updated_at "updatedAt",
      aftersale.version::float8 version,
      coalesce((select jsonb_agg(jsonb_build_object('lineId',line.line_id,'skuId',line.sku_id,'listingId',line.listing_id,
        'title',line.title_snapshot,'productType',line.product_type,'provider',line.provider,'purchasedQuantity',line.purchased_quantity,
        'fulfilledQuantity',line.fulfilled_quantity,'claimedQuantity',line.claimed_quantity,'requestedQuantity',line.requested_quantity,
        'maximumQuantity',line.maximum_quantity,'unitMinor',line.unit_minor,'refundMinor',line.refund_minor,
        'available',line.unavailable_reason is null,'unavailableReason',line.unavailable_reason) order by line.line_id)
        from ordering.aftersaleline line where line.aftersale_id=aftersale.id),'[]') lines,
      coalesce((select jsonb_agg(jsonb_build_object('objectId',attachment.object_id,'name',attachment.file_name,
        'mediaType',attachment.media_type,'sizeBytes',attachment.size_bytes,'contentHash',attachment.content_hash)
        order by attachment.sequence) from ordering.aftersaleattachment attachment where attachment.aftersale_id=aftersale.id),'[]') attachments,
      coalesce((select jsonb_agg(jsonb_build_object('sequence',timeline.sequence,'kind',timeline.kind,
        'previousState',timeline.previous_state,'state',timeline.next_state,'evidence',timeline.evidence,'occurredAt',timeline.occurred_at)
        order by timeline.sequence) from ordering.aftersaletimeline timeline where timeline.aftersale_id=aftersale.id),'[]') timeline
      from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
      where (($1::boolean and orders.member_id=$2)
        or (($3::boolean or $4::boolean) and exists(select 1 from ordering.suborder where order_id=orders.id and partner_id=$2))
        or (not $1::boolean and not $3::boolean and not $4::boolean and orders.scope_id=any($5::text[])))
        and ($6='' or orders.id=$6)
        and ($7::timestamptz is null or (aftersale.created_at,aftersale.id)<($7::timestamptz,$8))
      order by aftersale.created_at desc,aftersale.id desc limit $9`,
      [member, access.scope.id, supplier, store, scopes, orderId, page.sort, page.id, page.fetch]
    );
    const availableLines = member && orderId ? await this.available(database, await this.order(database, orderId, access.scope.id, false)) : [];
    const result = keysetRows(rows.rows, page, 'createdAt');
    return { ...result, body: { ...(result.body as Record<string, unknown>), availableLines } };
  }

  async apply(request: OperationRequest, database: OperationDatabase, attachments: readonly VerifiedAfterSaleAttachment[]): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    const order = await this.order(database, request.input.path.orderid!, access.scope.id, true);
    new Order(order.id, order.lifecycle_state, order.payment_state, order.fulfillment_state, order.aftersale_state).assertAftersaleAllowed();
    const requested = requestedLines(body.lines);
    const lines = await this.lines(
      database,
      order.id,
      requested.map(({ lineId }) => lineId),
      true
    );
    if (lines.length !== requested.length) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
    const decisions: { readonly line: LineRow; readonly requested: RequestedLine; readonly decision: AfterSaleDecision; readonly refundMinor: number }[] = [];
    for (const line of lines) {
      const selected = requested.find(({ lineId }) => lineId === line.id)!;
      const decision = await this.policies.evaluate(database, {
        scope: order.scope_id,
        member: order.member_id,
        line: line.id,
        productType: line.product_type,
        provider: line.provider,
        fulfilledAt: line.fulfilled_at,
        fulfilledQuantity: line.fulfilled_quantity,
        claimedQuantity: line.aftersale_quantity,
        requestedQuantity: selected.quantity,
        providerRule: line.provider_rule,
      });
      if (!decision.eligible) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED', { reason: decision.unavailableReason ?? 'INELIGIBLE' });
      decisions.push({ line, requested: selected, decision, refundMinor: this.refunds.prorate(line.payable_minor, line.quantity, selected.quantity) });
    }
    if (new Set(decisions.map(({ decision }) => decision.requiresReturn)).size !== 1) {
      throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED', { reason: 'MIXED_RETURN_ROUTE' });
    }
    const aftersale = `aftersale:${randomUUID()}`;
    const reason = textField(body, 'reason', 64);
    const description = textField(body, 'description', 2000);
    const amountMinor = decisions.reduce((sum, item) => sum + item.refundMinor, 0);
    const prior = await database.query<{ expected_refund: unknown }>(`select expected_refund from ordering.aftersale where order_id=$1 and state<>'rejected' order by id for update`, [order.id]);
    const expectedRefund = {
      totalMinor: amountMinor,
      currency: order.currency,
      tenders: this.refunds.plan(
        amountMinor,
        order.evidence,
        prior.rows.map(({ expected_refund }) => expected_refund)
      ),
    };
    const requiresReturn = decisions[0]!.decision.requiresReturn;
    await database.query(
      `insert into ordering.aftersale(id,order_id,kind,state,amount_minor,reason,reason_code,description,currency,
      expected_refund_minor,expected_refund,requires_return,requested_by,requested_membership_id,created_at,updated_at,version)
      values($1,$2,'refund','applied',$3,$4,$4,$5,$6,$3,$7::jsonb,$8,$9,$10,clock_timestamp(),clock_timestamp(),0)`,
      [aftersale, order.id, amountMinor, reason, description, order.currency, JSON.stringify(expectedRefund), requiresReturn, access.actor.id, access.membership.id]
    );
    for (const item of decisions) {
      await database.query(
        `insert into ordering.aftersaleline(aftersale_id,line_id,sku_id,listing_id,title_snapshot,product_type,provider,
        purchased_quantity,fulfilled_quantity,claimed_quantity,requested_quantity,maximum_quantity,unit_minor,refund_minor,
        policy_snapshot,unavailable_reason) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,null)`,
        [
          aftersale,
          item.line.id,
          item.line.sku_id,
          item.line.listing_id,
          item.line.title_snapshot,
          item.line.product_type,
          item.line.provider,
          item.line.quantity,
          item.line.fulfilled_quantity,
          item.line.aftersale_quantity,
          item.requested.quantity,
          item.decision.maximumQuantity,
          Math.floor(item.line.payable_minor / item.line.quantity),
          item.refundMinor,
          JSON.stringify({ ...item.decision.policy, deadline: item.decision.deadline }),
        ]
      );
      const claimed = await database.query(
        `update ordering.line set aftersale_quantity=aftersale_quantity+$2 where id=$1
        and aftersale_quantity+$2<=fulfilled_quantity returning id`,
        [item.line.id, item.requested.quantity]
      );
      if (!claimed.rows[0]) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED', { reason: 'QUANTITY_EXCEEDED' });
    }
    await this.attach(database, aftersale, attachments);
    await this.timeline(database, aftersale, null, 'applied', 'application', access.actor.id, { reason });
    await this.event(database, aftersale, order.scope_id, 'aftersale.applied', access.trace, { order: order.id, member: order.member_id, state: 'applied', amountMinor, currency: order.currency, requiresReturn });
    await this.transition(database, aftersale, 'applied', 'reviewing', 'reviewqueued', access.actor.id, { automatic: true });
    await database.query(`update ordering.orderrecord set aftersale_state='reviewing',version=version+1,updated_at=clock_timestamp() where id=$1`, [order.id]);
    await this.event(database, aftersale, order.scope_id, 'aftersale.changed', access.trace, { order: order.id, member: order.member_id, previousState: 'applied', state: 'reviewing' });
    const result = await database.query(
      `select id,order_id "orderId",state,expected_refund_minor::float8 "expectedRefundMinor",currency,requires_return "requiresReturn",created_at "createdAt",updated_at "updatedAt",version::float8 version from ordering.aftersale where id=$1`,
      [aftersale]
    );
    return rowResult(result, 201);
  }

  async review(request: OperationRequest, database: OperationDatabase, decision: 'approved' | 'rejected'): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    const loaded = await database.query<{ id: string; order_id: string; scope_id: string; member_id: string; state: string; version: number; requires_return: boolean; requested_by: string | null }>(
      `select aftersale.id,aftersale.order_id,orders.scope_id,orders.member_id,aftersale.state,
      aftersale.version::float8 version,aftersale.requires_return,aftersale.requested_by
      from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
      where aftersale.id=$1 for update of aftersale,orders`,
      [request.input.path.aftersaleid!]
    );
    const sale = loaded.rows[0];
    if (!sale || sale.requested_by === access.actor.id) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
    if (request.input.expectedVersion !== sale.version) throw new DomainError('VERSION_CONFLICT');
    AfterSale.from(sale.state).transition(decision);
    const reason = textField(body, 'reason', 1000);
    await this.transition(database, sale.id, 'reviewing', decision, 'review', access.actor.id, { reason, evidence: body.evidence ?? null });
    await this.event(database, sale.id, sale.scope_id, 'aftersale.changed', access.trace, { order: sale.order_id, member: sale.member_id, previousState: 'reviewing', state: decision });
    await database.query(
      `insert into ordering.reviewaction(id,aftersale_id,previous_state,next_state,reason,evidence,actor_id,membership_id,grant_evidence,trace_id,occurred_at)
      values($1,$2,'reviewing',$3,$4,$5,$6,$7,$8::jsonb,$9,clock_timestamp())`,
      [`review:${randomUUID()}`, sale.id, decision, reason, body.evidence ?? null, access.actor.id, access.membership.id, JSON.stringify({ permission: 'order.aftersale.decide', scope: access.scope }), access.trace]
    );
    let finalState: 'approved' | 'rejected' | 'refunding' = decision;
    if (decision === 'rejected') {
      await database.query(
        `update ordering.line target set aftersale_quantity=target.aftersale_quantity-source.requested_quantity
        from ordering.aftersaleline source where source.aftersale_id=$1 and target.id=source.line_id`,
        [sale.id]
      );
    } else if (sale.requires_return) {
      await this.job(database, `job:return:${sale.id}`, 'fulfillment', 'fulfillment', sale.scope_id, { aftersale: sale.id });
    } else {
      AfterSale.from('approved').transition('refunding');
      await this.transition(database, sale.id, 'approved', 'refunding', 'refundqueued', access.actor.id, { requiresReturn: false });
      await this.event(database, sale.id, sale.scope_id, 'aftersale.changed', access.trace, { order: sale.order_id, member: sale.member_id, previousState: 'approved', state: 'refunding' });
      await this.job(database, `job:refund:${sale.id}`, 'paymentrefund', 'payment', sale.scope_id, { aftersale: sale.id });
      finalState = 'refunding';
    }
    await database.query(`update ordering.orderrecord set aftersale_state=$2,version=version+1,updated_at=clock_timestamp() where id=$1`, [sale.order_id, finalState]);
    return rowResult(await database.query(`select id,order_id "orderId",state,version::float8 version,updated_at "updatedAt" from ordering.aftersale where id=$1`, [sale.id]));
  }

  private async available(database: OperationDatabase, order: OrderRow): Promise<readonly Record<string, unknown>[]> {
    const lines = await this.lines(database, order.id, [], false);
    const result: Record<string, unknown>[] = [];
    for (const line of lines) {
      const decision = await this.policies.evaluate(database, {
        scope: order.scope_id,
        member: order.member_id,
        line: line.id,
        productType: line.product_type,
        provider: line.provider,
        fulfilledAt: line.fulfilled_at,
        fulfilledQuantity: line.fulfilled_quantity,
        claimedQuantity: line.aftersale_quantity,
        requestedQuantity: 1,
        providerRule: line.provider_rule,
      });
      result.push(
        Object.freeze({
          lineId: line.id,
          skuId: line.sku_id,
          listingId: line.listing_id,
          title: line.title_snapshot,
          productType: line.product_type,
          provider: line.provider,
          purchasedQuantity: line.quantity,
          fulfilledQuantity: line.fulfilled_quantity,
          claimedQuantity: line.aftersale_quantity,
          maximumQuantity: decision.maximumQuantity,
          expectedRefundMinor: decision.maximumQuantity > 0 ? this.refunds.prorate(line.payable_minor, line.quantity, decision.maximumQuantity) : 0,
          available: decision.eligible,
          unavailableReason: decision.unavailableReason,
          deadline: decision.deadline,
          requiresReturn: decision.requiresReturn,
        })
      );
    }
    return Object.freeze(result);
  }

  private async order(database: OperationDatabase, id: string, member: string, lock: boolean): Promise<OrderRow> {
    const result = await database.query<OrderRow>(
      `select id,scope_id,member_id,currency,lifecycle_state,payment_state,fulfillment_state,aftersale_state,evidence
      from ordering.orderrecord where id=$1 and member_id=$2${lock ? ' for update' : ''}`,
      [id, member]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return row;
  }

  private async lines(database: OperationDatabase, order: string, ids: readonly string[], lock: boolean): Promise<readonly LineRow[]> {
    const result = await database.query<LineRow>(
      `select id,sku_id,listing_id,title_snapshot,quantity::float8 quantity,fulfilled_quantity::float8 fulfilled_quantity,
      aftersale_quantity::float8 aftersale_quantity,payable_minor::float8 payable_minor,provider,
      coalesce(evidence->>'productType','physical') product_type,fulfilled_at,
      coalesce(evidence->'providerRule','{}') provider_rule from ordering.line
      where order_id=$1 and (cardinality($2::text[])=0 or id=any($2::text[])) order by id${lock ? ' for update' : ''}`,
      [order, ids]
    );
    return Object.freeze(result.rows);
  }

  private async attach(database: OperationDatabase, aftersale: string, attachments: readonly VerifiedAfterSaleAttachment[]): Promise<void> {
    for (const [index, item] of attachments.entries()) {
      await database.query(
        `insert into ordering.aftersaleattachment(aftersale_id,sequence,object_id,file_name,media_type,size_bytes,content_hash,created_at)
        values($1,$2,$3,$4,$5,$6,$7,clock_timestamp())`,
        [aftersale, index + 1, item.objectId, item.name, item.mediaType, item.sizeBytes, item.contentHash]
      );
    }
  }

  private async transition(database: OperationDatabase, id: string, previous: string, next: string, kind: string, actor: string, evidence: unknown): Promise<void> {
    const changed = await database.query(`update ordering.aftersale set state=$3,version=version+1,updated_at=clock_timestamp() where id=$1 and state=$2 returning id`, [id, previous, next]);
    if (!changed.rows[0]) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
    await this.timeline(database, id, previous, next, kind, actor, evidence);
  }

  private async timeline(database: OperationDatabase, id: string, previous: string | null, next: string, kind: string, actor: string, evidence: unknown): Promise<void> {
    await database.query(
      `insert into ordering.aftersaletimeline(id,aftersale_id,sequence,kind,previous_state,next_state,actor_id,evidence,occurred_at)
      select $1,$2,coalesce(max(sequence),0)+1,$3,$4,$5,$6,$7::jsonb,clock_timestamp()
      from ordering.aftersaletimeline where aftersale_id=$2`,
      [`timeline:${randomUUID()}`, id, kind, previous, next, actor, JSON.stringify(evidence)]
    );
  }

  private async event(database: OperationDatabase, id: string, scope: string, type: string, trace: string, payload: unknown): Promise<void> {
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      values($1,$2,1,'aftersale',$3,$4,$5::jsonb,$6,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, type, id, scope, JSON.stringify({ aftersale: id, ...(payload as Record<string, unknown>) }), trace]
    );
  }

  private async job(database: OperationDatabase, id: string, kind: string, owner: string, scope: string, payload: unknown): Promise<void> {
    await database.query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,$2,$3,$4,$5::jsonb,'queued',10,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [id, kind, owner, scope, JSON.stringify(payload)]
    );
  }
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 255) ?? '';
}

function requestedLines(raw: unknown): readonly RequestedLine[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
  const lines = raw.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
    const item = value as Record<string, unknown>;
    if (typeof item.lineId !== 'string' || !Number.isSafeInteger(item.quantity) || Number(item.quantity) <= 0) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
    return Object.freeze({ lineId: item.lineId, quantity: Number(item.quantity) });
  });
  if (new Set(lines.map(({ lineId }) => lineId)).size !== lines.length) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
  return Object.freeze(lines.sort((left, right) => left.lineId.localeCompare(right.lineId)));
}
