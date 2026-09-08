import type { OperationOutputFor } from '@shop/contract';
import type { PresentedProduct, Product, ProductKind, ProductSku } from '../model/Product';
export type ProductDto = OperationOutputFor<'storefront.catalog.read'>['items'][number];
export function mapProduct(item: ProductDto): Product {
  const priceMinor = item.price?.amountMinor ?? 0;
  const compareMinor = item.price?.compareMinor ?? priceMinor;
  const available = item.availability?.available ?? 0;
  const state = item.availability?.state ?? 'unavailable';
  const detail = object(item.attributes.detail);
  const images = Object.freeze(unique([item.coverUrl, ...texts(item.attributes.images), ...texts(detail.images), ...texts(detail.gallery)]).filter(safeMedia));
  const specifications = specificationValues(item.specifications);
  const params = parameters(detail.parameters);
  const accounts = Object.freeze(texts(detail.allowedAccounts ?? item.attributes.allowedAccounts).filter(isAccount));
  const description = text(detail.description ?? item.attributes.description);
  const qualification = Object.freeze({ eligible: item.qualification?.eligible ?? null, policyVersion: item.qualification?.policyVersion ?? null });
  const saleability = Object.freeze({ state: item.saleability.state, reasons: Object.freeze([...item.saleability.reasons]) });
  const sku: ProductSku = Object.freeze({
    id: item.sku,
    listingId: item.id,
    productId: item.product,
    priceMinor,
    compareMinor: item.price?.compareMinor ?? null,
    currency: item.price?.currency ?? 'CNY',
    available,
    state,
    priceVersion: item.price?.version ?? 'unavailable',
    inventoryVersion: item.availability?.version ?? 'unavailable',
    qualification,
    saleability,
    specifications,
  });
  return Object.freeze({
    listingId: item.id,
    productId: item.product,
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
    brand: text(detail.brandName ?? item.attributes.brandName) ?? '',
    tags: Object.freeze(unique([...texts(item.attributes.tags), ...texts(detail.tags)])),
    supplierId: item.supplierId ?? '',
    supplierName: text(detail.supplierName ?? item.attributes.supplierName) ?? '',
    itemType: mapProductKind(item.kind, item.category.code),
    allowedAccounts: accounts,
    stock: available,
    salesCount: count(detail.salesCount ?? item.attributes.salesCount),
    rating: decimal(detail.rating ?? item.attributes.rating),
    reviewCount: count(detail.reviewCount ?? item.attributes.reviewCount),
    deliverySla: text(detail.deliverySla ?? item.attributes.deliverySla) ?? '',
    qualification,
    saleability,
    version: item.version,
    updatedAt: item.updatedAt,
    skus: Object.freeze([sku]),
    ...(Object.keys(specifications).length ? { specs: specificationsFrom([sku]) } : {}),
    ...(params.length ? { params } : {}),
    ...(description ? { descriptionDetailText: Object.freeze([description]) } : {}),
    ...(item.attributes.enterpriseExclusive === true || detail.enterpriseExclusive === true ? { isEnterpriseExclusive: true } : {}),
    ...(item.attributes.dailySpecial === true || detail.dailySpecial === true ? { isDailySpecial: true } : {}),
    ...(item.attributes.hotRedeem === true || detail.hotRedeem === true ? { isHotRedeem: true } : {}),
    ...(item.attributes.newArrival === true || detail.newArrival === true ? { isNewArrival: true } : {}),
  });
}
export function mapProductDetail(items: readonly ProductDto[]): Product | null {
  const products = items.map(mapProduct);
  if (products.length === 0) return null;
  const skus = Object.freeze(products.flatMap((product) => product.skus));
  const selected = products.find(({ saleability }) => saleability.state === 'saleable') ?? products[0]!;
  return Object.freeze({ ...selected, skus, specs: specificationsFrom(skus) });
}

export function selectProductSku(product: Product, skuId: string): Product {
  const sku = product.skus.find(({ id }) => id === skuId) ?? product.skus[0];
  if (!sku) return product;
  return Object.freeze({
    ...product,
    listingId: sku.listingId,
    productId: sku.productId,
    skuId: sku.id,
    priceMarketMinor: sku.compareMinor ?? sku.priceMinor,
    priceMallMinor: sku.priceMinor,
    priceWelfareMinor: sku.priceMinor,
    currency: sku.currency,
    stock: sku.available,
    qualification: sku.qualification,
    saleability: sku.saleability,
  });
}

export function presentProduct(product: Product): PresentedProduct {
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

export function mapProductKind(value: string, category: string): ProductKind {
  const normalized = category.toLowerCase();
  if (value === 'physical') return normalized.includes('supermarket') ? 'supermarket' : 'physical';
  if (value === 'voucher') return 'virtual_coupon';
  if (normalized.includes('movie')) return 'movie_ticket';
  if (normalized.includes('nearby') || normalized.includes('store')) return 'nearby_store';
  if (value === 'service') return 'life_service';
  return 'unknown';
}

function specificationValues(value: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(Object.entries(value).flatMap(([name, raw]) => {
    const selected = scalar(Array.isArray(raw) ? raw[0] : raw);
    return selected === null ? [] : [[name, selected]];
  })));
}

function specificationsFrom(skus: readonly ProductSku[]): readonly Readonly<{ name: string; options: readonly string[] }>[] {
  const options = new Map<string, Set<string>>();
  for (const sku of skus) for (const [name, value] of Object.entries(sku.specifications)) (options.get(name) ?? options.set(name, new Set()).get(name)!).add(value);
  return Object.freeze([...options].map(([name, values]) => Object.freeze({ name, options: Object.freeze([...values]) })));
}

function parameters(value: unknown): readonly Readonly<{ key: string; value: string }>[] {
  return Object.freeze(Object.entries(object(value)).flatMap(([key, raw]) => {
    const normalized = scalar(raw);
    return normalized === null ? [] : [Object.freeze({ key, value: normalized })];
  }));
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : Object.freeze({});
}
function texts(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  return Array.isArray(value) ? value.flatMap((item) => (typeof item === 'string' && item.trim() ? [item.trim()] : [])) : [];
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
function isAccount(value: string): value is Product['allowedAccounts'][number] {
  return ['welfare', 'meal', 'wechat', 'cash'].includes(value);
}
function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function decimal(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}
