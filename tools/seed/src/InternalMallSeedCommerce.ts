import type { Client } from 'pg';

import {
  INTERNAL_MALL_DATASET,
  INTERNAL_MALL_REMARK,
  INTERNAL_MALL_SOURCE,
  metadata,
  stableHash,
  stableId,
  type DatasetOptions,
  type InternalMallPlan,
  type OrderFixture,
} from './InternalMallFixtures';
import { insertRows, postFinance, stage } from './InternalMallDatabase';
import {
  APPLICATION_ID,
  CAMPAIGN_IDS,
  MALL_ID,
  STORE_IDS,
  type BenefitFixture,
  type CoreSeedState,
  type VoucherFixture,
} from './InternalMallSeedCore';

interface SuborderFixture {
  readonly id: string;
  readonly order: OrderFixture;
  readonly partnerId: string;
}

interface AftersaleFixture {
  readonly id: string;
  readonly lineId: string | null;
  readonly order: OrderFixture;
}

export interface TenderFixture {
  readonly amountMinor: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly referenceId: string | null;
}

export interface PaymentFixture {
  readonly attemptId: string;
  readonly intentId: string;
  readonly order: OrderFixture;
  readonly paymentId: string;
  readonly refundId: string | null;
  readonly tenders: readonly TenderFixture[];
}

export interface FulfillmentFixture {
  readonly id: string;
  readonly order: OrderFixture;
  readonly partnerId: string;
  readonly storeId: string | null;
  readonly suborderId: string;
}

export interface CommerceSeedState {
  readonly aftersales: readonly AftersaleFixture[];
  readonly fulfillments: readonly FulfillmentFixture[];
  readonly payments: readonly PaymentFixture[];
  readonly suborders: readonly SuborderFixture[];
}

export async function seedCommerce(
  database: Client,
  options: DatasetOptions,
  plan: InternalMallPlan,
  core: CoreSeedState,
): Promise<CommerceSeedState> {
  const orderState = await seedOrders(database, plan);
  const payments = await seedPayments(database, plan, core, orderState.aftersales);
  const fulfillments = await seedFulfillment(database, plan, orderState.suborders, orderState.aftersales, payments);
  const state = Object.freeze({ aftersales: orderState.aftersales, fulfillments, payments, suborders: orderState.suborders });
  await seedExternalFacts(database, options, state);
  return state;
}

async function seedOrders(database: Client, plan: InternalMallPlan): Promise<Readonly<{
  aftersales: readonly AftersaleFixture[];
  suborders: readonly SuborderFixture[];
}>> {
  await insertRows(database, 'checkout.session', ['id', 'cart_id', 'member_id', 'mall_id', 'application_id', 'quote_id', 'quote_hash', 'address_id', 'state', 'expires_at', 'created_at', 'version', 'input'],
    plan.orders.map((order) => [`itht:checkout:${String(order.index).padStart(5, '0')}`, `itht:cart:${String(order.index).padStart(5, '0')}`, order.member.id,
      MALL_ID, APPLICATION_ID, `itht:quote:${String(order.index).padStart(5, '0')}`, stableHash('quote', order.index), null,
      order.status === 'cancelled' ? 'cancelled' : 'confirmed', plusMinutes(order.times.createdAt, 30), order.times.createdAt, 0,
      metadata({ order_number: order.number, synthetic_address: `[内测] 内测地址${String(order.member.index).padStart(3, '0')}` })]));

  await insertRows(database, 'ordering.orderrecord', ['id', 'order_number', 'scope_id', 'member_id', 'mall_id', 'checkout_id', 'currency', 'total_minor',
    'payment_state', 'fulfillment_state', 'aftersale_state', 'lifecycle_state', 'evidence', 'created_at', 'updated_at', 'version',
    'address_snapshot', 'invoice_snapshot', 'delivery_snapshot', 'experience_version'], plan.orders.map((order) => {
    const states = orderStates(order);
    return [order.id, order.number, MALL_ID, order.member.id, MALL_ID, `itht:checkout:${String(order.index).padStart(5, '0')}`, 'CNY', order.totalMinor,
      states.payment, states.fulfillment, states.aftersale, states.lifecycle, metadata({
        accepted_at: order.times.acceptedAt,
        aftersale_at: order.times.aftersaleAt,
        cancelled_at: order.times.cancelledAt,
        completed_at: order.times.completedAt,
        discount_minor: order.discountMinor,
        line_subtotal_minor: order.lineSubtotalMinor,
        order_type: order.fulfillmentKind,
        paid_at: order.times.paidAt,
        payment_method: order.paymentBucket,
        redeemed_at: order.times.redeemedAt,
        refunded_at: order.times.refundedAt,
        refund_minor: order.refundMinor,
        service_fee_minor: order.serviceFeeMinor,
        service_fee_rounding: 'half_up_minor',
        service_fee_type: order.serviceFeeType,
        shipped_at: order.times.shippedAt,
        shipping_minor: order.shippingMinor,
        status_bucket: order.status,
      }), order.times.createdAt, lastTime(order), 0,
      metadata({ label: `[内测] 内测地址${String(order.member.index).padStart(3, '0')}` }), {},
      metadata({ kind: order.fulfillmentKind, store_id: order.storeId }), 'internal-hongtai-v1'];
  }));
  await insertRows(database, 'ordering.line', ['id', 'order_id', 'sku_id', 'listing_id', 'title_snapshot', 'quantity', 'unit_minor', 'total_minor',
    'qualification_evidence_id', 'provider', 'partner_id', 'discount_minor', 'evidence'],
    plan.orders.flatMap((order) => order.lines.map((line) => [line.id, order.id, line.listing.sku.id, line.listing.id, line.listing.product.name,
      line.quantity, line.unitMinor, line.totalMinor, null, 'mock-supplier', line.listing.product.supplierId, line.discountMinor,
      metadata({ purchase_minor: line.listing.sku.purchaseMinor, settlement_minor: line.listing.sku.settlementMinor })])));

  const suborders: SuborderFixture[] = [];
  for (const order of plan.orders) {
    const partners = [...new Set(order.lines.map((line) => line.listing.product.supplierId))].sort();
    for (const partnerId of partners) suborders.push(Object.freeze({
      id: stableId('suborder', order.index, partnerId), order, partnerId,
    }));
  }
  await insertRows(database, 'ordering.suborder', ['id', 'order_id', 'partner_id', 'provider', 'state', 'version'], suborders.map((suborder) => [
    suborder.id, suborder.order.id, suborder.partnerId, 'mock-supplier', suborderState(suborder.order), 0,
  ]));

  const stateEvents: unknown[][] = [];
  for (const order of plan.orders) {
    const events: Array<readonly [string, string | null, string, string, string]> = [
      [order.times.createdAt, null, 'created', 'lifecycle', 'datasetcreated'],
    ];
    if (order.status === 'cancelled') events.push([order.times.cancelledAt!, 'created', 'cancelled', 'lifecycle', 'cancelledbeforepayment']);
    else {
      events.push([order.times.paidAt!, 'unpaid', 'paid', 'payment', 'mockpaymentsucceeded']);
      if (order.times.shippedAt) events.push([order.times.shippedAt, 'processing', 'shipped', 'fulfillment', 'mocklogisticsshipped']);
      if (order.times.redeemedAt) events.push([order.times.redeemedAt, 'processing', 'delivered', 'fulfillment', 'mockredeemed']);
      if (order.times.completedAt) events.push([order.times.completedAt, 'active', 'completed', 'lifecycle', 'businesscompleted']);
      if (order.times.aftersaleAt) events.push([order.times.aftersaleAt, 'none', 'processing', 'aftersale', 'aftersalerequested']);
      if (order.times.refundedAt) events.push([order.times.refundedAt, 'paid', order.status === 'full_refund' ? 'refunded' : 'partially_refunded', 'payment', 'mockrefundsucceeded']);
    }
    events.sort((left, right) => left[0].localeCompare(right[0]) || left[3].localeCompare(right[3]));
    events.forEach((event, index) => stateEvents.push([order.id, index + 1, event[3], event[1], event[2], event[4], 'itht:system:seed', event[0]]));
  }
  await insertRows(database, 'ordering.stateevent', ['order_id', 'sequence', 'dimension', 'previous_state', 'next_state', 'reason', 'actor_id', 'occurred_at'], stateEvents);

  const aftersales: AftersaleFixture[] = plan.orders.flatMap((order) => order.refundMinor === 0 ? [] : [Object.freeze({
    id: stableId('aftersale', order.index),
    lineId: order.status === 'partial_refund' ? order.lines[0]!.id : null,
    order,
  })]);
  await insertRows(database, 'ordering.aftersale', ['id', 'order_id', 'line_id', 'kind', 'state', 'quantity', 'amount_minor', 'reason', 'requested_by',
    'requested_membership_id', 'created_at', 'updated_at', 'version'], aftersales.map((aftersale) => [aftersale.id, aftersale.order.id, aftersale.lineId,
      aftersale.order.status === 'partial_refund' ? 'return' : 'refund', 'completed', aftersale.lineId ? 1 : null, aftersale.order.refundMinor,
      `${INTERNAL_MALL_REMARK}:合成售后`, aftersale.order.member.principalId, aftersale.order.member.membershipId,
      aftersale.order.times.aftersaleAt, aftersale.order.times.refundedAt, 0]));
  const reviewRows = aftersales.flatMap((aftersale, index) => {
    const approved = [`itht:review:${String(index + 1).padStart(3, '0')}:approved`, aftersale.id, 'requested', 'approved', '内测审批通过', null,
      'itht:system:reviewer', 'itht:membership:001', metadata({ decision: 'approved' }), `ITHT-TRACE-REVIEW-${String(index + 1).padStart(3, '0')}`,
      plusMinutes(aftersale.order.times.aftersaleAt!, 15)];
    return index < 5 ? [approved, [`itht:review:${String(index + 1).padStart(3, '0')}:completed`, aftersale.id, 'approved', 'completed', '内测售后完成', null,
      'itht:system:reviewer', 'itht:membership:001', metadata({ decision: 'completed' }), `ITHT-TRACE-REVIEW-C-${String(index + 1).padStart(3, '0')}`,
      plusMinutes(aftersale.order.times.aftersaleAt!, 30)]] : [approved];
  });
  await insertRows(database, 'ordering.reviewaction', ['id', 'aftersale_id', 'previous_state', 'next_state', 'reason', 'evidence', 'actor_id',
    'membership_id', 'grant_evidence', 'trace_id', 'occurred_at'], reviewRows);

  await seedInventoryEffects(database, plan);
  await seedCouponRedemptions(database, plan);
  await insertRows(database, 'runtime.outbox', ['id', 'event_type', 'event_version', 'aggregate_type', 'aggregate_id', 'scope_id', 'payload', 'trace_id',
    'occurred_at', 'available_at', 'attempts', 'published_at'], plan.orders.flatMap((order) => {
    const placed = [`itht:outbox:order-placed:${String(order.index).padStart(5, '0')}`, 'order.placed', 1, 'order', order.id, MALL_ID,
      metadata({ order: order.id, order_number: order.number }), `ITHT-TRACE-ORDER-${String(order.index).padStart(5, '0')}`, order.times.createdAt, order.times.createdAt, 0, order.times.createdAt];
    if (order.status === 'cancelled') return [placed, [`itht:outbox:order-cancelled:${String(order.index).padStart(5, '0')}`, 'order.cancelled', 1,
      'order', order.id, MALL_ID, metadata({ order: order.id }), `ITHT-TRACE-CANCEL-${String(order.index).padStart(5, '0')}`,
      order.times.cancelledAt, order.times.cancelledAt, 0, order.times.cancelledAt]];
    return [placed];
  }));
  stage('orders', { aftersales: aftersales.length, lines: plan.orders.reduce((sum, order) => sum + order.lines.length, 0), orders: plan.orders.length, suborders: suborders.length });
  return Object.freeze({ aftersales, suborders });
}

