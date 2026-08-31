import type { OperationOutputFor } from '@shop/contract';
import type { PresentedProduct, ProductItemType, ProductView } from '../runtime/StorefrontPort';

export type ProductDto = OperationOutputFor<'storefront.catalog.read'>['items'][number];

export function mapProduct(item: ProductDto): ProductView {
  const priceMinor = item.price?.amountMinor ?? 0;
  const compareMinor = item.price?.compareMinor ?? priceMinor;
  const available = item.availability?.available ?? 0;
  const state = item.availability?.state ?? 'unavailable';
  const detail = object(item.attributes.detail);
  const images = Object.freeze(unique([item.coverUrl, ...texts(item.attributes.images), ...texts(detail.images), ...texts(detail.gallery)]).filter(safeMedia));
  const specifications = Object.freeze(
    Object.entries(item.specifications).flatMap(([name, value]) => {
      const options = texts(value);
      return options.length > 0 ? [Object.freeze({ name, options: Object.freeze(options) })] : [];
    })
  );
  const parameters = object(detail.parameters);
  const params = Object.freeze(
    Object.entries(parameters).flatMap(([key, value]) => {
      const normalized = scalar(value);
      return normalized === null ? [] : [Object.freeze({ key, value: normalized })];
    })
  );
  const accounts = Object.freeze(texts(detail.allowedAccounts ?? item.attributes.allowedAccounts).filter(isAccount));
  const description = text(detail.description ?? item.attributes.description);
  const sku = Object.freeze({
    id: item.sku,
    productId: item.product,
    priceMinor,
    compareMinor: item.price?.compareMinor ?? null,
    currency: item.price?.currency ?? 'CNY',
    available,
    state,
    priceVersion: item.price?.version ?? 'unavailable',
    inventoryVersion: item.availability?.version ?? 'unavailable',
  });
  return Object.freeze({
    id: item.id,
    skuId: item.sku,
    title: item.title,
    subtitle: item.subtitle ?? '',
    images,
    priceMarketMinor: compareMinor,
    priceMallMinor: priceMinor,
    priceWelfareMinor: priceMinor,
    currency: item.price?.currency ?? 'CNY',
    categoryId: item.category.id,
    categoryName: item.category.name,
    brand: '',
    tags: Object.freeze(unique([...texts(item.attributes.tags), ...texts(detail.tags)])),
    supplierId: item.supplierId ?? '',
    supplierName: '',
    itemType: mapProductKind(item.kind, item.category.code),
    allowedAccounts: accounts,
    stock: available,
    salesCount: count(detail.salesCount ?? item.attributes.salesCount),
    rating: decimal(detail.rating ?? item.attributes.rating),
    reviewCount: count(detail.reviewCount ?? item.attributes.reviewCount),
    deliverySla: text(detail.deliverySla ?? item.attributes.deliverySla) ?? '',
    purchasable: Boolean(item.price && state === 'available'),
    version: item.version,
    updatedAt: item.updatedAt,
    skus: Object.freeze([sku]),
    ...(specifications.length ? { specs: specifications } : {}),
    ...(params.length ? { params } : {}),
    ...(description ? { descriptionDetailText: Object.freeze([description]) } : {}),
    ...(item.attributes.enterpriseExclusive === true ? { isEnterpriseExclusive: true } : {}),
    ...(item.attributes.dailySpecial === true ? { isDailySpecial: true } : {}),
    ...(item.attributes.hotRedeem === true ? { isHotRedeem: true } : {}),
    ...(item.attributes.newArrival === true ? { isNewArrival: true } : {}),
  });
}

export function presentProduct(product: ProductView): PresentedProduct {
  const primaryImage = product.images[0] ?? '';
  const price = product.priceWelfareMinor / 100;
  const market = product.priceMarketMinor / 100;
  return Object.freeze({
    ...product,
    imageUrl: primaryImage,
    image: primaryImage,
    gallery: Object.freeze(product.images.slice(1)),
    price,
    originalPrice: market,
    enterpriseSubsidyAmount: Math.max(0, (product.priceMarketMinor - product.priceWelfareMinor) / 100),
    stockCount: product.stock,
    description: product.descriptionDetailText?.join(' ') ?? product.subtitle,
    parameters: Object.freeze(Object.fromEntries((product.params ?? []).map(({ key, value }) => [key, value]))),
    specOptions: Object.freeze(Object.fromEntries((product.specs ?? []).map(({ name, options }) => [name, options]))),
    allowMealCard: product.allowedAccounts.includes('meal'),
    isEnterpriseSubsidized: Boolean(product.isEnterpriseExclusive),
    welfarePrice: price,
    marketPrice: market,
    salesVolume: product.salesCount,
    applicableStoreName: product.nearbyStoreInfo?.storeName ?? product.supplierName,
    category: product.categoryName,
  });
}

export function mapProductKind(value: string, category: string): ProductItemType {
  const normalized = category.toLowerCase();
  if (value === 'physical') return normalized.includes('supermarket') ? 'supermarket' : 'physical';
  if (value === 'voucher') return 'virtual_coupon';
  if (normalized.includes('movie')) return 'movie_ticket';
  if (normalized.includes('nearby') || normalized.includes('store')) return 'nearby_store';
  if (value === 'service') return 'life_service';
  return 'unknown';
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : Object.freeze({});
}

function texts(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === 'string' && item.trim() ? [item.trim()] : []));
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function scalar(value: unknown): string | null {
  return typeof value === 'string' ? text(value) : typeof value === 'number' || typeof value === 'boolean' ? String(value) : null;
}

function unique(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function safeMedia(value: string): boolean {
  return /^(?:https?:\/\/|\/(?!\/))/.test(value);
}

function isAccount(value: string): value is ProductView['allowedAccounts'][number] {
  return ['welfare', 'meal', 'wechat', 'cash'].includes(value);
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function decimal(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}
