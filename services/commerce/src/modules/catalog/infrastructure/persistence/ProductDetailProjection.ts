import type { ProductDetailBase } from '../../application/port/ProductRepository';

type ProductListing = ProductDetailBase['listings'][number];
type ProductChannel = ProductDetailBase['channels'][number];
type Instant = string | Date;

export interface ProductDetailRow extends Omit<ProductDetailBase, 'createdAt' | 'updatedAt' | 'listings' | 'channels' | 'media' | 'regionIds' | 'timeline' | 'visibleScopes'> {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly listings: readonly Readonly<
    Omit<ProductListing, 'effectiveAt' | 'expiresAt' | 'createdAt' | 'updatedAt'> & {
      readonly effectiveAt: Instant | null;
      readonly expiresAt: Instant | null;
      readonly createdAt: Instant;
      readonly updatedAt: Instant;
    }
  >[];
  readonly channels: readonly Readonly<Omit<ProductChannel, 'observedAt'> & { readonly observedAt: Instant }>[];
}

type NormalizedProductDetail = Omit<ProductDetailRow, 'createdAt' | 'updatedAt' | 'listings' | 'channels'> & Pick<ProductDetailBase, 'createdAt' | 'updatedAt' | 'listings' | 'channels'>;

export function projectProductDetail(product: ProductDetailRow, allowedScopes: readonly string[]): ProductDetailBase {
  const normalized = normalizeProductDetail(product);
  const media = productMedia(normalized.attributes, normalized.cover_url, normalized.title);
  const regionIds = textArray(normalized.attributes.regionIds);
  const timeline = productTimeline(normalized);
  const { attributes: _attributes, ...visible } = normalized;
  return Object.freeze({ ...visible, media, regionIds, timeline, visibleScopes: Object.freeze([...allowedScopes]) });
}

function productMedia(attributes: Readonly<Record<string, unknown>>, cover: string | null, title: string): ProductDetailBase['media'] {
  const candidates = Array.isArray(attributes.media) ? attributes.media : [];
  const values = candidates.flatMap((candidate, index) => {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const item = candidate as Readonly<Record<string, unknown>>;
    const kind = item.kind;
    const url = typeof item.url === 'string' && safeMediaUrl(item.url) ? item.url : null;
    if ((kind !== 'image' && kind !== 'video' && kind !== 'document') || url === null) return [];
    return [Object.freeze({ id: typeof item.id === 'string' && item.id !== '' ? item.id : `media:${index + 1}`, kind, url, alt: typeof item.alt === 'string' ? item.alt : null, sort: positiveInteger(item.sort, index) })];
  });
  if (cover !== null && safeMediaUrl(cover) && !values.some(({ url }) => url === cover)) values.unshift(Object.freeze({ id: 'media:cover', kind: 'image', url: cover, alt: title, sort: 0 }));
  return Object.freeze(values.sort((left, right) => left.sort - right.sort || left.id.localeCompare(right.id)));
}

function normalizeProductDetail(product: ProductDetailRow): NormalizedProductDetail {
  const listings = Object.freeze(
    product.listings.map((listing) =>
      Object.freeze({
        ...listing,
        effectiveAt: nullableIsoInstant(listing.effectiveAt),
        expiresAt: nullableIsoInstant(listing.expiresAt),
        createdAt: isoInstant(listing.createdAt),
        updatedAt: isoInstant(listing.updatedAt),
      })
    )
  );
  const channels = Object.freeze(product.channels.map((channel) => Object.freeze({ ...channel, observedAt: isoInstant(channel.observedAt) })));
  return Object.freeze({ ...product, createdAt: isoInstant(product.createdAt), updatedAt: isoInstant(product.updatedAt), listings, channels });
}

function productTimeline(product: Pick<ProductDetailBase, 'id' | 'createdAt' | 'updatedAt' | 'listings' | 'channels'>): ProductDetailBase['timeline'] {
  const values: ProductDetailBase['timeline'][number][] = [
    Object.freeze({ id: `timeline:productcreated:${product.id}`, kind: 'productcreated', title: '商品主档已创建', occurredAt: product.createdAt, reference: product.id }),
    Object.freeze({ id: `timeline:productupdated:${product.id}`, kind: 'productupdated', title: '商品主档已更新', occurredAt: product.updatedAt, reference: product.id }),
    ...product.listings.flatMap((listing) => [
      Object.freeze({ id: `timeline:listingcreated:${listing.id}`, kind: 'listingcreated' as const, title: '商城投放已创建', occurredAt: listing.createdAt, reference: listing.id }),
      Object.freeze({ id: `timeline:listingupdated:${listing.id}`, kind: 'listingupdated' as const, title: '商城投放已更新', occurredAt: listing.updatedAt, reference: listing.id }),
    ]),
    ...product.channels.map((channel) =>
      Object.freeze({ id: `timeline:sourceobserved:${channel.provider}:${channel.externalId}`, kind: 'sourceobserved' as const, title: '渠道来源已同步', occurredAt: channel.observedAt, reference: channel.externalId })
    ),
  ];
  return Object.freeze(values.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id)));
}

function nullableIsoInstant(value: Instant | null): string | null {
  return value === null ? null : isoInstant(value);
}

function isoInstant(value: Instant): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('CATALOG_PRODUCT_INVALID_INSTANT');
  return date.toISOString();
}

function textArray(value: unknown): readonly string[] {
  return Object.freeze(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : []);
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function safeMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