async function seedInventoryEffects(database: Client, plan: InternalMallPlan): Promise<void> {
  const skuIndex = new Map(plan.skus.map((sku, index) => [sku.id, index + 1]));
  const reservations: unknown[][] = [];
  const movements: unknown[][] = [];
  const stockDelta = new Map<string, number>();
  for (const order of plan.orders) {
    for (const line of order.lines.filter((candidate) => candidate.listing.product.kind === 'physical')) {
      const stockId = `itht:stock:${String(skuIndex.get(line.listing.sku.id)!).padStart(4, '0')}`;
      const reservationId = stableId('inventory-reservation', order.index, line.id);
      const released = order.status === 'cancelled';
      reservations.push([reservationId, stockId, 'order', order.id, line.quantity, released ? 'released' : 'committed', plusMinutes(order.times.createdAt, 30), order.times.createdAt, 1]);
      movements.push([stableId('inventory-movement-reserve', order.index, line.id), stockId, 'reserve', -line.quantity, 'order', order.id, order.times.createdAt]);
      if (released) movements.push([stableId('inventory-movement-release', order.index, line.id), stockId, 'release', line.quantity, 'order', order.id, order.times.cancelledAt]);
      else {
        movements.push([stableId('inventory-movement-commit', order.index, line.id), stockId, 'commit', -line.quantity, 'order', order.id, order.times.paidAt]);
        stockDelta.set(stockId, (stockDelta.get(stockId) ?? 0) - line.quantity);
      }
      const returned = order.status === 'full_refund' ? line.quantity : order.status === 'partial_refund' && line.id === order.lines[0]!.id ? 1 : 0;
      if (returned > 0) {
        const refundId = stableId('refund', order.index);
        movements.push([stableId('inventory-movement-return', order.index, line.id), stockId, 'return', returned, 'refund', refundId, order.times.refundedAt]);
        stockDelta.set(stockId, (stockDelta.get(stockId) ?? 0) + returned);
      }
    }
  }
  await insertRows(database, 'inventory.reservation', ['id', 'stockitem_id', 'owner_type', 'owner_id', 'quantity', 'state', 'expires_at', 'created_at', 'version'], reservations);
  await insertRows(database, 'inventory.movement', ['id', 'stockitem_id', 'kind', 'quantity_delta', 'reference_type', 'reference_id', 'occurred_at'], movements);
  for (const [stockId, delta] of stockDelta) await database.query(`update inventory.stockitem set onhand=onhand+$2,version=version+1,
    updated_at='2026-08-31T23:00:00+08:00' where id=$1`, [stockId, delta]);
}

