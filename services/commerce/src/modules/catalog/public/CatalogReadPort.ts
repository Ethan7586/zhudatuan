import type { QueryResultRow } from 'pg';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { ReadSession, type ReadScope } from '../../../foundation/persistence/ReadSession';
import type { ReadDatabaseWorkload } from '../../../foundation/persistence/Workload';

export interface CatalogPosition {
  readonly sort: string;
  readonly id: string;
}

export interface StorefrontListing {
  readonly id: string;
  readonly sku: string;
  readonly product: string;
  readonly title: string;
  readonly subtitle: string | null;
  readonly coverUrl: string | null;
  readonly kind: string;
  readonly categoryId: string;
  readonly categoryCode: string;
  readonly categoryName: string;
  readonly brandId: string | null;
  readonly supplierId: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly specifications: Readonly<Record<string, unknown>>;
  readonly version: string;
  readonly updatedAt: string;
}

export interface CatalogReadPort {
  listings(
    scope: ReadScope,
    input: Readonly<{
      mall: string;
      pool: string;
      limit: number;
      after: CatalogPosition | null;
      product: string | null;
      listings: readonly string[] | null;
      query: string | null;
      category: string | null;
      account: 'welfare' | 'meal' | 'wechat' | 'cash' | null;
      exclusive: boolean;
    }>
  ): Promise<Readonly<{ items: readonly StorefrontListing[]; next: CatalogPosition | null }>>;
}

interface ListingRow extends QueryResultRow, StorefrontListing {}

export class PgCatalogReadPort implements CatalogReadPort {
  private readonly reads: ReadSession;
  constructor(pool: DatabasePool, workload: ReadDatabaseWorkload = 'query') {
    this.reads = new ReadSession(pool, workload);
  }
  listings(
    scope: ReadScope,
    input: Readonly<{
      mall: string;
      pool: string;
      limit: number;
      after: CatalogPosition | null;
      product: string | null;
      listings: readonly string[] | null;
      query: string | null;
      category: string | null;
      account: 'welfare' | 'meal' | 'wechat' | 'cash' | null;
      exclusive: boolean;
    }>
  ) {
    return this.reads.run(scope, async (database) => {
      const result = await database.query<ListingRow>(
        `select listing.id,listing.sku_id sku,product.id product,listing.title,
        coalesce(product.attributes->>'subtitleZh',product.attributes->>'subtitle') "subtitle",
        coalesce(product.attributes->>'coverUrl',product.attributes->'detail'->>'coverUrl') "coverUrl",product.product_type kind,
        category.id "categoryId",category.code "categoryCode",category.name "categoryName",
        product.brand_id "brandId",product.owner_partner_id "supplierId",product.attributes,sku.specifications,
        listing.version::text version,
        to_char(listing.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') "updatedAt" from catalog.listing listing
        join catalog.sku sku on sku.id=listing.sku_id and sku.status='active'
        join catalog.product product on product.id=sku.product_id and product.status='active'
        join catalog.category category on category.id=product.category_id and category.status='active'
        join catalog.poolbinding binding on binding.pool_id=listing.pool_id and binding.mall_id=$1 and binding.status='active'
        where listing.pool_id=$2 and listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
        and (listing.expires_at is null or listing.expires_at>clock_timestamp()) and ($3::text is null or listing.id=$3)
        and ($4::text[] is null or listing.id=any($4::text[]))
        and ($5::text is null or listing.title ilike '%'||$5||'%')
        and ($6::text is null or category.id=$6)
        and ($7::text is null or coalesce(product.attributes->'allowedAccounts',product.attributes->'detail'->'allowedAccounts','[]'::jsonb) ? $7)
        and (not $8::boolean or product.attributes->>'enterpriseExclusive'='true' or product.attributes->'detail'->>'enterpriseExclusive'='true')
        and ($9::timestamptz is null or (listing.updated_at,listing.id)<($9::timestamptz,$10))
        order by listing.updated_at desc,listing.id desc limit $11`,
        [input.mall, input.pool, input.product, input.listings, input.query, input.category, input.account, input.exclusive, input.after?.sort ?? null, input.after?.id ?? null, input.limit + 1]
      );
      const visible = result.rows.slice(0, input.limit).map((item) => Object.freeze(item));
      const last = visible.at(-1);
      const next = result.rows.length > input.limit && last ? Object.freeze({ sort: last.updatedAt, id: last.id }) : null;
      return Object.freeze({ items: Object.freeze(visible), next });
    });
  }
}

export const CATALOG_READ_PORT = publicPort<CatalogReadPort>('catalog', 'read');
