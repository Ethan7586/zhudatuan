import type { ProductDetailBase } from '../port/ProductRepository';

type Organization = Readonly<{ id: string; name: string }>;
type DetailListing = ProductDetailBase['listings'][number];
type DetailTimeline = ProductDetailBase['timeline'][number];

export interface ProductDetailLabels {
  readonly listings: readonly Readonly<DetailListing & { scopeName: string }>[];
  readonly timeline: readonly Readonly<DetailTimeline & { referenceLabel: string | null }>[];
  readonly sku: (id: unknown) => string;
  readonly scope: (id: unknown) => string;
  readonly location: (id: unknown) => string;
  readonly listing: (id: unknown) => string;
}

export function productDetailLabels(detail: ProductDetailBase, organizations: readonly Organization[]): ProductDetailLabels {
  const scopes = new Map(organizations.map(({ id, name }) => [id, name] as const));
  const skus = new Map(detail.skus.map(({ id, code }) => [id, code] as const));
  const pools = new Map(detail.pools.map(({ id, name }) => [id, name] as const));
  const listingNames = new Map(detail.listings.map(({ id, title }) => [id, title] as const));
  const scope = (id: unknown) => (typeof id === 'string' ? (scopes.get(id) ?? '当前商城') : '当前商城');
  const sku = (id: unknown) => (typeof id === 'string' ? (skus.get(id) ?? '标准规格') : '标准规格');
  const listing = (id: unknown) => (typeof id === 'string' ? (listingNames.get(id) ?? '当前商城投放') : '当前商城投放');
  const listings = Object.freeze(
    detail.listings.map((item) =>
      Object.freeze({
        ...item,
        scopeName: scope(item.scope),
        poolName: item.pool === null ? null : (item.poolName ?? pools.get(item.pool) ?? '已绑定商品池'),
        skuCode: item.skuCode || sku(item.sku),
      })
    )
  );
  const readableListings = new Map(listings.map((item) => [item.id, `${item.title} · ${item.scopeName}`] as const));
  const timeline = Object.freeze(
    detail.timeline.map((item) =>
      Object.freeze({
        ...item,
        referenceLabel: timelineLabel(item, detail.title, readableListings),
      })
    )
  );
  return Object.freeze({ listings, timeline, sku, scope, location: locationName, listing });
}

function timelineLabel(item: DetailTimeline, productTitle: string, listings: ReadonlyMap<string, string>): string | null {
  if (item.reference === null) return null;
  if (item.kind === 'productcreated' || item.kind === 'productupdated') return productTitle;
  if (item.kind === 'listingcreated' || item.kind === 'listingupdated') return listings.get(item.reference) ?? '当前商城投放';
  return `渠道商品 ${item.reference}`;
}

function locationName(value: unknown): string {
  if (typeof value !== 'string' || value === '' || value === 'default') return '默认仓库';
  if (value === 'sandbox:main' || value.endsWith(':main')) return '主仓库';
  if (value.endsWith(':backup')) return '备用仓库';
  if (/^[\p{Script=Han}\s·（）()]+$/u.test(value)) return value;
  return '商品仓库';
}