async function seedCouponRedemptions(database: Client, plan: InternalMallPlan): Promise<void> {
  const committed = plan.orders.filter((order) => order.couponIndex !== null).sort((left, right) => left.couponIndex! - right.couponIndex!);
  const rows: unknown[][] = committed.map((order, index) => [`itht:coupon:${String(index + 1).padStart(4, '0')}`, CAMPAIGN_IDS[index % 3],
    order.member.id, order.id, order.discountMinor, 'committed', `ITHT-COUPON-${String(index + 1).padStart(4, '0')}`, order.times.createdAt, lastTime(order)]);
  for (let index = committed.length; index < 1_000; index += 1) {
    const claimed = index < committed.length + 130;
    rows.push([`itht:coupon:${String(index + 1).padStart(4, '0')}`, CAMPAIGN_IDS[index % CAMPAIGN_IDS.length], plan.members[index % plan.members.length]!.id,
      null, 500 + index % 5 * 100, claimed ? 'reserved' : 'released', `ITHT-COUPON-${String(index + 1).padStart(4, '0')}`,
      '2026-08-16T06:00:00+08:00', '2026-08-16T06:00:00+08:00']);
  }
  await insertRows(database, 'marketing.redemption', ['id', 'campaign_id', 'member_id', 'order_id', 'amount_minor', 'state', 'idempotency_key', 'created_at', 'updated_at'], rows);
  await database.query(`update marketing.campaign campaign set spent_minor=coalesce(source.total,0),updated_at='2026-08-31T23:00:00+08:00'
    from (select campaign_id,sum(amount_minor) total from marketing.redemption where state='committed' group by campaign_id) source
    where campaign.id=source.campaign_id and campaign.id like 'itht:%'`);
}

