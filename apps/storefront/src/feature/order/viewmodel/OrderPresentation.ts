import { presentProduct, type PresentedProduct, type Product } from '../../../entity/product';
import type { Order } from '../model/Order';
import { orderStatusText } from '../model/OrderText';

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
