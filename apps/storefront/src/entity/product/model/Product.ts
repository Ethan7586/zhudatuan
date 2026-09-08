import type { OperationOutputFor } from '@shop/contract';

type ProductDto = OperationOutputFor<'storefront.catalog.read'>['items'][number];

export type ProductKind = 'physical' | 'virtual_coupon' | 'movie_ticket' | 'supermarket' | 'life_service' | 'nearby_store' | 'unknown';
export type WelfareAccount = 'welfare' | 'meal' | 'wechat' | 'cash';
export type SaleabilityReason = ProductDto['saleability']['reasons'][number];

export interface ProductQualification {
  readonly eligible: boolean | null;
  readonly policyVersion: number | null;
}

export interface ProductSaleability {
  readonly state: ProductDto['saleability']['state'];
  readonly reasons: readonly SaleabilityReason[];
}

export interface ProductSku {
  readonly id: string;
  readonly listingId: string;
  readonly productId: string;
  readonly priceMinor: number;
  readonly compareMinor: number | null;
  readonly currency: string;
  readonly available: number;
  readonly state: NonNullable<ProductDto['availability']>['state'];
  readonly priceVersion: string;
  readonly inventoryVersion: string;
  readonly qualification: ProductQualification;
  readonly saleability: ProductSaleability;
  readonly specifications: Readonly<Record<string, string>>;
}

export interface Product {
  readonly listingId: string;
  readonly productId: string;
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
  readonly qualification: ProductQualification;
  readonly saleability: ProductSaleability;
  readonly version: string;
  readonly updatedAt: string;
  readonly skus: readonly ProductSku[];
  readonly isEnterpriseExclusive?: boolean;
  readonly isDailySpecial?: boolean;
  readonly isHotRedeem?: boolean;
  readonly isNewArrival?: boolean;
  readonly specs?: readonly Readonly<{ name: string; options: readonly string[] }>[];
  readonly params?: readonly Readonly<{ key: string; value: string }>[];
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

const REASON_TEXT: Readonly<Record<SaleabilityReason, string>> = Object.freeze({
  qualification_unavailable: '经营资格正在核验，请稍后刷新',
  qualification_failed: '当前商品不满足经营资格要求',
  price_unavailable: '当前报价暂不可用',
  inventory_unavailable: '库存状态暂不可用',
  out_of_stock: '暂时缺货',
});

export function productAvailability(product: Pick<Product, 'saleability' | 'stock'>) {
  const canPurchase = product.saleability.state === 'saleable';
  const messages = Object.freeze(product.saleability.reasons.map((reason) => REASON_TEXT[reason]));
  const availabilityText = canPurchase ? (product.stock <= 5 ? `库存紧张，仅余 ${product.stock} 件` : '价格、库存与经营资格均有效') : messages.join('；');
  return Object.freeze({ canPurchase, availabilityText, actionButtonStateText: canPurchase ? '立即购买' : messages[0] ?? '暂不可购买', messages });
}