async function seedPayments(
  database: Client,
  plan: InternalMallPlan,
  core: CoreSeedState,
  aftersales: readonly AftersaleFixture[],
): Promise<readonly PaymentFixture[]> {
  await insertRows(database, 'payment.tender', ['id', 'kind', 'provider', 'currency', 'status'], [
    ['itht:tender:wechat', 'wechat', 'mock-wechat', 'CNY', 'active'],
    ['itht:tender:benefit', 'benefit', 'mock-benefit', 'CNY', 'active'],
    ['itht:tender:voucher', 'voucher', 'mock-voucher', 'CNY', 'active'],
    ['itht:tender:external', 'external', 'mock-store', 'CNY', 'active'],
  ]);
  const aftersaleByOrder = new Map(aftersales.map((aftersale) => [aftersale.order.id, aftersale]));
  const paymentFixtures: PaymentFixture[] = [];
  const intentRows: unknown[][] = [];
  const intentTenderRows: unknown[][] = [];
  const attemptRows: unknown[][] = [];
  const observationRows: unknown[][] = [];
  const prepayRows: unknown[][] = [];
  const paymentRows: unknown[][] = [];
  const allocationRows: unknown[][] = [];
  const effectRows: unknown[][] = [];
  const refundRows: unknown[][] = [];
  const refundTenderRows: unknown[][] = [];
  const providerAttemptRows: unknown[][] = [];
  const benefitReservationRows: unknown[][] = [];
  const benefitMovementRows: unknown[][] = [];
  const voucherReserveRows: unknown[][] = [];
  const voucherRedemptionRows: unknown[][] = [];
  const voucherReversalRows: unknown[][] = [];
  const voucherStatusRows: unknown[][] = [];
  const benefitBalances = new Map([...core.benefits].map(([member, benefit]) => [member, { benefit, remaining: 3_000_000 }]));
  const voucherBalances = new Map(core.vouchers.slice(0, 150).map((voucher) => [voucher.id, { remaining: voucher.initialMinor, state: 'bound' }]));
  const voucherRedemptionByOrder = new Map<string, { amount: number; id: string; voucher: VoucherFixture }>();

  for (const order of plan.orders) {
    if (order.status === 'cancelled') continue;
    const benefit = core.benefits.get(order.member.id)!;
    const voucher = order.voucherIndex === null ? null : core.vouchers[order.voucherIndex]!;
    if (voucher) await database.query(`update voucher.voucher set member_id=$2,state='bound',version=version+1 where id=$1`, [voucher.id, order.member.id]);
    const tenders = buildTenders(order, benefit, voucher);
    const externalTenderMinor = tenders
      .filter((tender) => tender.kind === 'wechat')
      .reduce((sum, tender) => sum + tender.amountMinor, 0);
    const intentId = stableId('payment-intent', order.index);
    const paymentId = stableId('payment', order.index);
    const attemptId = stableId('payment-attempt', order.index);
    const refundId = order.refundMinor > 0 ? stableId('refund', order.index) : null;
    const idempotency = `ITHT-PAY-${String(order.index).padStart(5, '0')}`;
    intentRows.push([intentId, order.id, order.member.id, 'CNY', order.totalMinor, 'captured', idempotency,
      `MOCK-PAY-INTENT-${String(order.index).padStart(5, '0')}`, plusMinutes(order.times.createdAt, 30), 0]);
    tenders.forEach((tender, index) => intentTenderRows.push([intentId, index + 1, tender.kind, tender.referenceId, tender.amountMinor, 'captured']));
    const primaryTender = tenders.find((tender) => tender.kind === 'wechat') ?? tenders[0]!;
    attemptRows.push([attemptId, intentId, tenderId(primaryTender.kind), providerFor(primaryTender.kind),
      `MOCK-PAY-${String(order.index).padStart(5, '0')}`, 'succeeded', order.times.createdAt, order.times.paidAt, null, null, null]);
    observationRows.push([stableId('payment-observation', order.index), attemptId, `MOCK-PAY-EVENT-${String(order.index).padStart(5, '0')}`,
      'succeeded', order.totalMinor, 'CNY', stableHash('payment-observation', order.index), order.times.paidAt]);
    if (tenders.some((tender) => tender.kind === 'wechat')) prepayRows.push([intentId, metadata({ request_id: `ITHT-PREPAY-${String(order.index).padStart(5, '0')}` }),
      `MOCK-PAY-PREPAY-${String(order.index).padStart(5, '0')}`, order.times.createdAt]);
    paymentRows.push([paymentId, intentId, order.totalMinor, 'CNY', order.totalMinor, order.refundMinor,
      order.status === 'full_refund' ? 'refunded' : order.status === 'partial_refund' ? 'partially_refunded' : 'captured', 0]);
    allocationRows.push([paymentId, 'order', order.id, order.totalMinor, 'CNY']);
    for (const kind of ['accounting', 'fulfillment', 'notification']) effectRows.push([
      `itht:effect:${String(order.index).padStart(5, '0')}:${kind}`, order.id, paymentId, kind, 'succeeded', metadata({ payment: paymentId }),
      order.times.paidAt, 1, null, order.times.paidAt, null, order.times.createdAt, order.times.paidAt,
    ]);

    for (const tender of tenders) {
      if (tender.kind === 'benefit') {
        const balance = benefitBalances.get(order.member.id)!;
        if (balance.remaining < tender.amountMinor) throw new Error('INTERNAL_DATASET_BENEFIT_BALANCE_INSUFFICIENT');
        balance.remaining -= tender.amountMinor;
        const consumeId = stableId('benefit-consume', order.index);
        benefitReservationRows.push([stableId('benefit-reservation', order.index), benefit.accountId, order.id, tender.amountMinor, 'consumed', plusMinutes(order.times.createdAt, 30)]);
        benefitMovementRows.push([consumeId, benefit.lotId, 'consume', tender.amountMinor, 'order', order.id, null, order.times.paidAt]);
        await postFinance(database, {
          amountMinor: tender.amountMinor, creditCode: 'commerce.benefit', creditKind: 'income',
          debitCode: `benefit.itht.${String(order.member.index).padStart(3, '0')}`, debitKind: 'liability', description: INTERNAL_MALL_REMARK,
          occurredAt: order.times.paidAt!, referenceId: `${benefit.accountId}:${order.id}`, referenceType: 'benefit.consume', scope: MALL_ID,
        });
      } else if (tender.kind === 'voucher' && voucher) {
        const balance = voucherBalances.get(voucher.id)!;
        balance.remaining -= tender.amountMinor;
        balance.state = balance.remaining === 0 ? 'redeemed' : 'bound';
        const redemptionId = stableId('voucher-redemption', order.index);
        voucherReserveRows.push([stableId('voucher-reserve', order.index), voucher.id, order.id, 'consumed', plusMinutes(order.times.createdAt, 30), 1]);
        voucherRedemptionRows.push([redemptionId, voucher.id, `ITHT-VOUCHER-VERIFY-${String(order.index).padStart(5, '0')}`, order.id, tender.amountMinor, order.times.paidAt, null, 0]);
        voucherStatusRows.push([voucher.id, 4, 'bound', 'reserved', 'orderreserve', 'itht:system:payment', order.times.createdAt]);
        voucherStatusRows.push([voucher.id, 5, 'reserved', balance.state, 'orderpayment', 'itht:system:payment', order.times.paidAt]);
        voucherRedemptionByOrder.set(order.id, { amount: tender.amountMinor, id: redemptionId, voucher });
        await postFinance(database, {
          amountMinor: tender.amountMinor, creditCode: 'commerce.clearing', creditKind: 'income',
          debitCode: `voucher.program.${voucher.programId}`, debitKind: 'liability', description: INTERNAL_MALL_REMARK,
          occurredAt: order.times.paidAt!, referenceId: `${order.id}:${voucher.id}`, referenceType: 'voucher.redeem', scope: MALL_ID,
        });
      }
    }

    if (externalTenderMinor > 0) {
      await postFinance(database, {
        amountMinor: externalTenderMinor, creditCode: 'commerce.revenue', creditKind: 'income',
        debitCode: `order.receivable.${order.id}`, debitKind: 'asset', description: INTERNAL_MALL_REMARK,
        occurredAt: order.times.createdAt, referenceId: order.id, referenceType: 'order.placed', scope: MALL_ID,
      });
      await postFinance(database, {
        amountMinor: externalTenderMinor, creditCode: `order.receivable.${order.id}`, creditKind: 'asset',
        debitCode: 'channel.clearing.mock-wechat', debitKind: 'asset', description: INTERNAL_MALL_REMARK,
        occurredAt: order.times.paidAt!, referenceId: paymentId, referenceType: 'payment.succeeded', scope: MALL_ID,
      });
    }

    if (refundId) {
      const aftersale = aftersaleByOrder.get(order.id)!;
      refundRows.push([refundId, paymentId, 'mock-refund', `MOCK-REFUND-${String(order.index).padStart(5, '0')}`,
        `MOCK-REFUND-TXN-${String(order.index).padStart(5, '0')}`, `ITHT-REFUND-${String(order.index).padStart(5, '0')}`, order.refundMinor,
        'CNY', 'succeeded', `${INTERNAL_MALL_REMARK}:合成退款`, 0, aftersale.id]);
      const refundTenders = allocateRefund(order.refundMinor, tenders);
      const externalRefundMinor = refundTenders
        .filter((tender) => tender.kind === 'wechat')
        .reduce((sum, tender) => sum + tender.amountMinor, 0);
      refundTenders.forEach((tender, index) => refundTenderRows.push([refundId, index + 1, tender.kind, tender.referenceId,
        tender.amountMinor, 'succeeded', `MOCK-REFUND-TENDER-${String(order.index).padStart(5, '0')}-${index + 1}`]));
      const retry = refundRows.length <= 5;
      if (retry) providerAttemptRows.push([stableId('refund-provider-attempt', order.index, 1), refundId, 1, 'refund', 'itht:worker:refund', 'timeout',
        'unknown', null, `ITHT-REFUND-REQUEST-${String(order.index).padStart(5, '0')}-1`, 'MOCK_TIMEOUT', order.times.aftersaleAt, plusMinutes(order.times.aftersaleAt!, 1)]);
      providerAttemptRows.push([stableId('refund-provider-attempt', order.index, retry ? 2 : 1), refundId, retry ? 2 : 1, 'refund', 'itht:worker:refund', 'succeeded',
        'succeeded', `MOCK-REFUND-${String(order.index).padStart(5, '0')}`, `ITHT-REFUND-REQUEST-${String(order.index).padStart(5, '0')}-${retry ? 2 : 1}`,
        null, plusMinutes(order.times.aftersaleAt!, retry ? 2 : 1), order.times.refundedAt]);
      for (const tender of refundTenders) {
        if (tender.kind === 'benefit') {
          const balance = benefitBalances.get(order.member.id)!;
          balance.remaining += tender.amountMinor;
          const consumeId = stableId('benefit-consume', order.index);
          benefitMovementRows.push([stableId('benefit-refund', order.index), benefit.lotId, 'refund', tender.amountMinor, 'refund', refundId, consumeId, order.times.refundedAt]);
          await postFinance(database, {
            amountMinor: tender.amountMinor, creditCode: `benefit.itht.${String(order.member.index).padStart(3, '0')}`, creditKind: 'liability',
            debitCode: 'benefit.refund', debitKind: 'expense', description: INTERNAL_MALL_REMARK, occurredAt: order.times.refundedAt!,
            referenceId: `${benefit.accountId}:${refundId}`, referenceType: 'benefit.refund', scope: MALL_ID,
          });
        } else if (tender.kind === 'voucher') {
          const redemption = voucherRedemptionByOrder.get(order.id)!;
          const balance = voucherBalances.get(redemption.voucher.id)!;
          balance.remaining += tender.amountMinor;
          balance.state = 'bound';
          voucherReversalRows.push([stableId('voucher-reversal', order.index), redemption.id, tender.amountMinor, 'reversed', 'paymentrefund',
            metadata({ refund: refundId }), order.times.refundedAt, refundId]);
          voucherStatusRows.push([redemption.voucher.id, 6, balance.remaining === tender.amountMinor ? 'redeemed' : 'bound', 'bound', 'paymentrefund',
            'itht:system:refund', order.times.refundedAt]);
          const redemptionRow = voucherRedemptionRows.find((row) => row[0] === redemption.id);
          if (redemptionRow && tender.amountMinor >= redemption.amount) redemptionRow[6] = order.times.refundedAt;
          await postFinance(database, {
            amountMinor: tender.amountMinor, creditCode: `voucher.program.${redemption.voucher.programId}`, creditKind: 'liability',
            debitCode: 'commerce.refund', debitKind: 'expense', description: INTERNAL_MALL_REMARK, occurredAt: order.times.refundedAt!,
            referenceId: `${refundId}:${redemption.voucher.id}`, referenceType: 'voucher.refund', scope: MALL_ID,
          });
        }
      }
      if (externalRefundMinor > 0) await postFinance(database, {
        amountMinor: externalRefundMinor, creditCode: 'channel.clearing.mock-wechat', creditKind: 'asset',
        debitCode: 'commerce.refund', debitKind: 'expense', description: INTERNAL_MALL_REMARK,
        occurredAt: order.times.refundedAt!, referenceId: refundId, referenceType: 'payment.refunded', scope: MALL_ID,
      });
    }
    paymentFixtures.push(Object.freeze({ attemptId, intentId, order, paymentId, refundId, tenders }));
  }

  await insertRows(database, 'payment.intent', ['id', 'order_id', 'member_id', 'currency', 'amount_minor', 'state', 'idempotency_key', 'provider_reference', 'expires_at', 'version'], intentRows);
  await insertRows(database, 'payment.intenttender', ['intent_id', 'sequence', 'kind', 'reference_id', 'amount_minor', 'state'], intentTenderRows);
  await insertRows(database, 'payment.attempt', ['id', 'intent_id', 'tender_id', 'provider', 'external_transaction', 'state', 'requested_at', 'completed_at',
    'payer_hash', 'scene', 'application_hash'], attemptRows);
  await insertRows(database, 'payment.observation', ['id', 'attempt_id', 'provider_event_id', 'state', 'amount_minor', 'currency', 'payload_hash', 'observed_at'], observationRows);
  await insertRows(database, 'payment.prepay', ['intent_id', 'parameters', 'provider_request_id', 'created_at'], prepayRows);
  await insertRows(database, 'payment.payment', ['id', 'intent_id', 'amount_minor', 'currency', 'captured_minor', 'refunded_minor', 'state', 'version'], paymentRows);
  await insertRows(database, 'payment.allocation', ['payment_id', 'target_type', 'target_id', 'amount_minor', 'currency'], allocationRows);
  await insertRows(database, 'payment.effect', ['id', 'order_id', 'payment_id', 'kind', 'state', 'payload', 'available_at', 'attempts', 'error_code',
    'completed_at', 'deadlettered_at', 'created_at', 'updated_at'], effectRows);
  await insertRows(database, 'payment.refund', ['id', 'payment_id', 'provider', 'provider_reference', 'external_transaction', 'idempotency_key', 'amount_minor',
    'currency', 'state', 'reason', 'version', 'aftersale_id'], refundRows);
  await insertRows(database, 'payment.refundtender', ['refund_id', 'sequence', 'kind', 'reference_id', 'amount_minor', 'state', 'provider_reference'], refundTenderRows);
  await insertRows(database, 'payment.providerattempt', ['id', 'refund_id', 'sequence', 'operation', 'worker_id', 'outcome', 'provider_state', 'provider_reference',
    'request_id', 'error_code', 'started_at', 'completed_at'], providerAttemptRows);
  await insertRows(database, 'benefit.reservation', ['id', 'account_id', 'owner_id', 'amount_minor', 'state', 'expires_at'], benefitReservationRows);
  await insertRows(database, 'benefit.lotmovement', ['id', 'lot_id', 'kind', 'amount_minor', 'reference_type', 'reference_id', 'source_id', 'occurred_at'], benefitMovementRows);
  await insertRows(database, 'voucher.reserve', ['id', 'voucher_id', 'owner_id', 'state', 'expires_at', 'version'], voucherReserveRows);
  await insertRows(database, 'voucher.redemption', ['id', 'voucher_id', 'verification_id', 'order_id', 'amount_minor', 'redeemed_at', 'reversed_at', 'version'], voucherRedemptionRows);
  await insertRows(database, 'voucher.reversal', ['id', 'redemption_id', 'amount_minor', 'state', 'reason', 'evidence', 'occurred_at', 'reference_id'], voucherReversalRows);
  await insertRows(database, 'voucher.statusevent', ['voucher_id', 'sequence', 'previous_state', 'next_state', 'reason', 'actor_id', 'occurred_at'], voucherStatusRows);
  for (const { benefit, remaining } of benefitBalances.values()) await database.query(`update benefit.lot set remaining_minor=$2,state=case when $2::bigint=0 then 'consumed' else 'active' end,
    version=version+1 where id=$1`, [benefit.lotId, remaining]);
  for (const [voucherId, balance] of voucherBalances) await database.query(`update voucher.voucher set remaining_minor=$2,state=$3,version=version+1 where id=$1`,
    [voucherId, balance.remaining, balance.state]);

  await insertRows(database, 'runtime.outbox', ['id', 'event_type', 'event_version', 'aggregate_type', 'aggregate_id', 'scope_id', 'payload', 'trace_id',
    'occurred_at', 'available_at', 'attempts', 'published_at'], paymentFixtures.flatMap((payment) => {
    const paid = [`itht:outbox:payment:${String(payment.order.index).padStart(5, '0')}`, 'payment.succeeded', 1, 'payment', payment.paymentId, MALL_ID,
      metadata({ order: payment.order.id, payment: payment.paymentId }), `ITHT-TRACE-PAY-${String(payment.order.index).padStart(5, '0')}`,
      payment.order.times.paidAt, payment.order.times.paidAt, 0, payment.order.times.paidAt];
    return payment.refundId ? [paid, [`itht:outbox:refund:${String(payment.order.index).padStart(5, '0')}`, 'payment.refunded', 1, 'refund', payment.refundId,
      MALL_ID, metadata({ order: payment.order.id, refund: payment.refundId }), `ITHT-TRACE-REFUND-${String(payment.order.index).padStart(5, '0')}`,
      payment.order.times.refundedAt, payment.order.times.refundedAt, 0, payment.order.times.refundedAt]] : [paid];
  }));
  stage('payments', { effects: effectRows.length, paid_orders: paymentFixtures.length, refunds: refundRows.length, tenders: intentTenderRows.length, voucher_consumptions: voucherRedemptionRows.length });
  return Object.freeze(paymentFixtures);
}

