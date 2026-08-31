import type { ProductSku } from './ProductSku';

export type WelfareAccountType = 'welfare' | 'meal' | 'wechat' | 'cash';
export type ProductItemType = 'physical' | 'virtual_coupon' | 'movie_ticket' | 'supermarket' | 'life_service' | 'nearby_store' | 'unknown';

export interface ProductParam {
  readonly key: string;
  readonly value: string;
}
export interface ProductSpec {
  readonly name: string;
  readonly options: readonly string[];
}
export interface NearbyStoreInfo {
  readonly storeName: string;
  readonly address: string;
  readonly distance: string;
  readonly businessHours: string;
  readonly phone: string;
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
  readonly itemType: ProductItemType;
  readonly allowedAccounts: readonly WelfareAccountType[];
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
  readonly specs?: readonly ProductSpec[];
  readonly params?: readonly ProductParam[];
  readonly descriptionHtml?: string;
  readonly descriptionDetailText?: readonly string[];
  readonly nearbyStoreInfo?: NearbyStoreInfo;
}

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly iconName: string;
  readonly hotKeywords: readonly string[];
  readonly children?: readonly Readonly<{ id: string; name: string; items: readonly string[] }>[];
}
