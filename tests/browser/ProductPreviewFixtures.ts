export const PRODUCT_PREVIEW_KIND = 'console-product-v1' as const;
export const PRODUCT_PREVIEW_TOTAL = 5_008;
export const PRODUCT_PREVIEW_AS_OF = '2026-08-24T13:18:00.000Z';

export type ProductPreviewTone = 'success' | 'warning' | 'info' | 'neutral';
export type ProductPreviewMallStatus = 'published' | 'pending' | 'unpublished';

export interface ProductPreviewSupplier {
  readonly id: string;
  readonly name: string;
}

export interface ProductPreviewMall {
  readonly id: string;
  readonly name: string;
  readonly status: ProductPreviewMallStatus;
  readonly priceCents: number | null;
}

export interface ProductPreviewBlocker {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
}

export interface ProductPreviewChange {
  readonly id: string;
  readonly at: string;
  readonly title: string;
  readonly actor: string;
  readonly operationId: string;
  readonly outcome: 'verified' | 'pending' | 'failed';
}

export interface ProductPreviewRowMetadata {
  readonly kind: typeof PRODUCT_PREVIEW_KIND;
  readonly spu: string;
  readonly barcode: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly supplier: ProductPreviewSupplier;
  readonly skuCount: number;
  readonly skuTotal: number;
  readonly mallCount: number;
  readonly mallTotal: number;
  readonly priceCents: number;
  readonly inventory: number;
  readonly lastSyncedAt: string;
  readonly operationId: string;
  readonly tone: ProductPreviewTone;
  readonly blocker: ProductPreviewBlocker | null;
  readonly malls: readonly ProductPreviewMall[];
  readonly changes: readonly ProductPreviewChange[];
}

export interface ProductPreviewListing {
  readonly id: string;
  readonly sku_id: string;
  readonly product_id: string;
  readonly title: string;
  readonly status: string;
  readonly version: number;
  readonly code: string;
  readonly pool_id: string;
  readonly product_type: string;
  readonly subtitle: string;
  readonly cover_url: string | null;
  readonly effective_at: string | null;
  readonly expires_at: string | null;
  readonly cursor_sort: string;
  readonly preview: ProductPreviewRowMetadata;
}

export interface ProductPreviewFacetValue {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export interface ProductPreviewFacets {
  readonly categories: readonly ProductPreviewFacetValue[];
  readonly suppliers: readonly ProductPreviewFacetValue[];
  readonly malls: readonly ProductPreviewFacetValue[];
  readonly statuses: readonly ProductPreviewFacetValue[];
}

export interface ProductPreviewPage {
  readonly items: readonly ProductPreviewListing[];
  readonly count: number;
  readonly nextCursor?: string;
  readonly preview: {
    readonly kind: typeof PRODUCT_PREVIEW_KIND;
    readonly totalCount: number;
    readonly asOf: string;
    readonly facets: ProductPreviewFacets;
  };
}

export class ProductPreviewQueryError extends Error {
  readonly status = 400;
  readonly code: 'PREVIEW_LIMIT_INVALID' | 'PREVIEW_CURSOR_INVALID';