async function seedFulfillment(
  database: Client,
  plan: InternalMallPlan,
  suborders: readonly SuborderFixture[],
  aftersales: readonly AftersaleFixture[],
  payments: readonly PaymentFixture[],
): Promise<readonly FulfillmentFixture[]> {
  const paidOrders = new Set(payments.map((payment) => payment.order.id));
  const aftersaleByOrder = new Map(aftersales.map((aftersale) => [aftersale.order.id, aftersale]));
  const fulfillmentRows: unknown[][] = [];
  const lineRows: unknown[][] = [];
  const milestoneRows: unknown[][] = [];
  const returnRows: unknown[][] = [];
  const fulfillments: FulfillmentFixture[] = [];
  for (const suborder of suborders.filter((candidate) => paidOrders.has(candidate.order.id))) {
    const order = suborder.order;
    const id = stableId('fulfillment', order.index, suborder.partnerId);
    const lines = order.lines.filter((line) => line.listing.product.supplierId === suborder.partnerId);
    const state = fulfillmentState(order);
    const externalPrefix = order.fulfillmentKind === 'shipment' ? 'MOCK-SUPPLIER' : order.fulfillmentKind === 'digital' ? 'MOCK-VOUCHER' : 'MOCK-SUPPLIER';
    fulfillmentRows.push([id, order.id, suborder.id, providerForFulfillment(order), suborder.partnerId, order.storeId, order.fulfillmentKind, state,
      `${externalPrefix}-${String(order.index).padStart(5, '0')}-${suborder.partnerId.slice(-2)}`, stableId('payment', order.index),
      `itht:effect:${String(order.index).padStart(5, '0')}:fulfillment`, lines.reduce((sum, line) => sum + line.payableMinor, 0),
      `ITHT-FULFILL-${String(order.index).padStart(5, '0')}-${suborder.partnerId.slice(-2)}`, order.times.paidAt, lastTime(order), 0]);
    for (const line of lines) lineRows.push([id, line.id, line.quantity]);
    milestoneRows.push([stableId('milestone-accepted', order.index, suborder.partnerId), id, 'supplier', 'accepted',
      `MOCK-SUPPLIER-ACCEPT-${String(order.index).padStart(5, '0')}`, metadata({ partner: suborder.partnerId }), order.times.acceptedAt]);
    if (order.times.shippedAt) milestoneRows.push([stableId('milestone-shipped', order.index, suborder.partnerId), id, 'shipment', 'shipped',
      `MOCK-LOGISTICS-${String(order.index).padStart(5, '0')}-${suborder.partnerId.slice(-2)}`, metadata({ carrier: 'mock-logistics' }), order.times.shippedAt]);
    if (order.times.redeemedAt) milestoneRows.push([stableId('milestone-redeemed', order.index, suborder.partnerId), id, 'redemption', 'redeemed',
      `MOCK-VOUCHER-REDEEM-${String(order.index).padStart(5, '0')}`, metadata({ store: order.storeId }), order.times.redeemedAt]);
    if (order.times.completedAt) milestoneRows.push([stableId('milestone-completed', order.index, suborder.partnerId), id, 'completion', 'completed',
      `MOCK-LOGISTICS-COMPLETE-${String(order.index).padStart(5, '0')}-${suborder.partnerId.slice(-2)}`, metadata(), order.times.completedAt]);
    if (order.status === 'partial_refund') {
      const aftersale = aftersaleByOrder.get(order.id)!;
      returnRows.push([stableId('return', order.index, suborder.partnerId), aftersale.id, id, 'accepted',
        `MOCK-LOGISTICS-RETURN-${String(order.index).padStart(5, '0')}-${suborder.partnerId.slice(-2)}`, metadata({ inspected: true }), 1]);
    }
    fulfillments.push(Object.freeze({ id, order, partnerId: suborder.partnerId, storeId: order.storeId, suborderId: suborder.id }));
  }
  await insertRows(database, 'fulfillment.fulfillmentorder', ['id', 'order_id', 'suborder_id', 'provider', 'partner_id', 'store_id', 'kind', 'state',
    'external_reference', 'payment_id', 'source_effect_id', 'amount_minor', 'idempotency_key', 'created_at', 'updated_at', 'version'], fulfillmentRows);
  await insertRows(database, 'fulfillment.line', ['fulfillment_id', 'order_line_id', 'quantity'], lineRows);
  await insertRows(database, 'fulfillment.milestone', ['id', 'fulfillment_id', 'kind', 'state', 'external_id', 'evidence', 'occurred_at'], milestoneRows);
  await insertRows(database, 'fulfillment.returnrecord', ['id', 'aftersale_id', 'fulfillment_id', 'state', 'tracking_number', 'inspection', 'version'], returnRows);
  await seedStoreVerifications(database, plan.orders.filter((order) => order.status === 'redeemed'));
  await insertRows(database, 'runtime.outbox', ['id', 'event_type', 'event_version', 'aggregate_type', 'aggregate_id', 'scope_id', 'payload', 'trace_id',
    'occurred_at', 'available_at', 'attempts', 'published_at'], plan.orders.flatMap((order) => order.times.shippedAt ? [[
      `itht:outbox:shipment:${String(order.index).padStart(5, '0')}`, 'fulfillment.shipped', 1, 'order', order.id, MALL_ID,
      metadata({ order: order.id }), `ITHT-TRACE-SHIP-${String(order.index).padStart(5, '0')}`, order.times.shippedAt, order.times.shippedAt, 0, order.times.shippedAt,
    ]] : []));
  stage('fulfillment', { fulfillments: fulfillments.length, milestones: milestoneRows.length, returns: returnRows.length, verifications: plan.orders.filter(({ status }) => status === 'redeemed').length });
  return Object.freeze(fulfillments);
}

