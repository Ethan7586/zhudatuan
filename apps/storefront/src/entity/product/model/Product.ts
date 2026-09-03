export type ProductKind = 'physical' | 'virtual_coupon' | 'movie_ticket' | 'supermarket' | 'life_service' | 'nearby_store' | 'unknown';
export type WelfareAccount = 'welfare' | 'meal' | 'wechat' | 'cash';

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

export interface Product {
  readonly id: string;
  readonly skuId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly images: readonly string[];
  readonly priceMarketMinor: number;
  readonly priceMallMinor: number;
  readonly priceWelfareMinor: number;
  readonly currency: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly subCategoryId?: string;
  readonly taxonomy?: Readonly<{ l1: string | null; l2: string | null; l3: string | null; status: string }>;
  readonly brand: string;
  readonly tags: readonly string[];
  readonly supplierId: string;
  readonly supplierName: string;
  readonly itemType: ProductKind;
  readonly allowedAccounts: readonly WelfareAccount[];
  readonly stock: number;
  readonly salesCount: number;
  readonly rating: number;
  readonly reviewCount: number;
  readonly deliverySla: string;
  readonly purchasable: boolean;
  readonly version: string;
  readonly updatedAt: string;
  readonly skus: readonly ProductSku[];
  readonly isEnterpriseExclusive?: boolean;
  readonly isDailySpecial?: boolean;
  readonly isHotRedeem?: boolean;
  readonly isNewArrival?: boolean;
  readonly qualificationReason?: string;
  readonly specs?: readonly Readonly<{ name: string; options: readonly string[] }>[];
  readonly params?: readonly Readonly<{ key: string; value: string }>[];
  readonly descriptionHtml?: string;
  readonly descriptionDetailText?: readonly string[];
  readonly nearbyStoreInfo?: Readonly<{ storeName: string; address: string; distance: string; businessHours: string; phone: string }>;
}

export type PresentedProduct = Product &
  Readonly<{
    imageUrl: string;
    image: string;
    gallery: readonly string[];
    price: number;
    originalPrice: number;
    enterpriseSubsidyAmount: number;
    stockCount: number;
    description: string;
    parameters: Readonly<Record<string, string>>;
    specOptions: Readonly<Record<string, readonly string[]>>;
    allowMealCard: boolean;
    isEnterpriseSubsidized: boolean;
    welfarePrice: number;
    marketPrice: number;
    salesVolume: number;
    applicableStoreName: string;
    category: string;
  }>;

export function inventoryStatus(stock: number) {
  if (stock <= 0) return Object.freeze({ canPurchase: false, actionButtonStateText: '暂时缺货', availabilityText: '无可售库存' });
  if (stock <= 5) return Object.freeze({ canPurchase: true, actionButtonStateText: '库存紧张', availabilityText: `仅余 ${stock} 件` });
  return Object.freeze({ canPurchase: true, actionButtonStateText: '立即购买', availabilityText: '库存充足' });
}
