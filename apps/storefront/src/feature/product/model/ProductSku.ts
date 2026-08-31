export interface ProductSku {
  readonly id: string;
  readonly productId: string;
  readonly priceMinor: number;
  readonly compareMinor: number | null;
  readonly currency: string;
  readonly available: number;
  readonly state: 'available' | 'unavailable';
  readonly priceVersion: string;
  readonly inventoryVersion: string;
}

export function inventoryStatus(stock: number) {
  if (stock <= 0) return Object.freeze({ canPurchase: false, actionButtonStateText: '暂时缺货', availabilityText: '无可售库存' });
  if (stock <= 5) return Object.freeze({ canPurchase: true, actionButtonStateText: '库存紧张', availabilityText: `仅余 ${stock} 件` });
  return Object.freeze({ canPurchase: true, actionButtonStateText: '立即购买', availabilityText: '库存充足' });
}
