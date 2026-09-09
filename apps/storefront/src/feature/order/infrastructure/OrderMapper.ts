import type { OperationOutputFor } from '@shop/contract';
import type { EnterpriseMall } from '../../account';
import type { Order, OrderStatus } from '../model/Order';
import type { Timeline } from '../model/Timeline';
import { mapProductKind } from '../../../entity/product';

type OrderDto = OperationOutputFor<'order.orders.read'>['items'][number];
type OrderDetailDto = OperationOutputFor<'order.detail.read'>;

export function mapOrder(item: OrderDto, mall: EnterpriseMall, timeline: readonly Timeline[] = []): Order {
  const fulfillmentTimeline = item.fulfillments.flatMap((value) => value.milestones.map(mapMilestone));
  return Object.freeze({
    id: item.id,
    orderNo: item.order_number,
    enterpriseId: mall.enterpriseId,
    enterpriseName: mall.enterpriseName,
    mallId: item.mall_id,
    mallName: mall.mallName,
    status: mapStatus(item.lifecycle_state, item.aftersale_state),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    currency: item.currency,
    totalMinor: item.total_minor,
    paymentState: item.payment_state,
    fulfillmentState: item.fulfillment_state,
    aftersaleState: item.aftersale_state,
    lifecycleState: item.lifecycle_state,
    lines: Object.freeze(item.lines.map(mapLine)),
    timeline: mergeTimeline(fulfillmentTimeline, timeline),
    audit: Object.freeze(item.timeline.map(mapAudit)),
    receivedAt: item.receivedAt,
    sourceChannel: null,
    externalOrderNo: null,
    payment: Object.freeze({ id: item.payment.paymentId, capturedMinor: item.payment.capturedMinor, refundedMinor: item.payment.refundedMinor, refundableMinor: item.payment.refundableMinor }),
    sections: allReady(),
    version: Number(item.version),
  });
}

export function mapOrderDetail(value: OrderDetailDto, mall: EnterpriseMall, tracking: OperationOutputFor<'fulfillment.tracking.read'> | null = null): Order {
  const lines = value.products.state === 'ready' ? value.products.data : [];
  const payment = value.payment.state === 'ready' ? value.payment.data : undefined;
  const fulfillments = value.fulfillment.state === 'ready' ? value.fulfillment.data : [];
  const timeline = fulfillments.flatMap((item) => item.milestones.map(mapMilestone));
  const tracked = tracking ? mapTimeline(tracking) : Object.freeze([]);
  return Object.freeze({
    id: value.summary.id,
    orderNo: value.summary.orderNumber,
    enterpriseId: mall.enterpriseId,
    enterpriseName: mall.enterpriseName,
    mallId: value.summary.mallId,
    mallName: mall.mallName,
    status: mapStatus(value.summary.lifecycleState, value.summary.aftersaleState),
    createdAt: value.summary.createdAt,
    updatedAt: value.summary.updatedAt,
    currency: value.summary.currency,
    totalMinor: value.summary.totalMinor,
    paymentState: value.summary.paymentState,
    fulfillmentState: value.summary.fulfillmentState,
    aftersaleState: value.summary.aftersaleState,
    lifecycleState: value.summary.lifecycleState,
    lines: Object.freeze(lines.map(mapLine)),
    timeline: mergeTimeline(timeline, tracked),
    audit: Object.freeze(value.audit.state === 'ready' ? value.audit.data.map(mapAudit) : []),
    ...(value.summary.address === null
      ? {}
      : { address: { recipient: value.summary.address.recipientMasked, mobile: value.summary.address.mobileMasked, detail: value.summary.address.addressMasked, regionCode: value.summary.address.regionCode } }),
    receivedAt: value.summary.receivedAt,
    sourceChannel: value.summary.sourceChannel,
    externalOrderNo: value.summary.externalOrderNo,
    payment: payment ? Object.freeze({ id: payment.paymentId, capturedMinor: payment.capturedMinor, refundedMinor: payment.refundedMinor, refundableMinor: payment.refundableMinor }) : null,
    sections: Object.freeze({
      products: section(value.products),
      payment: section(value.payment),
      fulfillment: tracked.length > 0 ? Object.freeze({ state: 'ready' as const }) : section(value.fulfillment),
      aftersale: section(value.aftersale),
      audit: section(value.audit),
    }),
    version: Number(value.summary.version),
  });
}

export function mapOrders(value: OperationOutputFor<'order.orders.read'>, mall: EnterpriseMall): readonly Order[] {
  return Object.freeze(value.items.map((item) => mapOrder(item, mall)));
}

export function mapTimeline(value: OperationOutputFor<'fulfillment.tracking.read'>): readonly Timeline[] {
  return Object.freeze(
    value.items.flatMap((item) =>
      item.shipments.flatMap((shipment) =>
        shipment.packages.flatMap((packaged) =>
          packaged.events.map((event) =>
            Object.freeze({
              id: event.id,
              kind: 'tracking',
              state: event.state,
              tracking: packaged.tracking,
              occurredAt: event.occurredAt,
              evidence: Object.freeze(isRecord(event.evidence) ? event.evidence : {}),
            })
          )
        )
      )
    )
  );
}

function mapStatus(lifecycle: string, aftersale: string): OrderStatus {
  if (!['none', 'resolved', 'rejected'].includes(aftersale)) return 'after_sale';
  if (lifecycle === 'awaitingpayment') return 'pending_payment';
  if (lifecycle === 'shipped') return 'pending_receipt';
  if (['completed', 'received', 'cancelled'].includes(lifecycle)) return 'completed';
  return 'pending_shipment';
}

function mapLine(line: OrderDto['lines'][number]) {
  return Object.freeze({
    id: line.id,
    productId: line.listing,
    listingId: line.listing,
    skuId: line.sku,
    title: line.title,
    image: line.image ?? '',
    unitMinor: line.unitMinor,
    totalMinor: line.totalMinor,
    discountMinor: line.discountMinor,
    payableMinor: line.payableMinor,
    quantity: line.quantity,
    categoryId: line.category,
    itemType: mapProductKind(line.productType, line.category),
    provider: line.provider,
    partner: line.partner,
    partnerName: line.partnerName,
  });
}

function mapMilestone(value: OrderDto['fulfillments'][number]['milestones'][number]): Timeline {
  return Object.freeze({ id: value.id, kind: value.kind, state: value.state, tracking: value.trackingMasked, occurredAt: value.occurredAt, evidence: Object.freeze({}) });
}

function mapAudit(value: OrderDto['timeline'][number]) {
  return Object.freeze({ id: value.id, action: value.action, resourceType: value.resourceType, resource: value.resourceMasked, actor: value.actorName, occurredAt: value.occurredAt });
}

function mergeTimeline(...groups: readonly (readonly Timeline[])[]): readonly Timeline[] {
  const values = new Map<string, Timeline>();
  for (const group of groups) for (const item of group) values.set(item.id, item);
  return Object.freeze([...values.values()].sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.id.localeCompare(right.id)));
}

function section(value: Readonly<{ state: string; error?: Readonly<{ message: string; retryable: boolean }> }>) {
  return Object.freeze(value.state === 'unavailable' ? { state: 'unavailable' as const, message: value.error?.message ?? '暂时无法读取此部分', retryable: value.error?.retryable ?? false } : { state: value.state as 'ready' | 'hidden' });
}

function allReady() {
  const ready = Object.freeze({ state: 'ready' as const });
  return Object.freeze({ products: ready, payment: ready, fulfillment: ready, aftersale: ready, audit: ready });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
