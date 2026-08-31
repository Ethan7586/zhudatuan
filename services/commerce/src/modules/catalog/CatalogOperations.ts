import { DomainError } from '../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, reject, requireAccess, rowResult, type OperationDatabase } from '../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { catalogImportOperations } from './application/CatalogImportOperations';
import { CATALOG_INVENTORY_PORT } from '../inventory/public';
import { ORGANIZATION_READ_PORT, type OrganizationReadPort } from '../organization/public';
import { CATALOG_PARTNER_PORT } from '../partner/public';
import { CATALOG_PRICING_PORT } from '../pricing/public';

export function catalogOperations(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const inventory = context.ports.get(CATALOG_INVENTORY_PORT);
  const organizations = context.ports.get(ORGANIZATION_READ_PORT);
  const partners = context.ports.get(CATALOG_PARTNER_PORT);
  const pricing = context.ports.get(CATALOG_PRICING_PORT);
  return new ModuleOperations('catalog', pool, context.service(AUDIT_SINK), {
    ...catalogImportOperations(context),
    'catalog.pools.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const scope = await organizations.scope(database, access.scope.id);
      const scopes = visibleScopes(scope, false);
      const result = await database.query(
        `select pool.id,pool.kind,pool.name,pool.status,pool.version,count(item.sku_id)::integer item_count
        from catalog.pool pool left join catalog.poolitem item on item.pool_id=pool.id where pool.scope_id=any($1::text[])
        and ($2::text is null or (pool.name,pool.id)>($2,$3)) group by pool.id order by pool.name,pool.id limit $4`,
        [scopes, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'name');
    },
    'catalog.pools.attach': async (request, database) => {
      const access = requireAccess(request);
      await assertVisibleScope(database, organizations, access.scope.id, request.input.path.scopeid!);
      const result = await database.query(
        `insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
        values($1,$2,'selected','active',clock_timestamp(),clock_timestamp()) on conflict(mall_id,pool_id) do update set status='active',effective_at=clock_timestamp(),expires_at=null returning *`,
        [request.input.path.scopeid!, request.input.path.poolid!]
      );
      return rowResult(result);
    },
    'catalog.pools.detach': async (request, database) => {
      const access = requireAccess(request);
      await assertVisibleScope(database, organizations, access.scope.id, request.input.path.scopeid!);
      return rowResult(
        await database.query(
          `update catalog.poolbinding set status='disabled',expires_at=clock_timestamp()
      where pool_id=$1 and mall_id=$2 and status='active' returning *`,
          [request.input.path.poolid!, request.input.path.scopeid!]
        )
      );
    },
    'catalog.pools.allocate': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      if (access.scope.kind !== 'platform') await assertVisibleScope(database, organizations, access.scope.id, textField(body, 'scope'));
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
      return rowResult(result, 201);
    },
    'catalog.product.detail.read': async (request, database) => {
      const access = requireAccess(request);
      const scope = await organizations.scope(database, access.scope.id);
      const allowedScopes = visibleScopes(scope, access.scope.kind === 'store');
      const result = await database.query(
        `select product.id,product.title,product.product_type,product.status,product.version::text version,
          product.category_id,product.brand_id,product.owner_partner_id,
          product.attributes->>'coverUrl' cover_url,product.attributes->>'subtitle' subtitle,
          coalesce((select jsonb_agg(jsonb_build_object('id',sku.id,'code',sku.code,'status',sku.status,
            'specifications',coalesce((select jsonb_agg(jsonb_build_object('name',specification.key,'value',specification.value)
              order by specification.key) from jsonb_each_text(sku.specifications) specification),'[]'::jsonb),
            'version',sku.version::text) order by sku.code,sku.id) from catalog.sku sku
            where sku.product_id=product.id),'[]'::jsonb) skus,
          coalesce((select jsonb_agg(jsonb_build_object('id',listing.id,'scope',listing.scope_id,
            'pool',listing.pool_id,'sku',listing.sku_id,'title',listing.title,'status',listing.status,
            'effectiveAt',listing.effective_at,'expiresAt',listing.expires_at,'version',listing.version::text)
            order by listing.updated_at desc,listing.id) from catalog.listing listing
            where listing.sku_id in(select sku.id from catalog.sku sku where sku.product_id=product.id)
              and listing.scope_id=any($2::text[])),'[]'::jsonb) listings
        from catalog.product product where product.id=$1`,
        [request.input.path.productid!, allowedScopes]
      );
      const product = result.rows[0] as (Record<string, unknown> & Readonly<{ owner_partner_id: string | null; skus: readonly Readonly<{ id: string }>[]; listings: readonly unknown[] }>) | undefined;
      if (!product) reject('LISTING_NOT_PURCHASABLE');
      const ownerScope = product.owner_partner_id ? await partners.scope(database, product.owner_partner_id) : null;
      if (product.listings.length === 0 && (ownerScope === null || !allowedScopes.includes(ownerScope))) reject('LISTING_NOT_PURCHASABLE');
      const skus = product.skus.map(({ id }) => id);
      const [stock, prices] = await Promise.all([inventory.stock(database, skus, allowedScopes), pricing.prices(database, skus, allowedScopes)]);
      return { status: 200, body: { ...product, inventory: stock, prices } };
    },
    'catalog.products.create': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const suffix = randomUUID();
      const id = `product:${suffix}`;
      const sku = `sku:${suffix}`;
      const category = await resolveCategory(database, textField(body, 'category'));
      const result = await database.query(
        `insert into catalog.product(id,scope_id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
        values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'draft',0,clock_timestamp(),clock_timestamp()) returning *`,
        [id, access.scope.id, body.owner ?? null, body.brand ?? null, category, textField(body, 'title'), body.type ?? 'physical', JSON.stringify(body.attributes ?? {})]
      );
      await database.query(`insert into catalog.sku(id,product_id,code,specifications,status,version) values($1,$2,$3,'{}'::jsonb,'draft',0)`, [sku, id, `LOCAL-${suffix}`]);
      await database.query(
        `insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
        values($1,$2,null,$3,$4,'draft',null,null,0,clock_timestamp(),clock_timestamp())`,
        [`listing:${suffix}`, access.scope.id, sku, textField(body, 'title')]
      );
      return rowResult(result, 201);
    },
    'catalog.products.update': async (request, database) => {
      const access = requireAccess(request);
      const scope = await organizations.scope(database, access.scope.id);
      const scopes = visibleScopes(scope, false);
      const body = bodyRecord(request);
      const category = typeof body.category === 'string' ? await resolveCategory(database, body.category) : null;
      const result = await database.query(
        `update catalog.product set title=coalesce($2,title),category_id=coalesce($3,category_id),attributes=coalesce($4::jsonb,attributes),
        status=coalesce($5,status),version=version+1,updated_at=clock_timestamp() where id=$1 and ($6::bigint is null or version=$6)
        and scope_id=any($7::text[]) returning *`,
        [request.input.path.productid!, body.title ?? null, category, body.attributes === undefined ? null : JSON.stringify(body.attributes), body.status ?? null, request.input.expectedVersion ?? null, scopes]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      if (typeof body.title === 'string') {
        await database.query(
          `update catalog.listing listing set title=$2,updated_at=clock_timestamp()
          where listing.sku_id in(select sku.id from catalog.sku sku where sku.product_id=$1)`,
          [request.input.path.productid!, body.title]
        );
      }
      if (body.status === 'archived') await unpublishProductListings(database, request.input.path.productid!);
      return rowResult(result);
    },
    'catalog.products.archive': async (request, database) => {
      const access = requireAccess(request);
      const scope = await organizations.scope(database, access.scope.id);
      const scopes = visibleScopes(scope, false);
      const result = await database.query(
        `update catalog.product set status='archived',version=version+1,updated_at=clock_timestamp()
      where id=$1 and ($2::bigint is null or version=$2)
      and scope_id=any($3::text[]) returning *`,
        [request.input.path.productid!, request.input.expectedVersion ?? null, scopes]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      await unpublishProductListings(database, request.input.path.productid!);
      return rowResult(result);
    },
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
      const scope = await organizations.scope(database, access.scope.id);
      const scopes = visibleScopes(scope, access.scope.kind === 'store');
      const result = await database.query(
        `select listing.id,listing.pool_id,listing.sku_id,listing.title,listing.status,listing.effective_at,listing.expires_at,listing.version,listing.updated_at cursor_sort,
        sku.code,product.id product_id,product.product_type,product.attributes->>'coverUrl' cover_url,
        product.attributes->>'subtitle' subtitle from catalog.listing listing join catalog.sku sku on sku.id=listing.sku_id
        join catalog.product product on product.id=sku.product_id where listing.scope_id=any($1::text[])
        and ($2='' or listing.title ilike '%'||$2||'%' or sku.code ilike '%'||$2||'%') and ($3='' or product.category_id=$3) and ($4='' or product.id=$4)
        and ($5='' or listing.pool_id=$5) and (not $6 or (listing.status='published' and (listing.effective_at is null or listing.effective_at<=clock_timestamp())
          and (listing.expires_at is null or listing.expires_at>clock_timestamp())))
        and ($7::timestamptz is null or (listing.updated_at,listing.id)<($7::timestamptz,$8))
        order by listing.updated_at desc,listing.id desc limit $9`,
        [scopes, query, category, product, pool, storefront, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'cursor_sort');
    },
    'catalog.listings.publish': async (request, database) => {
      const access = requireAccess(request);
      const scope = await organizations.scope(database, access.scope.id);
      const scopes = visibleScopes(scope, false);
      const result = await database.query(
        `update catalog.listing listing set status='published',effective_at=clock_timestamp(),expires_at=null,
      version=listing.version+1,updated_at=clock_timestamp() where listing.id=$1 and listing.scope_id=any($3::text[])
      and ($2::bigint is null or listing.version=$2) and exists(select 1 from catalog.sku sku
        join catalog.product product on product.id=sku.product_id where sku.id=listing.sku_id and product.status='active') returning listing.*`,
        [request.input.path.listingid!, request.input.expectedVersion ?? null, scopes]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      return rowResult(result);
    },
    'catalog.listings.unpublish': async (request, database) => {
      const access = requireAccess(request);
      const scope = await organizations.scope(database, access.scope.id);
      const scopes = visibleScopes(scope, false);
      const result = await database.query(
        `update catalog.listing set status='unpublished',expires_at=clock_timestamp(),
      version=version+1,updated_at=clock_timestamp() where id=$1 and scope_id=any($3::text[]) and ($2::bigint is null or version=$2) returning *`,
        [request.input.path.listingid!, request.input.expectedVersion ?? null, scopes]
      );
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      return rowResult(result);
    },
    'catalog.listings.batch': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) throw new DomainError('VALIDATION_FAILED', { field: 'ids' });
      const state = body.action === 'publish' ? 'published' : 'unpublished';
      const scope = await organizations.scope(database, access.scope.id);
      const scopes = visibleScopes(scope, false);
      const result = await database.query(
        `update catalog.listing set status=$3,effective_at=case when $3='published' then clock_timestamp() else effective_at end,
        expires_at=case when $3='unpublished' then clock_timestamp() else null end,version=version+1,updated_at=clock_timestamp()
        where scope_id=any($1::text[]) and id=any($2::text[]) and ($3<>'published' or exists(
          select 1 from catalog.sku sku join catalog.product product on product.id=sku.product_id
          where sku.id=catalog.listing.sku_id and product.status='active')) returning id,status,version`,
        [scopes, body.ids, state]
      );
      return { status: 200, body: { items: result.rows, count: result.rowCount } };
    },
  });
}

