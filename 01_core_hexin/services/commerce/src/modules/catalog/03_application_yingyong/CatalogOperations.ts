import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { catalogImportOperations } from './CatalogImportOperations';

export function catalogOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('catalog', pool, context.container.get(AUDIT_SINK), {
    ...catalogImportOperations(context),
    'catalog.pools.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `select pool.id,pool.kind,pool.name,pool.status,pool.version,count(item.sku_id)::integer item_count
        from catalog.pool pool left join catalog.poolitem item on item.pool_id=pool.id where pool.scope_id=$1
        and ($2::text is null or (pool.name,pool.id)>($2,$3)) group by pool.id order by pool.name,pool.id limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'name');
    },
    'catalog.pools.attach': async (request, database) => {
      requireAccess(request);
      const result = await database.query(
        `insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
        values($1,$2,'selected','active',clock_timestamp(),clock_timestamp()) on conflict(mall_id,pool_id) do update set status='active',effective_at=clock_timestamp(),expires_at=null returning *`,
        [request.input.path.scopeid!, request.input.path.poolid!]
      );
      return rowResult(result);
    },
    'catalog.pools.detach': async (request, database) =>
      rowResult(
        await database.query(
          `update catalog.poolbinding set status='disabled',expires_at=clock_timestamp()
      where pool_id=$1 and mall_id=$2 and status='active' returning *`,
          [request.input.path.poolid!, request.input.path.scopeid!]
        )
      ),
    'catalog.pools.allocate': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const result = await database.query(`insert into catalog.pool(id,scope_id,kind,name,status,version) values($1,$2,$3,$4,'active',0) returning *`, [
        `pool:${randomUUID()}`,
        textField(body, 'scope'),
        body.kind === 'markup' ? 'markup' : 'channel',
        textField(body, 'name'),
      ]);
      await database.query(
        `insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
        select $1,item.sku_id,'included',item.source_version,clock_timestamp() from catalog.poolitem item where item.pool_id=$2 on conflict do nothing`,
        [(result.rows[0] as { id: string }).id, request.input.path.poolid!]
      );
      if (access.scope.kind !== 'platform' && body.scope !== access.scope.id) throw new Error('POOL_ALLOCATION_TARGET_INVALID');
      return rowResult(result, 201);
    },
    'catalog.products.create': async (request, database) => {
      const body = bodyRecord(request);
      const id = `product:${randomUUID()}`;
      const result = await database.query(
        `insert into catalog.product(id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
        values($1,$2,$3,$4,$5,$6,$7::jsonb,'draft',0,clock_timestamp(),clock_timestamp()) returning *`,
        [id, body.owner ?? null, body.brand ?? null, textField(body, 'category'), textField(body, 'title'), body.type ?? 'physical', JSON.stringify(body.attributes ?? {})]
      );
      return rowResult(result, 201);
    },
    'catalog.products.update': async (request, database) => {
      const body = bodyRecord(request);
      const result = await database.query(
        `update catalog.product set title=coalesce($2,title),category_id=coalesce($3,category_id),attributes=coalesce($4::jsonb,attributes),
        status=coalesce($5,status),version=version+1,updated_at=clock_timestamp() where id=$1 and ($6::bigint is null or version=$6) returning *`,
        [request.input.path.productid!, body.title ?? null, body.category ?? null, body.attributes === undefined ? null : JSON.stringify(body.attributes), body.status ?? null, request.input.expectedVersion ?? null]
      );
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result);
    },
    'catalog.products.archive': async (request, database) =>
      rowResult(
        await database.query(
          `update catalog.product set status='archived',version=version+1,updated_at=clock_timestamp()
      where id=$1 and ($2::bigint is null or version=$2) returning *`,
          [request.input.path.productid!, request.input.expectedVersion ?? null]
        )
      ),
    'catalog.listings.read': async (request, database) => {
      const access = requireAccess(request);
      const query = queryValue(request.input.query.q);
      const category = queryValue(request.input.query.category);
      const product = queryValue(request.input.query.product);
      const pool = queryValue(request.input.query.pool);
      const storefront = access.actor.target === 'storefront';
      const page = queryPage(request);
      if (access.scope.kind === 'supplier') {
        const result = await database.query(
          `select source.id,source.sku_id,coalesce(product.title,source.external_id) title,
        source.status,source.source_version version,source.observed_at cursor_sort,sku.code,product.id product_id,product.product_type,
        product.attributes->>'coverUrl' cover_url,product.attributes->>'subtitle' subtitle from catalog.sourcelisting source
        left join catalog.sku sku on sku.id=source.sku_id left join catalog.product product on product.id=sku.product_id where source.scope_id=$1
        and ($2='' or product.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%' or source.external_id ilike '%'||$2||'%')
        and ($3='' or product.category_id=$3) and ($4='' or product.id=$4)
        and ($5::timestamptz is null or (source.observed_at,source.id)<($5::timestamptz,$6)) order by source.observed_at desc,source.id desc limit $7`,
          [access.scope.id, query, category, product, page.sort, page.id, page.fetch]
        );
        return keysetResult(result, page, 'cursor_sort');
      }
      const result = await database.query(
        `select listing.id,listing.pool_id,listing.sku_id,listing.title,listing.status,listing.effective_at,listing.expires_at,listing.version,listing.updated_at cursor_sort,
        sku.code,product.id product_id,product.product_type,product.attributes->>'coverUrl' cover_url,
        product.attributes->>'subtitle' subtitle from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
        join catalog.product product on product.id=sku.product_id where (exists(select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=listing.scope_id)
          or ($10 and exists(select 1 from organization.unitclosure where ancestor_id=listing.scope_id and descendant_id=$1)))
        and ($2='' or listing.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%') and ($3='' or product.category_id=$3) and ($4='' or product.id=$4)
        and ($5='' or listing.pool_id=$5) and (not $6 or (listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
          and (listing.expires_at is null or listing.expires_at>clock_timestamp())))
        and ($7::timestamptz is null or (listing.updated_at,listing.id)<($7::timestamptz,$8))
        order by listing.updated_at desc,listing.id desc limit $9`,
        [access.scope.id, query, category, product, pool, storefront, page.sort, page.id, page.fetch, access.scope.kind === 'store']
      );
      return keysetResult(result, page, 'cursor_sort');
    },
    'catalog.listings.publish': async (request, database) =>
      rowResult(
        await database.query(
          `update catalog.listing set status='published',effective_at=clock_timestamp(),expires_at=null,
      version=version+1,updated_at=clock_timestamp() where id=$1 and ($2::bigint is null or version=$2) returning *`,
          [request.input.path.listingid!, request.input.expectedVersion ?? null]
        )
      ),
    'catalog.listings.unpublish': async (request, database) =>
      rowResult(
        await database.query(
          `update catalog.listing set status='unpublished',expires_at=clock_timestamp(),
      version=version+1,updated_at=clock_timestamp() where id=$1 and ($2::bigint is null or version=$2) returning *`,
          [request.input.path.listingid!, request.input.expectedVersion ?? null]
        )
      ),
    'catalog.listings.batch': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) throw new Error('VALIDATION_FAILED:ids');
      const state = body.action === 'publish' ? 'published' : 'unpublished';
      const result = await database.query(
        `update catalog.listing set status=$3,effective_at=case when $3='published' then clock_timestamp() else effective_at end,
        expires_at=case when $3='unpublished' then clock_timestamp() else null end,version=version+1,updated_at=clock_timestamp()
        where scope_id=$1 and id=any($2::text[]) returning id,status,version`,
        [access.scope.id, body.ids, state]
      );
      return { status: 200, body: { items: result.rows, count: result.rowCount } };
    },
  });
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 200) ?? '';
}
