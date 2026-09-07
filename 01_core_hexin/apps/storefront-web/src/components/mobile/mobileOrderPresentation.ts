import type { FrontendOrder, FrontendOrderItem, FrontendProduct } from '../../adapters/frontendData';

export type MobileInventoryStatus = 'available' | 'tight' | 'unavailable' | 'pending';

export interface MobileMerchantPackage {
  id: string;
  merchantName: string;
  items: FrontendOrderItem[];
  statusLabel: string;
  deliveryHint: string;
}

export function inventoryStatus(product: FrontendProduct): MobileInventoryStatus {
  if (!product.purchasable && product.stockCount === 0) return 'pending';
  if (product.stockCount <= 0) return 'unavailable';
  if (product.stockCount <= 8) return 'tight';
  return 'available';
}

export function groupOrderPackages(order: FrontendOrder): MobileMerchantPackage[] {
  const groups = new Map<string, FrontendOrderItem[]>();
  order.items.forEach((item) => {
    const merchantName = item.product.supplierName || order.supplierName || order.mallName;
    groups.set(merchantName, [...(groups.get(merchantName) ?? []), item]);
  });

  return [...groups.entries()].map(([merchantName, items], index) => ({
    id: `${order.id}-package-${index + 1}`,
    merchantName,
    items,
    statusLabel: packageStatusLabel(order.status),
    deliveryHint: packageDeliveryHint(order, index),
  }));
}

function packageStatusLabel(status: FrontendOrder['status']): string {
  if (status === 'pending_payment' || status === 'pending_pay') return '待付款';
  if (status === 'pending_shipment' || status === 'paid') return '备货中';
  if (status === 'pending_receipt' || status === 'shipping' || status === 'shipped') return '运输中';
  if (status === 'completed') return '已签收';
  return '售后处理中';
}

function packageDeliveryHint(order: FrontendOrder, index: number): string {
  if (order.trackingNo) return `${order.expressCompany || '承运方'} · ${order.trackingNo}`;
  if (order.status === 'pending_payment' || order.status === 'pending_pay') return '付款后由商户独立安排配送';
  if (order.status === 'completed') return '包裹已完成签收';
  if (order.status === 'after_sale') return '售后进度将同步到本包裹';
  return index === 0 ? '预计 24 小时内更新物流' : '等待商户确认发货时间';
}