  constructor(code: 'PREVIEW_LIMIT_INVALID' | 'PREVIEW_CURSOR_INVALID') {
    super(code);
    this.name = 'ProductPreviewQueryError';
    this.code = code;
  }
}

interface ProductSeed {
  readonly title: string;
  readonly spu: string;
  readonly barcode: string;
  readonly code: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly supplier: ProductPreviewSupplier;
  readonly skuCount: number;
  readonly skuTotal: number;
  readonly priceCents: number;
  readonly inventory: number;
  readonly status: string;
  readonly tone: ProductPreviewTone;
  readonly blocker: ProductPreviewBlocker | null;
  readonly malls: readonly ProductPreviewMall[];
  readonly lastSyncedAt: string;
  readonly operationId: string;
  readonly coverUrl: string | null;
}

const HUIMIN = Object.freeze({ id: 'mall:huimin', name: '鸿泰惠民通' });
const ZHENXUAN = Object.freeze({ id: 'mall:zhenxuan', name: '鸿泰甄选' });
const CENTRAL_SUPPLY = Object.freeze({ id: 'supplier:central', name: '央企供应链' });
const LOCAL_LIFE = Object.freeze({ id: 'supplier:local-life', name: '本地生活服务' });

const referenceSeeds: readonly ProductSeed[] = Object.freeze([
  seed({
    title: '五常大米礼盒',
    spu: 'SPU-MVP-RICE-10KG',
    barcode: '6900000000017',
    code: 'SKU-MVP-RICE-10KG',
    categoryId: 'category:fresh-food',
    categoryName: '食品生鲜',
    supplier: CENTRAL_SUPPLY,
    priceCents: 9_800,
    inventory: 2_450,
    status: 'available',
    tone: 'success',
    malls: publishedMalls(9_800, 9_800),
    operationId: 'OP-240824-1185',
    coverUrl: cover('米', '#b72820', '#f5d6a0'),
  }),
  seed({
    title: '九阳5.5L大容量可视空气炸锅',
    spu: 'SPU-MVP-AIR-FRYER',
    barcode: '6900000000024',
    code: 'SKU-MVP-AIR-FRYER',
    categoryId: 'category:kitchen-appliance',
    categoryName: '家用电器 / 厨房电器',
    supplier: CENTRAL_SUPPLY,
    priceCents: 21_900,
    inventory: 1_500,
    status: 'needs_attention',
    tone: 'warning',
    blocker: blocker('PRICE_NOT_EFFECTIVE', '鸿泰甄选 · 价格未生效', '补充商城售价后即可发布', '去处理'),
    malls: Object.freeze([mall(HUIMIN, 'published', 21_900), mall(ZHENXUAN, 'pending', null)]),
    operationId: 'OP-240824-1186',
    coverUrl: cover('锅', '#1f2937', '#e5e7eb'),
  }),
  seed({
    title: '罗技G610红轴机械键盘',
    spu: 'SPU-MVP-KEYBOARD',
    barcode: '6900000000031',
    code: 'SKU-MVP-KEYBOARD',
    categoryId: 'category:digital-office',
    categoryName: '数码办公',
    supplier: CENTRAL_SUPPLY,
    priceCents: 35_900,
    inventory: 420,
    status: 'available',
    tone: 'success',
    malls: publishedMalls(35_900, 35_900),
    operationId: 'OP-240824-1187',
    coverUrl: cover('键', '#111827', '#d1d5db'),
  }),
  seed({
    title: '星巴克100元电子星礼卡',
    spu: 'SPU-MVP-COFFEE-CARD',
    barcode: '6900000000048',
    code: 'SKU-MVP-COFFEE-CARD',
    categoryId: 'category:electronic-card',
    categoryName: '电子卡券',
    supplier: LOCAL_LIFE,
    priceCents: 9_800,
    inventory: 10_000,
    status: 'available',
    tone: 'success',
    malls: publishedMalls(9_800, 9_800),
    operationId: 'OP-240824-1188',
    coverUrl: cover('星', '#087f5b', '#d3f9d8'),
  }),
  seed({
    title: '明前特级西湖龙井茶礼盒',
    spu: 'SPU-MVP-TEA',
    barcode: '6900000000055',
    code: 'SKU-MVP-TEA',
    categoryId: 'category:fresh-food',
    categoryName: '食品生鲜',
    supplier: CENTRAL_SUPPLY,
    priceCents: 36_000,
    inventory: 450,
    status: 'available',
    tone: 'success',
    malls: publishedMalls(36_000, 36_000),
    operationId: 'OP-240824-1189',
    coverUrl: cover('茶', '#476a4c', '#d8f3dc'),
  }),
  seed({
    title: '每日坚果企业福利礼盒',
    spu: 'SPU-MVP-NUTS',
    barcode: '6900000000062',
    code: 'SKU-MVP-NUTS',
    categoryId: 'category:fresh-food',
    categoryName: '食品生鲜',
    supplier: CENTRAL_SUPPLY,
    priceCents: 10_800,
    inventory: 3_100,
    status: 'pending_listing',
    tone: 'info',
    blocker: blocker('MALL_LISTING_PENDING', '鸿泰甄选 · 待上架', '商城资料已提交，等待上架确认', '查看进度'),
    malls: Object.freeze([mall(HUIMIN, 'published', 10_800), mall(ZHENXUAN, 'pending', 10_800)]),
    operationId: 'OP-240824-1190',
    coverUrl: cover('坚', '#8a4b24', '#ffe8cc'),
  }),
]);

const generatedSeeds = Array.from({ length: PRODUCT_PREVIEW_TOTAL - referenceSeeds.length }, (_, offset) => generatedSeed(offset + referenceSeeds.length));

export const productPreviewListings: readonly ProductPreviewListing[] = Object.freeze([...referenceSeeds, ...generatedSeeds].map((value, index) => listing(index, value)));

const facets = Object.freeze({
  categories: facet(productPreviewListings, (row) => ({ value: row.preview.categoryId, label: row.preview.categoryName })),
  suppliers: facet(productPreviewListings, (row) => ({ value: row.preview.supplier.id, label: row.preview.supplier.name })),
  malls: facetMany(productPreviewListings, (row) => row.preview.malls.map((value) => ({ value: value.id, label: value.name }))),
  statuses: facet(productPreviewListings, (row) => ({ value: row.status, label: statusLabel(row.status) })),
}) satisfies ProductPreviewFacets;

export function productPreviewPage(search: URLSearchParams): ProductPreviewPage {
  const query = Object.freeze({
    q: textQuery(search, 'q').toLowerCase(),
    category: textQuery(search, 'category'),
    supplier: textQuery(search, 'supplier'),
    mall: textQuery(search, 'mall'),
    status: textQuery(search, 'status'),
    limit: queryLimit(search),
  });
  const fingerprint = JSON.stringify(query);
  const offset = queryOffset(search.get('cursor'), fingerprint);
  const filtered = productPreviewListings.filter((row) => matches(row, query));
  const items = Object.freeze(filtered.slice(offset, offset + query.limit));
  const nextOffset = offset + items.length;
  const nextCursor = nextOffset < filtered.length ? encodeCursor(nextOffset, fingerprint) : undefined;
  return Object.freeze({
    items,
    count: items.length,
    ...(nextCursor === undefined ? {} : { nextCursor }),
    preview: Object.freeze({ kind: PRODUCT_PREVIEW_KIND, totalCount: filtered.length, asOf: PRODUCT_PREVIEW_AS_OF, facets }),
  });
}

function seed(value: Omit<ProductSeed, 'skuCount' | 'skuTotal' | 'lastSyncedAt' | 'blocker'> & Partial<Pick<ProductSeed, 'skuCount' | 'skuTotal' | 'lastSyncedAt' | 'blocker'>>): ProductSeed {
  return Object.freeze({ skuCount: 1, skuTotal: 1, lastSyncedAt: PRODUCT_PREVIEW_AS_OF, blocker: null, ...value });
}

function generatedSeed(index: number): ProductSeed {
  const number = index + 1;
  const categories = [
    ['category:fresh-food', '食品生鲜'],
    ['category:kitchen-appliance', '家用电器 / 厨房电器'],
    ['category:digital-office', '数码办公'],
    ['category:electronic-card', '电子卡券'],
    ['category:home', '家居日用'],
    ['category:health', '健康生活'],
  ] as const;
  const suppliers = [CENTRAL_SUPPLY, LOCAL_LIFE, Object.freeze({ id: 'supplier:jingcai', name: '京采直供' }), Object.freeze({ id: 'supplier:huarun', name: '华润供应链' })] as const;
  const category = categories[index % categories.length]!;
  const supplier = suppliers[index % suppliers.length]!;
  const status = index % 59 === 0 ? 'unpublished' : index % 53 === 0 ? 'pending_review' : index % 47 === 0 ? 'needs_attention' : 'available';
  const tone: ProductPreviewTone = status === 'available' ? 'success' : status === 'needs_attention' ? 'warning' : status === 'pending_review' ? 'info' : 'neutral';
  const priceCents = 3_900 + (index % 240) * 100;
  const mallPending = status !== 'available' || index % 5 === 0;
  const operationId = `OP-240824-${String(2_000 + number).padStart(4, '0')}`;
  return seed({
    title: `${category[1]}核心商品 ${String(number).padStart(4, '0')}`,
    spu: `SPU-PREVIEW-${String(number).padStart(5, '0')}`,
    barcode: `69${String(number).padStart(11, '0')}`,
    code: `SKU-PREVIEW-${String(number).padStart(5, '0')}`,
    categoryId: category[0],
    categoryName: category[1],
    supplier,
    skuCount: 1 + (index % 3),
    skuTotal: 1 + (index % 3) + (status === 'pending_review' ? 1 : 0),
    priceCents,
    inventory: 80 + ((index * 137) % 12_000),
    status,
    tone,
    blocker: status === 'needs_attention' ? blocker('PRICE_NOT_EFFECTIVE', '商城价格未生效', '补充商城售价后即可发布', '去处理') : null,
    malls: Object.freeze([mall(HUIMIN, status === 'unpublished' ? 'unpublished' : 'published', priceCents), mall(ZHENXUAN, mallPending ? 'pending' : 'published', mallPending ? null : priceCents)]),
    lastSyncedAt: `2026-08-${String(24 - (index % 20)).padStart(2, '0')}T13:${String(index % 60).padStart(2, '0')}:00.000Z`,
    operationId,
    coverUrl: null,
  });
}

function listing(index: number, value: ProductSeed): ProductPreviewListing {
  const id = String(index + 1).padStart(5, '0');
  const mallCount = value.malls.filter((entry) => entry.status === 'published').length;
  const changes: readonly ProductPreviewChange[] = Object.freeze([
    Object.freeze({
      id: `change:preview:${id}`,
      at: value.lastSyncedAt,
      title: '商品同步完成',
      actor: '商品同步服务',
      operationId: value.operationId,
      outcome: value.blocker === null ? ('verified' as const) : ('pending' as const),
    }),
  ]);
  return Object.freeze({
    id: `listing:preview:${id}`,
    sku_id: `sku:preview:${id}`,
    product_id: `product:preview:${id}`,
    title: value.title,
    status: value.status,
    version: 12,
    code: value.code,
    pool_id: 'pool:core',
    product_type: 'physical',
    subtitle: value.spu,
    cover_url: value.coverUrl,
    effective_at: value.status === 'unpublished' ? null : value.lastSyncedAt,
    expires_at: value.status === 'unpublished' ? value.lastSyncedAt : null,
    cursor_sort: value.lastSyncedAt,
    preview: Object.freeze({
      kind: PRODUCT_PREVIEW_KIND,
      spu: value.spu,
      barcode: value.barcode,
      categoryId: value.categoryId,
      categoryName: value.categoryName,
      supplier: value.supplier,
      skuCount: value.skuCount,
      skuTotal: value.skuTotal,
      mallCount,
      mallTotal: value.malls.length,
      priceCents: value.priceCents,
      inventory: value.inventory,
      lastSyncedAt: value.lastSyncedAt,
      operationId: value.operationId,
      tone: value.tone,
      blocker: value.blocker,
      malls: value.malls,
      changes,
    }),
  });
}

function publishedMalls(firstPrice: number, secondPrice: number): readonly ProductPreviewMall[] {
  return Object.freeze([mall(HUIMIN, 'published', firstPrice), mall(ZHENXUAN, 'published', secondPrice)]);
}

function mall(identity: { readonly id: string; readonly name: string }, status: ProductPreviewMallStatus, priceCents: number | null): ProductPreviewMall {
  return Object.freeze({ ...identity, status, priceCents });
}

function blocker(code: string, title: string, description: string, actionLabel: string): ProductPreviewBlocker {
  return Object.freeze({ code, title, description, actionLabel });
}

function cover(label: string, foreground: string, background: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="10" fill="${background}"/><rect x="15" y="12" width="50" height="56" rx="8" fill="${foreground}"/><text x="40" y="48" text-anchor="middle" font-size="24" font-family="sans-serif" fill="white">${label}</text></svg>`)}`;
}

function matches(row: ProductPreviewListing, query: Readonly<{ q: string; category: string; supplier: string; mall: string; status: string }>): boolean {
  const searchable = `${row.title}\n${row.code}\n${row.preview.spu}\n${row.preview.supplier.name}\n${row.preview.barcode}`.toLowerCase();
  return (
    (query.q === '' || searchable.includes(query.q)) &&
    (query.category === '' || row.preview.categoryId === query.category) &&
    (query.supplier === '' || row.preview.supplier.id === query.supplier) &&
    (query.mall === '' || row.preview.malls.some((value) => value.id === query.mall)) &&
    (query.status === '' || row.status === query.status)
  );
}

function textQuery(search: URLSearchParams, key: string): string {
  return (search.get(key) ?? '').trim().slice(0, 200);
}

function queryLimit(search: URLSearchParams): number {
  const raw = search.get('limit');
  const value = raw === null ? 50 : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) throw new ProductPreviewQueryError('PREVIEW_LIMIT_INVALID');
  return value;
}