async function seedStoreVerifications(database: Client, orders: readonly OrderFixture[]): Promise<void> {
  const created = '2026-08-17T08:00:00+08:00';
  await insertRows(database, 'verification.device', ['id', 'scope_id', 'label', 'fingerprint_hash', 'public_key', 'status', 'version'],
    STORE_IDS.map((store, index) => [`itht:verification-device:${String(index + 1).padStart(2, '0')}`, store,
      `[内测] 核销设备${String(index + 1).padStart(2, '0')}`, stableHash('verification-device', index + 1), null, 'trusted', 0]));
  await insertRows(database, 'verification.session', ['id', 'scope_id', 'subject_type', 'subject_id', 'purpose', 'state', 'expires_at', 'version'],
    orders.map((order) => [stableId('verification-session', order.index), order.storeId ?? MALL_ID, 'order', order.id, 'voucher_redeem', 'verified',
      plusMinutes(order.times.redeemedAt!, 30), 0]));
  await insertRows(database, 'verification.nonce', ['session_id', 'nonce_hash', 'issued_at', 'consumed_at'],
    orders.map((order) => [stableId('verification-session', order.index), stableHash('verification-nonce', order.index), plusMinutes(order.times.redeemedAt!, -1), order.times.redeemedAt]));
  const attempts = orders.flatMap((order, index) => {
    const accepted = [`itht:verification-attempt:${String(order.index).padStart(5, '0')}`, stableId('verification-session', order.index),
      stableHash('verification-nonce', order.index), `itht:verification-device:${String(index % 6 + 1).padStart(2, '0')}`, 'accepted', 'syntheticaccepted',
      `ITHT-TRACE-VERIFY-${String(order.index).padStart(5, '0')}`, order.times.redeemedAt];
    return index < 10 ? [accepted, [`itht:verification-replay:${String(order.index).padStart(5, '0')}`, stableId('verification-session', order.index),
      stableHash('verification-replay', order.index), `itht:verification-device:${String(index % 6 + 1).padStart(2, '0')}`, 'replayed', 'duplicateverification',
      `ITHT-TRACE-VERIFY-REPLAY-${String(order.index).padStart(5, '0')}`, plusMinutes(order.times.redeemedAt!, 1)]] : [accepted];
  });
  await insertRows(database, 'verification.attempt', ['id', 'session_id', 'nonce_hash', 'device_id', 'result', 'reason', 'trace_id', 'attempted_at'], attempts);
  void created;
}

