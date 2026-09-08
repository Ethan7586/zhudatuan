import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { DatabasePool } from '../../../../platform/database/Pool';
import type { CartCatalogPort, CartListingSnapshot } from '../../public/CartCatalogPort';
import type { CatalogPosition, CatalogReadPort, StorefrontCategoryFacet, StorefrontListing } from '../../public/CatalogReadPort';
import type { CatalogDimensionLabel, CatalogDimensionPort } from '../../public/CatalogDimensionPort';
import type { CheckoutCatalogItem, CheckoutCatalogPort } from '../../public/CheckoutCatalogPort';
import type { ExperienceCatalogItem, ExperienceCatalogPort, ExperienceCatalogReferences } from '../../public/ExperienceCatalogPort';
import type { MemberCatalogPort, MemberCatalogVisibility } from '../../public/MemberCatalogPort';
import type { ReferralCatalogPort } from '../../public/ReferralCatalogPort';

interface StorefrontRow extends QueryResultRow, StorefrontListing {}

export class PgCatalogFacade implements CartCatalogPort, CatalogDimensionPort, CatalogReadPort, CheckoutCatalogPort, ExperienceCatalogPort, MemberCatalogPort, ReferralCatalogPort {
  constructor(
    private readonly pool: DatabasePool,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  async inspect(context: ReadTransactionContext, listings: readonly string[], scope: string): Promise<ReadonlyMap<string, CartListingSnapshot>> {
    if (listings.length === 0) return new Map();
    const requested = [...new Set(listings)];
    const result = await this.transactions.database(context).query<{
      id: string;
      sku_id: string | null;
      title: string | null;
      version: number | null;
      benefit_applicable: boolean;
      code: CartListingSnapshot['code'];
    }>(
      `select requested.id,listing.sku_id,listing.title,listing.version::integer,
       coalesce(product.attributes->'allowedAccounts',product.attributes->'detail'->'allowedAccounts','[]'::jsonb) ?| array['welfare','meal'] benefit_applicable,
       case when listing.id is null then 'unpublished'
        when listing.scope_id<>$2 or binding.pool_id is null then 'outofscope'
        when listing.status<>'published' or (listing.effective_at is not null and listing.effective_at>clock_timestamp())
          or (listing.expires_at is not null and listing.expires_at<=clock_timestamp()) then 'unpublished'
        when sku.status<>'active' or product.status<>'active' or pool.status<>'active' then 'unavailable'
        else 'valid' end code
       from unnest($1::text[]) requested(id)
       left join catalog.listing listing on listing.id=requested.id
       left join catalog.sku sku on sku.id=listing.sku_id
       left join catalog.product product on product.id=sku.product_id
       left join catalog.pool pool on pool.id=listing.pool_id
       left join catalog.poolbinding binding on binding.pool_id=listing.pool_id and binding.mall_id=$2 and binding.status='active'
       order by requested.id`,
      [requested, scope]
    );
    return new Map(result.rows.map((row) => [row.id, Object.freeze({ listing: row.id, sku: row.sku_id ?? '', title: row.title, version: row.version, benefitApplicable: row.benefit_applicable, code: row.code })]));
  }

  async items(context: ReadTransactionContext, scope: string, listings: readonly string[]): Promise<readonly CheckoutCatalogItem[]> {
    if (listings.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<CheckoutCatalogItem & Record<string, unknown>>(
      `select listing.id listing,listing.sku_id sku,listing.title,listing.version::integer "listingVersion",
       listing.status "listingStatus",product.id product,product.product_type "productType",product.category_id category,
       product.version::integer "productVersion",sku.version::integer "skuVersion",source.provider,product.owner_partner_id partner
       from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id and sku.status='active'
       join catalog.product product on product.id=sku.product_id and product.status='active'
       join catalog.pool pool on pool.id=listing.pool_id and pool.status='active'
       left join lateral(select provider from catalog.sourcelisting source where source.sku_id=sku.id and source.scope_id=$1
         and source.status='mapped' order by source.observed_at desc,source.id limit 1) source on true
       where listing.scope_id=$1 and listing.id=any($2::text[]) and listing.status='published'
       and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
       and (listing.expires_at is null or listing.expires_at>clock_timestamp()) order by listing.id`,
      [scope, [...new Set(listings)]]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async categories(
    context: ReadTransactionContext,
    input: Readonly<{ mall: string; pool: string; query: string | null; account: 'welfare' | 'meal' | 'wechat' | 'cash' | null; exclusive: boolean }>
  ): Promise<readonly StorefrontCategoryFacet[]> {
    const result = await this.transactions.database(context).query<StorefrontCategoryFacet & QueryResultRow>(
      `select category.id,category.code,category.name,count(distinct product.id)::integer count
       from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id and sku.status='active'
       join catalog.product product on product.id=sku.product_id and product.status='active'
       join catalog.category category on category.id=product.category_id and category.status='active'
       join catalog.pool pool on pool.id=listing.pool_id and pool.status='active'
       join catalog.poolbinding binding on binding.pool_id=listing.pool_id and binding.mall_id=$1 and binding.status='active'
       where listing.pool_id=$2 and listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
       and (listing.expires_at is null or listing.expires_at>clock_timestamp())
       and ($3::text is null or listing.title ilike '%'||$3||'%' or category.name ilike '%'||$3||'%'
         or coalesce(product.attributes->>'brandName',product.attributes->'detail'->>'brandName','') ilike '%'||$3||'%')
       and ($4::text is null or coalesce(product.attributes->'allowedAccounts',product.attributes->'detail'->'allowedAccounts','[]'::jsonb)?$4)
       and (not $5::boolean or product.attributes->>'enterpriseExclusive'='true' or product.attributes->'detail'->>'enterpriseExclusive'='true')
       group by category.id,category.code,category.name order by category.name,category.id`,
      [input.mall, input.pool, input.query, input.account, input.exclusive]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ id: row.id, code: row.code, name: row.name, count: Number(row.count) })));
  }

  async listings(
    context: ReadTransactionContext,
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
    const result = await this.transactions.database(context).query<StorefrontRow>(
      `select listing.id,listing.sku_id sku,product.id product,listing.title,
       coalesce(product.attributes->>'subtitleZh',product.attributes->>'subtitle') "subtitle",
       coalesce(product.attributes->>'coverUrl',product.attributes->'detail'->>'coverUrl') "coverUrl",product.product_type kind,
       category.id "categoryId",category.code "categoryCode",category.name "categoryName",product.brand_id "brandId",
       product.owner_partner_id "supplierId",product.attributes,sku.specifications,listing.version::text version,
       to_char(listing.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') "updatedAt"
       from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id and sku.status='active'
       join catalog.product product on product.id=sku.product_id and product.status='active'
       join catalog.category category on category.id=product.category_id and category.status='active'
       join catalog.pool pool on pool.id=listing.pool_id and pool.status='active'
       join catalog.poolbinding binding on binding.pool_id=listing.pool_id and binding.mall_id=$1 and binding.status='active'
       where listing.pool_id=$2 and listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
       and (listing.expires_at is null or listing.expires_at>clock_timestamp()) and ($3::text is null or product.id=$3)
       and ($4::text[] is null or listing.id=any($4::text[]))
       and ($5::text is null or listing.title ilike '%'||$5||'%' or category.name ilike '%'||$5||'%'
         or coalesce(product.attributes->>'brandName',product.attributes->'detail'->>'brandName','') ilike '%'||$5||'%')
       and ($6::text is null or category.id=$6)
       and ($7::text is null or coalesce(product.attributes->'allowedAccounts',product.attributes->'detail'->'allowedAccounts','[]'::jsonb)?$7)
       and (not $8::boolean or product.attributes->>'enterpriseExclusive'='true' or product.attributes->'detail'->>'enterpriseExclusive'='true')
       and ($9::timestamptz is null or (listing.updated_at,listing.id)<($9::timestamptz,$10))
       order by listing.updated_at desc,listing.id desc limit $11`,
      [input.mall, input.pool, input.product, input.listings, input.query, input.category, input.account, input.exclusive, input.after?.sort ?? null, input.after?.id ?? null, input.limit + 1]
    );
    const visible = result.rows.slice(0, input.limit).map((item) => Object.freeze(item));
    const last = visible.at(-1);
    return Object.freeze({ items: Object.freeze(visible), next: result.rows.length > input.limit && last ? Object.freeze({ sort: last.updatedAt, id: last.id }) : null });
  }

  async labels(context: ReadTransactionContext, input: Readonly<{ products: readonly string[]; categories: readonly string[] }>): Promise<readonly CatalogDimensionLabel[]> {
    if (input.products.length === 0 && input.categories.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<CatalogDimensionLabel & QueryResultRow>(
      `select 'product'::text kind,product.id,product.title name
       from catalog.product product where product.id=any($1::text[])
       union all
       select 'category'::text kind,category.id,category.name
       from catalog.category category where category.id=any($2::text[])
       order by kind,name,id`,
      [[...new Set(input.products)], [...new Set(input.categories)]]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ kind: row.kind, id: row.id, name: row.name })));
  }

  async published(context: ReadTransactionContext, listing: string, mall: string): Promise<boolean> {
    return (await this.visibility(context, [listing], mall))[0]?.visible === true;
  }

  async visibility(context: ReadTransactionContext, listings: readonly string[], mall: string): Promise<readonly MemberCatalogVisibility[]> {
    if (listings.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<Readonly<{ listing: string; reason: MemberCatalogVisibility['reason'] }>>(
      `select requested.listing,case when listing.id is null then 'removed'
       when listing.status<>'published' or (listing.effective_at is not null and listing.effective_at>clock_timestamp())
         or (listing.expires_at is not null and listing.expires_at<=clock_timestamp()) then 'unpublished'
       when sku.status<>'active' or product.status<>'active' or pool.status<>'active' then 'unavailable'
       when binding.pool_id is null then 'outofscope' else null end reason
       from unnest($1::text[]) with ordinality requested(listing,position)
       left join catalog.listing listing on listing.id=requested.listing left join catalog.sku sku on sku.id=listing.sku_id
       left join catalog.product product on product.id=sku.product_id left join catalog.pool pool on pool.id=listing.pool_id
       left join catalog.poolbinding binding on binding.pool_id=listing.pool_id and binding.mall_id=$2 and binding.status='active'
       order by requested.position`,
      [[...new Set(listings)], mall]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ listing: row.listing, visible: row.reason === null, reason: row.reason })));
  }

  async provisionPool(context: WriteTransactionContext, input: Readonly<{ mall: string; name: string; source?: string }>): Promise<string> {
    const database = this.transactions.database(context);
    const pool = `pool:${randomUUID()}`;
    await database.query(`insert into catalog.pool(id,scope_id,kind,name,status,version) values($1,$2,'private',$3,'active',1)`, [pool, input.mall, input.name]);
    if (input.source)
      await database.query(
        `insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
      select $1,sku_id,state,source_version,clock_timestamp() from catalog.poolitem where pool_id=$2`,
        [pool, input.source]
      );
    await database.query(
      `insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
      values($1,$2,'selected','active',clock_timestamp(),clock_timestamp())`,
      [input.mall, pool]
    );
    return pool;
  }

  async activeBinding(context: ReadTransactionContext, malls: readonly string[]): Promise<Readonly<{ mall: string; pool: string }> | null> {
    if (malls.length === 0) return null;
    const result = await this.transactions.database(context).query<{ mall_id: string; pool_id: string }>(
      `select binding.mall_id,binding.pool_id from catalog.poolbinding binding join catalog.pool pool on pool.id=binding.pool_id and pool.status='active'
       where binding.mall_id=any($1::text[]) and binding.status='active' and (binding.effective_at is null or binding.effective_at<=clock_timestamp())
       and (binding.expires_at is null or binding.expires_at>clock_timestamp()) order by binding.mall_id,binding.pool_id limit 1`,
      [malls]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ mall: row.mall_id, pool: row.pool_id }) : null;
  }

  async references(context: ReadTransactionContext, pool: string, input: ExperienceCatalogReferences) {
    const database = this.transactions.database(context);
    const [counts, selected] = await Promise.all([
      database.query<{ products: number; categories: number; collections: number; listings: number; pool_version: number }>(
        `select (select count(distinct product.id)::integer from catalog.product product join catalog.sku sku on sku.product_id=product.id
        join catalog.listing listing on listing.sku_id=sku.id and listing.pool_id=$1 where product.id=any($2::text[]) and product.status='active' and listing.status='published') products,
       (select count(*)::integer from catalog.category where id=any($3::text[]) and status='active') categories,
       (select count(*)::integer from catalog.pool where id=any($4::text[]) and status='active') collections,
       (select count(*)::integer from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id and sku.status='active'
         join catalog.product product on product.id=sku.product_id and product.status='active'
         where listing.id=any($5::text[]) and listing.pool_id=$1 and listing.status='published') listings,
       (select version::integer from catalog.pool where id=$1 and status='active') pool_version`,
        [pool, input.products, input.categories, input.collections, input.listings]
      ),
      database.query<ExperienceCatalogItem & Record<string, unknown>>(
        `select listing.id listing,product.id product,product.category_id category,product.owner_partner_id partner,
          case when jsonb_typeof(product.attributes->'regions')='array' then product.attributes->'regions' else '[]'::jsonb end regions,
          sku.id sku,concat(product.version,':',sku.version,':',listing.version) version
         from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id and sku.status='active'
         join catalog.product product on product.id=sku.product_id and product.status='active'
         where listing.pool_id=$1 and listing.status='published'
         and (product.id=any($2::text[]) or listing.id=any($3::text[]))
         and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
         and (listing.expires_at is null or listing.expires_at>clock_timestamp()) order by listing.id`,
        [pool, input.products, input.listings]
      ),
    ]);
    const row = counts.rows[0];
    const items = Object.freeze(
      selected.rows.map((item) => Object.freeze({ listing: item.listing, product: item.product, category: item.category, partner: item.partner, regions: strings(item.regions), sku: item.sku, version: String(item.version) }))
    );
    const ready = row !== undefined && row.pool_version > 0 && row.products === input.products.length && row.categories === input.categories.length && row.collections === input.collections.length && row.listings === input.listings.length;
    const version = [`pool:${row?.pool_version ?? 0}`, ...items.map((item) => `${item.listing}@${item.version}`)].join('|');
    return Object.freeze({ ready, version, items });
  }

  async product(scopeId: string, productId: string): Promise<Readonly<{ productId: string; active: boolean; version: number }> | null> {
    const result = await this.pool.query<{ id: string; version: number; active: boolean }>(
      `select product.id,product.version::integer,product.status='active' and exists(select 1 from catalog.listing listing
       join catalog.sku sku on sku.id=listing.sku_id and sku.status='active' join catalog.pool pool on pool.id=listing.pool_id and pool.status='active'
       where sku.product_id=product.id and listing.scope_id=$1 and listing.status='published') active
       from catalog.product product where product.id=$2`,
      [scopeId, productId]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ productId: row.id, active: row.active, version: Number(row.version) }) : null;
  }
}

function strings(value: unknown): readonly string[] {
  return Object.freeze(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
}