function queryOffset(cursor: string | null, fingerprint: string): number {
  if (cursor === null) return 0;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!isCursor(parsed) || parsed.fingerprint !== fingerprint) throw new Error('CURSOR_MISMATCH');
    return parsed.offset;
  } catch {
    throw new ProductPreviewQueryError('PREVIEW_CURSOR_INVALID');
  }
}

function encodeCursor(offset: number, fingerprint: string): string {
  return Buffer.from(JSON.stringify({ version: 1, offset, fingerprint }), 'utf8').toString('base64url');
}

function isCursor(value: unknown): value is { readonly version: 1; readonly offset: number; readonly fingerprint: string } {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  return candidate.version === 1 && Number.isSafeInteger(candidate.offset) && (candidate.offset as number) >= 0 && typeof candidate.fingerprint === 'string';
}

function facet(rows: readonly ProductPreviewListing[], select: (row: ProductPreviewListing) => { readonly value: string; readonly label: string }): readonly ProductPreviewFacetValue[] {
  return facetMany(rows, (row) => [select(row)]);
}

function facetMany(rows: readonly ProductPreviewListing[], select: (row: ProductPreviewListing) => readonly { readonly value: string; readonly label: string }[]): readonly ProductPreviewFacetValue[] {
  const values = new Map<string, { readonly label: string; count: number }>();
  for (const row of rows) {
    for (const entry of select(row)) {
      const current = values.get(entry.value);
      values.set(entry.value, { label: entry.label, count: (current?.count ?? 0) + 1 });
    }
  }
  return Object.freeze([...values.entries()].map(([value, entry]) => Object.freeze({ value, label: entry.label, count: entry.count })));
}

function statusLabel(status: string): string {
  if (status === 'available') return '可售';
  if (status === 'needs_attention') return '待处理';
  if (status === 'pending_listing') return '待上架';
  if (status === 'pending_review') return '待审核';
  if (status === 'unpublished') return '已下架';
  return status;
}