async function seedExternalFacts(database: Client, options: DatasetOptions, state: CommerceSeedState): Promise<void> {
  const connectionRows = [
    ['itht:connection:payment', 'mock-payment'],
    ['itht:connection:supplier', 'mock-supplier'],
    ['itht:connection:logistics', 'mock-logistics'],
    ['itht:connection:voucher', 'mock-voucher'],
  ];
  await insertRows(database, 'channel.connection', ['id', 'provider', 'scope_id', 'status', 'contract_version', 'secret_ref', 'configuration',
    'connection_timeout_ms', 'response_timeout_ms', 'total_deadline_ms', 'max_concurrency', 'requests_per_second', 'max_attempts', 'failure_threshold',
    'recovery_ms', 'region', 'version'], connectionRows.map(([id, provider]) => [id, provider, MALL_ID, 'disabled', 'mock.v1', null, metadata({ network: 'disabled' }),
    100, 200, 1_000, 8, 100, 3, 5, 1_000, 'local', 0]));

  const operations: unknown[][] = [];
  const idempotency: unknown[][] = [];
  const addOperation = (order: OrderFixture, provider: string, kind: string, prefix: string, retryCount = 0, finalState = 'succeeded', anomaly: string | null = null) => {
    const ordinal = operations.length + 1;
    const id = `itht:provider-operation:${String(ordinal).padStart(6, '0')}`;
    const key = `ITHT-${kind.toUpperCase().replaceAll('_', '-')}-${String(order.index).padStart(5, '0')}-${String(ordinal).padStart(6, '0')}`;
    const external = `${prefix}-${String(order.index).padStart(5, '0')}-${String(ordinal).padStart(6, '0')}`;
    const response = metadata({
      anomaly,
      external_order_id: external,
      final_state: finalState === 'failed' ? 'pending_review' : 'succeeded',
      http_status: finalState === 'failed' ? 503 : 200,
      idempotency_key: key,
      provider,
      request_at: order.times.createdAt,
      request_id: `ITHT-REQUEST-${String(ordinal).padStart(6, '0')}`,
      request_summary: { order: order.id, redacted: true },
      response_at: lastTime(order),
      response_summary: { redacted: true, result: finalState },
      retry_count: retryCount,
    });
    operations.push([id, provider, MALL_ID, kind, key, order.id, external, finalState, stableHash('provider-operation', ordinal), response,
      order.times.createdAt, lastTime(order)]);
    idempotency.push([MALL_ID, 'itht:system:mock', key, stableHash('idempotency', ordinal), finalState === 'failed' ? 'failed' : 'completed', response,
      order.times.createdAt, '2027-08-31T23:59:59+08:00']);
  };
  let refundCallbackRetries = 5;
  for (const payment of state.payments) {
    addOperation(payment.order, 'mock-payment', 'payment_create', 'MOCK-PAY');
    addOperation(payment.order, 'mock-payment', 'payment_success_notification', 'MOCK-PAY');
    if (payment.refundId) {
      addOperation(payment.order, 'mock-payment', 'refund_request', 'MOCK-REFUND');
      const retry = refundCallbackRetries > 0 ? 1 : 0;
      if (retry) refundCallbackRetries -= 1;
      addOperation(payment.order, 'mock-payment', 'refund_success_notification', 'MOCK-REFUND', retry);
    }
  }
  let supplierTimeouts = 10;
  for (const fulfillment of state.fulfillments) {
    const retry = supplierTimeouts > 0 ? 1 : 0;
    if (retry) supplierTimeouts -= 1;
    addOperation(fulfillment.order, 'mock-supplier', 'supplier_create_order', 'MOCK-SUPPLIER', retry, 'succeeded', retry ? 'timeout_then_success' : null);
    addOperation(fulfillment.order, 'mock-supplier', 'supplier_accept_order', 'MOCK-SUPPLIER');
    if (fulfillment.order.times.shippedAt) {
      addOperation(fulfillment.order, 'mock-supplier', 'supplier_ship_callback', 'MOCK-SUPPLIER');
      addOperation(fulfillment.order, 'mock-logistics', 'logistics_update', 'MOCK-LOGISTICS');
    }
    if (fulfillment.order.times.redeemedAt) {
      addOperation(fulfillment.order, 'mock-voucher', 'voucher_issue', 'MOCK-VOUCHER');
      addOperation(fulfillment.order, 'mock-voucher', 'voucher_redeem_callback', 'MOCK-VOUCHER');
    }
  }
  for (let index = 0; index < 5; index += 1) addOperation(state.payments[index]!.order, 'mock-supplier', 'supplier_optional_notification',
    'MOCK-SUPPLIER', 3, 'failed', 'permanent_failure');
  await insertRows(database, 'channel.provideroperation', ['id', 'provider', 'scope_id', 'kind', 'idempotency_key', 'internal_reference', 'external_reference',
    'state', 'request_hash', 'response', 'created_at', 'updated_at'], operations);
  await insertRows(database, 'runtime.idempotency', ['scope', 'actor_id', 'key', 'request_hash', 'state', 'response', 'created_at', 'expires_at'], idempotency);

  const externalObjects = state.payments.flatMap((payment, index) => [[`itht:external-object:payment:${String(index + 1).padStart(5, '0')}`, 'mock-payment',
    'payment', `MOCK-PAY-${String(payment.order.index).padStart(5, '0')}`, 'order', payment.order.id, INTERNAL_MALL_DATASET, payment.order.times.paidAt, MALL_ID]]);
  await insertRows(database, 'channel.externalobject', ['id', 'provider', 'objecttype', 'externalid', 'internaltype', 'internalid', 'sourceversion', 'mapped_at', 'scope_id'], externalObjects);
  const webhooks = buildWebhooks(state);
  await insertRows(database, 'channel.webhookinbox', ['id', 'connection_id', 'provider', 'scope_id', 'external_id', 'event_type', 'external_reference',
    'normalized', 'raw_ciphertext', 'raw_key_version', 'raw_hash', 'signature_hash', 'state', 'error_code', 'received_at', 'processed_at', 'trace_id', 'attempts'],
    webhooks.map((webhook) => [webhook.id, webhook.connection, webhook.provider, MALL_ID, webhook.externalId, webhook.eventType, webhook.order.id,
      metadata({ anomaly: webhook.anomaly, canonical_event_id: webhook.canonical, order: webhook.order.id }), `mockcipher:${webhook.externalId}`, 'mock-v1',
      stableHash('webhook-raw', webhook.id), stableHash('webhook-signature', webhook.id), webhook.state, null, webhook.receivedAt, webhook.receivedAt,
      `ITHT-TRACE-WEBHOOK-${webhook.id.slice(-6)}`, webhook.attempts]));
  await insertRows(database, 'runtime.rawenvelope', ['provider', 'external_id', 'sha256', 'headers', 'payload', 'trace_id', 'received_at'], webhooks.map((webhook) => [
    INTERNAL_MALL_SOURCE, webhook.externalId, stableHash('raw-envelope', webhook.id), metadata({ redacted: true }),
    JSON.stringify(metadata({ event: webhook.eventType, order: webhook.order.id })), `ITHT-TRACE-RAW-${webhook.id.slice(-6)}`, webhook.receivedAt,
  ]));
  await insertRows(database, 'runtime.inbox', ['consumer', 'event_id', 'event_type', 'event_version', 'trace_id', 'payload', 'received_at', 'processed_at', 'attempts'],
    webhooks.map((webhook) => ['internal-hongtai-dataset', webhook.id, 'channel.webhook.applied', 1, `ITHT-TRACE-INBOX-${webhook.id.slice(-6)}`,
      metadata({ anomaly: webhook.anomaly, order: webhook.order.id, state: webhook.state }), webhook.receivedAt, webhook.receivedAt, webhook.attempts]));
  stage('external_mocks', {
    duplicate_payment: 10,
    duplicate_supplier: 10,
    logistics_out_of_order: 20,
    permanent_failures: 5,
    provider_operations: operations.length,
    refund_retries: 5,
    supplier_timeout_retries: 10,
    webhooks: webhooks.length,
  });
  void options;
}

interface WebhookFixture {
  readonly anomaly: string | null;
  readonly attempts: number;
  readonly canonical: string;
  readonly connection: string;
  readonly eventType: string;
  readonly externalId: string;
  readonly id: string;
  readonly order: OrderFixture;
  readonly provider: string;
  readonly receivedAt: string;
  readonly state: 'applied' | 'ignored';
}