function visibleScopes(scope: Readonly<{ id: string; ancestors: readonly string[]; descendants: readonly string[] }>, includeAncestors: boolean): readonly string[] {
  return Object.freeze([...new Set([scope.id, ...scope.descendants, ...(includeAncestors ? scope.ancestors : [])])]);
}

async function assertVisibleScope(database: OperationDatabase, organizations: OrganizationReadPort, accessScopeId: string, targetScopeId: string): Promise<void> {
  const scope = await organizations.scope(database, accessScopeId);
  if (!visibleScopes(scope, false).includes(targetScopeId)) reject('SCOPE_DENIED');
}

function queryValue(value: string | readonly string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 200) ?? '';
}

async function resolveCategory(database: OperationDatabase, value: string): Promise<string> {
  const category = value.trim();
  const result = await database.query<{ id: string }>('select id from catalog.category where id=$1 or name=$1 order by case when id=$1 then 0 else 1 end limit 1', [category]);
  if (!result.rows[0]) throw new DomainError('VALIDATION_FAILED', { field: 'category' });
  return result.rows[0].id;
}

async function unpublishProductListings(database: OperationDatabase, productId: string): Promise<void> {
  await database.query(
    `update catalog.listing listing set status='unpublished',expires_at=clock_timestamp(),version=listing.version+1,updated_at=clock_timestamp()
    from catalog.sku sku where sku.id=listing.sku_id and sku.product_id=$1
      and listing.status<>'unpublished'`,
    [productId]
  );
}
