import { randomUUID } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { PoolRepository } from '../../application/port/PoolRepository';
import { Pool } from '../../domain/model/Pool';
import type { CatalogScopeReader } from './CatalogScopeReader';
export class PgPoolRepository implements PoolRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly scopes: CatalogScopeReader
  ) {}
  async read(context: ReadTransactionContext, scope: string, page: Parameters<PoolRepository['read']>[2]) {
    const database = this.transactions.database(context);
    const visible = await this.scopes.visible(context, scope, false);
    const result = await database.query(
      `select pool.id,pool.kind,pool.name,pool.status,pool.version,count(item.sku_id) filter(where item.state='included')::integer item_count
      from catalog.pool pool left join catalog.poolitem item on item.pool_id=pool.id where (pool.scope_id=any($1::text[])
      or exists(select 1 from catalog.poolbinding binding where binding.pool_id=pool.id and binding.mall_id=any($1::text[]) and binding.status='active'
        and (binding.effective_at is null or binding.effective_at<=clock_timestamp()) and (binding.expires_at is null or binding.expires_at>clock_timestamp())))
      and ($2::text is null or (pool.name,pool.id)>($2,$3)) group by pool.id order by pool.name,pool.id limit $4`,
      [visible, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async attach(context: WriteTransactionContext, accessScope: string, mall: string, pool: string, expectedVersion: number) {
    const database = this.transactions.database(context);
    await this.scopes.assert(context, accessScope, mall);
    const result = await database.query(
      `with changed as(update catalog.pool set version=version+1 where id=$2 and version=$3 and status='active' returning id)
      insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
      select $1,changed.id,'selected','active',clock_timestamp(),clock_timestamp() from changed on conflict(mall_id,pool_id)
      do update set status='active',effective_at=clock_timestamp(),expires_at=null returning *`,
      [mall, pool, expectedVersion]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...result.rows[0] });
  }
  async detach(context: WriteTransactionContext, accessScope: string, mall: string, pool: string, expectedVersion: number) {
    const database = this.transactions.database(context);
    await this.scopes.assert(context, accessScope, mall);
    const result = await database.query(
      `with binding as(select pool_id from catalog.poolbinding where pool_id=$1 and mall_id=$2 and status='active'),
       changed as(update catalog.pool set version=version+1 where id=$1 and version=$3 and exists(select 1 from binding) returning id)
       update catalog.poolbinding target set status='disabled',expires_at=clock_timestamp() from changed
       where target.pool_id=changed.id and target.mall_id=$2 and target.status='active' returning target.*`,
      [pool, mall, expectedVersion]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...result.rows[0] });
  }
  async allocate(context: WriteTransactionContext, input: Parameters<PoolRepository['allocate']>[1]) {
    const database = this.transactions.database(context);
    if (!input.platform) await this.scopes.assert(database.transaction, input.accessScope, input.scope);
    const source = await database.query<{ sku_id: string }>(`select sku_id from catalog.poolitem where pool_id=$1 and state='included' order by sku_id`, [input.source]);
    const allocated = Pool.allocate({ id: `pool:${randomUUID()}`, scope: input.scope, kind: input.kind, name: input.name, skus: source.rows.map((item) => item.sku_id) }).snapshot();
    const result = await database.query(`insert into catalog.pool(id,scope_id,kind,name,status,version) values($1,$2,$3,$4,$5,$6) returning *`, [
      allocated.id,
      allocated.scope,
      allocated.kind,
      allocated.name,
      allocated.state,
      allocated.version,
    ]);
    const pool = result.rows[0];
    if (!pool || typeof pool.id !== 'string') throw new Error('CATALOG_POOL_CREATE_FAILED');
    await database.query(
      `insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at)
      select $1,item.sku_id,'included',item.source_version,clock_timestamp() from catalog.poolitem item where item.pool_id=$2 on conflict do nothing`,
      [pool.id, input.source]
    );
    return Object.freeze({ ...pool });
  }
}