function buildWebhooks(state: CommerceSeedState): WebhookFixture[] {
  const rows: WebhookFixture[] = [];
  const add = (order: OrderFixture, connection: string, provider: string, eventType: string, stateValue: 'applied' | 'ignored',
    anomaly: string | null, canonical: string, attempts = 1, receivedAt = lastTime(order)) => {
    const number = rows.length + 1;
    rows.push(Object.freeze({ anomaly, attempts, canonical, connection, eventType, externalId: `ITHT-WEBHOOK-${String(number).padStart(6, '0')}`,
      id: `itht:webhook:${String(number).padStart(6, '0')}`, order, provider, receivedAt, state: stateValue }));
  };
  for (const payment of state.payments) add(payment.order, 'itht:connection:payment', 'mock-payment', 'payment.succeeded', 'applied', null,
    `payment:${payment.paymentId}`);
  for (const fulfillment of state.fulfillments) {
    add(fulfillment.order, 'itht:connection:supplier', 'mock-supplier', 'supplier.accepted', 'applied', null, `supplier:${fulfillment.id}`);
    if (fulfillment.order.times.shippedAt) add(fulfillment.order, 'itht:connection:logistics', 'mock-logistics', 'logistics.shipped', 'applied', null,
      `logistics:${fulfillment.id}`, 1, fulfillment.order.times.shippedAt);
  }
  state.payments.filter(({ refundId }) => refundId).forEach((payment, index) => add(payment.order, 'itht:connection:payment', 'mock-payment', 'refund.succeeded',
    'applied', null, `refund:${payment.refundId}`, index < 5 ? 2 : 1, payment.order.times.refundedAt!));
  for (let index = 0; index < 10; index += 1) {
    const payment = state.payments[index]!;
    add(payment.order, 'itht:connection:payment', 'mock-payment', 'payment.succeeded', 'ignored', 'duplicate_payment_notification',
      `payment:${payment.paymentId}`, 1, plusMinutes(payment.order.times.paidAt!, 2));
  }
  for (let index = 0; index < 10; index += 1) {
    const fulfillment = state.fulfillments[index]!;
    add(fulfillment.order, 'itht:connection:supplier', 'mock-supplier', 'supplier.accepted', 'ignored', 'duplicate_supplier_callback',
      `supplier:${fulfillment.id}`, 1, plusMinutes(fulfillment.order.times.acceptedAt!, 2));
  }
  const shipped = state.fulfillments.filter((fulfillment) => fulfillment.order.times.shippedAt).slice(0, 20);
  for (const fulfillment of shipped) add(fulfillment.order, 'itht:connection:logistics', 'mock-logistics', 'logistics.accepted', 'ignored',
    'out_of_order_status', `logistics:${fulfillment.id}`, 1, plusMinutes(fulfillment.order.times.shippedAt!, 5));
  return rows;
}

function buildTenders(order: OrderFixture, benefit: BenefitFixture, voucher: VoucherFixture | null): readonly TenderFixture[] {
  const result: TenderFixture[] = [];
  let remaining = order.totalMinor;
  if (voucher) {
    const voucherAmount = Math.min(remaining, voucher.index <= 90 ? voucher.initialMinor : Math.max(1, Math.floor(voucher.initialMinor / 2)));
    result.push(Object.freeze({ amountMinor: voucherAmount, kind: 'voucher', referenceId: voucher.id }));
    remaining -= voucherAmount;
  }
  if (order.paymentBucket === 'mock_cash') {
    if (remaining > 0) result.push(Object.freeze({ amountMinor: remaining, kind: 'wechat', referenceId: null }));
  } else if (order.paymentBucket === 'internal_cash') {
    const benefitAmount = Math.max(1, Math.floor(remaining * 0.6));
    if (benefitAmount > 0) result.push(Object.freeze({ amountMinor: benefitAmount, kind: 'benefit', referenceId: benefit.accountId }));
    if (remaining - benefitAmount > 0) result.push(Object.freeze({ amountMinor: remaining - benefitAmount, kind: 'wechat', referenceId: null }));
  } else if (remaining > 0) result.push(Object.freeze({ amountMinor: remaining, kind: 'benefit', referenceId: benefit.accountId }));
  if (result.length === 0 || result.reduce((sum, tender) => sum + tender.amountMinor, 0) !== order.totalMinor) throw new Error('INTERNAL_DATASET_TENDER_ALLOCATION_INVALID');
  return Object.freeze(result);
}

function allocateRefund(amountMinor: number, tenders: readonly TenderFixture[]): readonly TenderFixture[] {
  let remaining = amountMinor;
  const result: TenderFixture[] = [];
  for (const tender of tenders) {
    const amount = Math.min(remaining, tender.amountMinor);
    if (amount > 0) result.push(Object.freeze({ ...tender, amountMinor: amount }));
    remaining -= amount;
    if (remaining === 0) break;
  }
  if (remaining !== 0) throw new Error('INTERNAL_DATASET_REFUND_TENDER_ALLOCATION_INVALID');
  return Object.freeze(result);
}

function orderStates(order: OrderFixture): Readonly<{ aftersale: string; fulfillment: string; lifecycle: string; payment: string }> {
  switch (order.status) {
    case 'completed_physical': return { aftersale: 'none', fulfillment: 'delivered', lifecycle: 'completed', payment: 'paid' };
    case 'redeemed': return { aftersale: 'none', fulfillment: 'delivered', lifecycle: 'completed', payment: 'paid' };
    case 'shipped': return { aftersale: 'none', fulfillment: 'shipped', lifecycle: 'active', payment: 'paid' };
    case 'paid_pending': return { aftersale: 'none', fulfillment: 'allocated', lifecycle: 'active', payment: 'paid' };
    case 'cancelled': return { aftersale: 'none', fulfillment: 'cancelled', lifecycle: 'cancelled', payment: 'unpaid' };
    case 'full_refund': return { aftersale: 'resolved', fulfillment: order.fulfillmentKind === 'shipment' ? 'cancelled' : 'delivered', lifecycle: 'closed', payment: 'refunded' };
    case 'partial_refund': return { aftersale: 'resolved', fulfillment: 'returned', lifecycle: 'completed', payment: 'partially_refunded' };
  }
}

function suborderState(order: OrderFixture): string {
  if (order.status === 'cancelled' || (order.status === 'full_refund' && order.fulfillmentKind === 'shipment')) return 'cancelled';
  if (['completed_physical', 'redeemed', 'partial_refund'].includes(order.status)) return 'completed';
  if (order.status === 'shipped') return 'processing';
  return 'pending';
}

function fulfillmentState(order: OrderFixture): string {
  if (order.status === 'full_refund' && order.fulfillmentKind === 'shipment') return 'cancelled';
  if (['completed_physical', 'redeemed', 'partial_refund'].includes(order.status) || (order.status === 'full_refund' && order.fulfillmentKind !== 'shipment')) return 'completed';
  if (order.status === 'shipped') return 'processing';
  return 'pending';
}

function providerForFulfillment(order: OrderFixture): string {
  return order.fulfillmentKind === 'shipment' ? 'mock-supplier' : order.fulfillmentKind === 'digital' ? 'mock-voucher' : 'mock-store';
}

function providerFor(kind: TenderFixture['kind']): string {
  return kind === 'wechat' ? 'mock-wechat' : kind === 'benefit' ? 'mock-benefit' : 'mock-voucher';
}

function tenderId(kind: TenderFixture['kind']): string {
  return `itht:tender:${kind}`;
}

function plusMinutes(value: string, minutes: number): string {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

function lastTime(order: OrderFixture): string {
  return order.times.refundedAt ?? order.times.completedAt ?? order.times.shippedAt ?? order.times.redeemedAt ?? order.times.paidAt ?? order.times.cancelledAt ?? order.times.createdAt;
}
