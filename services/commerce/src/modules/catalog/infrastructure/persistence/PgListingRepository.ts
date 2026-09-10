import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ListingFilter, ListingRepository } from '../../application/port/ListingRepository';
import type { ListingFacet, ListingFacetFilter, ListingFacetRepository } from '../../application/port/ListingFacetRepository';
import { isConsumerTarget } from '@shop/contract';
import type { CatalogScopeReader } from './CatalogScopeReader';
import { readSupplierListings } from './SupplierListingQuery';
export class PgListingRepository implements ListingRepository, ListingFacetRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly scopes: CatalogScopeReader
  ) {}
  async read(context: ReadTransactionContext, filter: ListingFilter) {
    const database = this.transactions.database(context);
    if (filter.scopeKind === 'supplier') {
      return readSupplierListings(database, filter);
    }
    const scopes = await this.scopes.visible(context, filter.scope, filter.scopeKind === 'store');
    const result = await database.query(
      `with targetmall as materialized(
        select organization.id from organization.organization organization where organization.id=any($1::text[]) and organization.kind='mall'
      ) select listing.id,listing.scope_id,$1::text[] visible_scopes,listing.pool_id,listing.sku_id,listing.title,listing.status,listing.effective_at,listing.expires_at,
      listing.version,listing.updated_at cursor_sort,sku.code,product.id product_id,product.product_type,product.attributes->>'coverObject' cover_object,product.attributes->>'coverUrl' cover_url,
      product.attributes->>'subtitle' subtitle,product.category_id,category.name category_name,
      case when product.owner_partner_id is null then 'self' else 'partner' end source,product.owner_partner_id source_partner_id,pool.name pool_name,
      (select count(*)::integer from catalog.sku productsku where productsku.product_id=product.id and productsku.status='active') sku_count,
      (select count(*)::integer from catalog.sku productsku where productsku.product_id=product.id and productsku.status<>'archived') sku_total,
      coalesce((select count(distinct covered.scope_id)::integer from(
        select listing.scope_id union all select binding.mall_id from catalog.poolbinding binding where binding.pool_id=listing.pool_id
        and binding.status='active' and (binding.effective_at is null or binding.effective_at<=clock_timestamp())
        and (binding.expires_at is null or binding.expires_at>clock_timestamp())
      ) covered join targetmall on targetmall.id=covered.scope_id),0)::integer mall_count,
      (select count(*)::integer from targetmall) mall_total,
      coalesce(product.attributes->'regionIds','[]'::jsonb) region_ids
      from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id join catalog.product product on product.id=sku.product_id
      join catalog.category category on category.id=product.category_id left join catalog.pool pool on pool.id=listing.pool_id where listing.scope_id=any($1::text[])
      and ($2='' or listing.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%') and ($3='' or product.category_id=$3) and ($4='' or product.id=$4)
      and ($5='' or listing.pool_id=$5) and ($6='' or product.owner_partner_id=$6) and ($7='' or listing.scope_id=$7) and ($8='' or listing.status=$8)
      and (not $9 or (listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
        and (listing.expires_at is null or listing.expires_at>clock_timestamp())))
      and ($10::timestamptz is null or (listing.updated_at,listing.id)<($10::timestamptz,$11))
      order by listing.updated_at desc,listing.id desc limit $12`,
      [scopes, filter.query, filter.category, filter.product, filter.pool, filter.supplier, filter.mall, filter.status, isConsumerTarget(filter.actorTarget), filter.page.sort, filter.page.id, filter.page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }

  async facets(context: ReadTransactionContext, filter: ListingFacetFilter) {
    const database = this.transactions.database(context);
    const supplier = filter.scopeKind === 'supplier';
    const scopes = supplier ? [filter.scope] : await this.scopes.visible(context, filter.scope, false);
    const result = await database.query<Readonly<{ categories: unknown; suppliers: unknown; malls: unknown; statuses: unknown }>>(
      `with base as(
         select product.category_id,category.name category_name,product.owner_partner_id supplier,listing.scope_id mall,listing.status
         from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id join catalog.product product on product.id=sku.product_id
         join catalog.category category on category.id=product.category_id where not $3 and listing.scope_id=any($1::text[])
         and ($2='' or listing.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%')
         union all
         select product.category_id,category.name category_name,source.provider supplier,source.scope_id mall,source.status
         from catalog.sourcelisting source left join catalog.sku sku on sku.id=source.sku_id
         left join catalog.product product on product.id=sku.product_id left join catalog.category category on category.id=product.category_id
         where $3 and source.scope_id=$4 and ($2='' or product.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%' or source.external_id ilike '%'||$2||'%')
       ) select
       coalesce((select jsonb_agg(to_jsonb(facet) order by facet.label,facet.value) from(
         select category_id value,max(category_name) label,count(*)::integer count from base where category_id is not null group by category_id
       ) facet),'[]'::jsonb) categories,
       coalesce((select jsonb_agg(to_jsonb(facet) order by facet.value) from(
         select supplier value,null::text label,count(*)::integer count from base where supplier is not null group by supplier
       ) facet),'[]'::jsonb) suppliers,
       coalesce((select jsonb_agg(to_jsonb(facet) order by facet.value) from(
         select mall value,null::text label,count(*)::integer count from base group by mall
       ) facet),'[]'::jsonb) malls,
       coalesce((select jsonb_agg(to_jsonb(facet) order by facet.value) from(
         select status value,null::text label,count(*)::integer count from base group by status
       ) facet),'[]'::jsonb) statuses`,
      [scopes, filter.query, supplier, filter.scope]
    );
    const row = result.rows[0] ?? { categories: [], suppliers: [], malls: [], statuses: [] };
    return Object.freeze({
      categories: facets(row.categories),
      suppliers: facets(row.suppliers),
      malls: facets(row.malls),
      statuses: facets(row.statuses),
    });
  }
  async candidates(context: WriteTransactionContext, ids: readonly string[], scope: string) {
    const database = this.transactions.database(context);
    const scopes = await this.scopes.visible(context, scope, false);
    if (ids.length === 0) return Object.freeze([]);
    const result = await database.query<{
      id: string;
      scope_id: string;
      pool_id: string | null;
      sku_id: string;
      title: string;
      status: 'draft' | 'published' | 'unpublished' | 'retired';
      effective_at: Date | null;
      expires_at: Date | null;
      version: number;
      product_id: string;
      product_status: string;
      category_id: string;
      owner_partner_id: string | null;
      region_ids: unknown;
      sku_status: string;
      pool_ready: boolean;
      scope_ready: boolean;
      channel_ready: boolean;
    }>(
      `select listing.id,listing.scope_id,listing.pool_id,listing.sku_id,listing.title,listing.status,listing.effective_at,
       listing.expires_at,listing.version::integer,product.id product_id,product.status product_status,product.category_id,
       product.owner_partner_id,coalesce(product.attributes->'regionIds','[]'::jsonb) region_ids,sku.status sku_status,
       coalesce(pool.status='active',false) pool_ready,
       coalesce(pool.scope_id=listing.scope_id or (binding.status='active' and (binding.effective_at is null or binding.effective_at<=clock_timestamp())
         and (binding.expires_at is null or binding.expires_at>clock_timestamp())),false) scope_ready,
       (product.owner_partner_id is null or source.sku_id is not null) channel_ready
       from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
       join catalog.product product on product.id=sku.product_id left join catalog.pool pool on pool.id=listing.pool_id
       left join catalog.poolbinding binding on binding.pool_id=listing.pool_id and binding.mall_id=listing.scope_id
       left join lateral(select mapped.sku_id from catalog.sourcelisting mapped where mapped.sku_id=sku.id and mapped.status='mapped'
         order by mapped.observed_at desc,mapped.id limit 1) source on true
       where listing.id=any($1::text[]) and listing.scope_id=any($2::text[]) order by array_position($1::text[],listing.id) for update of listing`,
      [ids, scopes]
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          listing: Object.freeze({
            id: row.id,
            scope: row.scope_id,
            pool: row.pool_id,
            sku: row.sku_id,
            title: row.title,
            state: row.status,
            effectiveAt: row.effective_at?.toISOString() ?? null,
            expiresAt: row.expires_at?.toISOString() ?? null,
            version: Number(row.version),
          }),
          product: row.product_id,
          productState: row.product_status,
          category: row.category_id,
          partner: row.owner_partner_id,
          regions: Object.freeze(Array.isArray(row.region_ids) ? row.region_ids.filter((item): item is string => typeof item === 'string') : []),
          skuState: row.sku_status,
          poolReady: row.pool_ready,
          scopeReady: row.scope_ready,
          channelReady: row.channel_ready,
        })
      )
    );
  }

  async save(context: WriteTransactionContext, listings: readonly import('../../domain/model/Listing').ListingSnapshot[]) {
    if (listings.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<import('../../application/port/ListingRepository').ListingRecord>(
      `with changes as(
        select input.id,input.scope,input.state,input."effectiveAt",input."expiresAt",input.version,input."expectedVersion"
        from jsonb_to_recordset($1::jsonb) input(id text,scope text,state text,"effectiveAt" timestamptz,"expiresAt" timestamptz,version bigint,"expectedVersion" bigint)
      ) update catalog.listing listing set status=changes.state,effective_at=changes."effectiveAt",expires_at=changes."expiresAt",
        version=changes.version,updated_at=clock_timestamp() from changes where listing.id=changes.id and listing.scope_id=changes.scope
        and listing.version=changes."expectedVersion"
        returning listing.id,listing.scope_id,listing.pool_id,listing.sku_id,listing.title,listing.status,listing.effective_at,
        listing.expires_at,listing.version::integer,listing.created_at,listing.updated_at`,
      [JSON.stringify(listings.map((listing) => ({ ...listing, expectedVersion: listing.version - 1 })))]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, version: Number(row.version) })));
  }
  async priceTarget(context: WriteTransactionContext, listing: string, scope: string) {
    const database = this.transactions.database(context);
    const visible = await this.scopes.visible(context, scope, false);
    const result = await database.query<{ id: string; sku_id: string; scope_id: string }>(`select id,sku_id,scope_id from catalog.listing where id=$1 and scope_id=any($2::text[]) for update`, [listing, visible]);
    const source = result.rows[0]
      ? undefined
      : await database.query<{ id: string; sku_id: string; scope_id: string }>(`select id,sku_id,scope_id from catalog.sourcelisting where id=$1 and scope_id=$2 and status='mapped' and sku_id is not null for update`, [listing, scope]);
    const row = result.rows[0] ?? source?.rows[0];
    if (!row) throw new DomainError('LISTING_NOT_PURCHASABLE');
    return Object.freeze({ listing: row.id, sku: row.sku_id, scope: row.scope_id });
  }
  async changePool(context: WriteTransactionContext, listing: string, scope: string, pool: string | null, expectedVersion: number) {
    const database = this.transactions.database(context);
    const visible = await this.scopes.visible(context, scope, false);
    const candidate = await database.query<{ id: string; sku_id: string; scope_id: string; status: string }>(`select id,sku_id,scope_id,status from catalog.listing where id=$1 and scope_id=any($2::text[]) for update`, [listing, visible]);
    const row = candidate.rows[0];
    if (!row || row.status === 'published' || row.status === 'retired') throw new DomainError('LISTING_NOT_PURCHASABLE', { reason: row?.status === 'published' ? 'UNPUBLISH_BEFORE_POOL_CHANGE' : 'LISTING_NOT_MANAGEABLE' });
    if (pool !== null) {
      const target = await database.query<{ id: string }>(
        `select target.id from catalog.pool target where target.id=$1 and target.status='active'
         and (target.scope_id=any($2::text[]) or exists(select 1 from catalog.poolbinding binding
           where binding.pool_id=target.id and binding.mall_id=$3 and binding.status='active'
           and (binding.effective_at is null or binding.effective_at<=clock_timestamp())
           and (binding.expires_at is null or binding.expires_at>clock_timestamp())))`,
        [pool, visible, row.scope_id]
      );
      if (!target.rows[0]) throw new DomainError('LISTING_NOT_PURCHASABLE', { reason: 'POOL_NOT_AVAILABLE' });
      await database.query(
        `insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
         select $1,sku.id,'included',sku.version::text,clock_timestamp() from catalog.sku sku where sku.id=$2 and sku.status='active'
         on conflict(pool_id,sku_id) do update set state='included',source_version=excluded.source_version,added_at=excluded.added_at`,
        [pool, row.sku_id]
      );
    }
    const result = await database.query<import('../../application/port/ListingRepository').ListingRecord>(
      `update catalog.listing set pool_id=$2,version=version+1,updated_at=clock_timestamp() where id=$1 and version=$3
       returning id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version::integer,created_at,updated_at`,
      [listing, pool, expectedVersion]
    );
    const changed = result.rows[0];
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...changed, version: Number(changed.version) });
  }
}

function facets(value: unknown): readonly ListingFacet[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const row = item as Readonly<Record<string, unknown>>;
      const count = Number(row.count);
      if (typeof row.value !== 'string' || !Number.isSafeInteger(count) || count < 0) return [];
      return [Object.freeze({ value: row.value, label: typeof row.label === 'string' ? row.label : null, count })];
    })
  );
}
