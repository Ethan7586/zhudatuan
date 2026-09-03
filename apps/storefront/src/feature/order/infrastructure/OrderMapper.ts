import type { OperationOutputFor } from '@shop/contract';
import type { PresentedProduct, Product } from '../../../entity/product';
import type { EnterpriseMall } from '../../account/model/Profile';
import type { Order, OrderStatus } from '../model/Order';
import type { Timeline } from '../model/Timeline';
import { mapProductKind, presentProduct } from '../../../entity/product';
import { orderStatusText } from '../model/OrderText';

type OrderDto = OperationOutputFor<'order.orders.read'>['items'][number];

export type FrontendOrderLine = Order['lines'][number] & { readonly product: PresentedProduct; readonly priceAtPurchase: number };
export type FrontendOrder = Order & {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly createdAt: string;
  readonly createTime: string;
  readonly totalAmount: number;
  readonly statusText: string;
  readonly items: readonly FrontendOrderLine[];
};

export function mapOrder(item: OrderDto, mall: EnterpriseMall, timeline: readonly Timeline[] = []): Order {
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
    lines: Object.freeze(
      item.lines.map((line) =>
        Object.freeze({
          id: line.id,
          productId: line.listing,
          listingId: line.listing,
          skuId: line.sku,
          title: line.title,
          image: '',
          unitMinor: line.unitMinor,
          totalMinor: line.totalMinor,
          discountMinor: line.discountMinor,
          payableMinor: line.payableMinor,
          quantity: line.quantity,
          categoryId: line.category,
          itemType: mapProductKind(line.productType, line.category),
          provider: line.provider,
          partner: line.partner,
        })
      )
    ),
    timeline: Object.freeze([...timeline]),
    version: Number(item.version),
  });
}

export function mapOrders(value: OperationOutputFor<'order.orders.read'>, mall: EnterpriseMall): readonly Order[] {
  return Object.freeze(value.items.map((item) => mapOrder(item, mall)));
}

export function mapTimeline(value: OperationOutputFor<'fulfillment.tracking.read'>): readonly Timeline[] {
  return Object.freeze(
    value.items.flatMap((item) =>
      item.milestones.map((milestone) =>
        Object.freeze({
          id: milestone.id,
          kind: milestone.kind,
          state: milestone.state,
          tracking: milestone.tracking,
          occurredAt: milestone.occurredAt,
          evidence: Object.freeze(isRecord(milestone.evidence) ? milestone.evidence : {}),
        })
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function toFrontendOrders(orders: readonly Order[], products: readonly PresentedProduct[]): readonly FrontendOrder[] {
  return Object.freeze(
    orders.map((order) =>
      Object.freeze({
        ...order,
        orderId: order.id,
        orderNumber: order.orderNo,
        createTime: order.createdAt,
        totalAmount: order.totalMinor / 100,
        statusText: orderStatusText(order.status),
        items: Object.freeze(
          order.lines.map((line) => {
            const product = products.find((candidate) => candidate.id === line.productId) ?? orderSnapshot(order, line);
            return Object.freeze({ ...line, product, priceAtPurchase: line.unitMinor / 100 });
          })
        ),
      })
    )
  );
}

function orderSnapshot(order: Order, line: Order['lines'][number]): PresentedProduct {
  const fulfillmentParty = line.partner ?? line.provider ?? '';
  const category = line.categoryId === 'unknown' ? '未记录分类' : line.categoryId;
  const product: Product = Object.freeze({
    id: line.productId,
    skuId: line.skuId,
    title: line.title,
    subtitle: '订单创建时商品快照',
    images: Object.freeze(line.image ? [line.image] : []),
    priceMarketMinor: line.unitMinor,
    priceMallMinor: line.unitMinor,
    priceWelfareMinor: line.unitMinor,
    currency: order.currency,
    categoryId: line.categoryId,
    categoryName: category,
    brand: '',
    tags: Object.freeze([]),
    supplierId: fulfillmentParty,
    supplierName: '',
    itemType: line.itemType,
    allowedAccounts: Object.freeze([]),
    stock: 0,
    salesCount: 0,
    rating: 0,
    reviewCount: 0,
    deliverySla: '以订单履约记录为准',
    purchasable: false,
    version: `order:${order.version}`,
    updatedAt: order.updatedAt,
    skus: Object.freeze([]),
  });
  return presentProduct(product);
}
