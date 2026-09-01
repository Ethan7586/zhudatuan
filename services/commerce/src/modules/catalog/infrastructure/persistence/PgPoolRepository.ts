import { randomUUID } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PoolRepository } from '../../application/port/PoolRepository';
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
      `select pool.id,pool.kind,pool.name,pool.status,pool.version,count(item.sku_id)::integer item_count
      from catalog.pool pool left join catalog.poolitem item on item.pool_id=pool.id where pool.scope_id=any($1::text[])
      and ($2::text is null or (pool.name,pool.id)>($2,$3)) group by pool.id order by pool.name,pool.id limit $4`,
      [visible, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async attach(context: WriteTransactionContext, accessScope: string, mall: string, pool: string) {
    const database = this.transactions.database(context);
    await this.scopes.assert(context, accessScope, mall);
    const result = await database.query(
      `insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
      values($1,$2,'selected','active',clock_timestamp(),clock_timestamp()) on conflict(mall_id,pool_id)
      do update set status='active',effective_at=clock_timestamp(),expires_at=null returning *`,
      [mall, pool]
    );
    return result.rows[0] ? Object.freeze({ ...result.rows[0] }) : null;
  }
  async detach(context: WriteTransactionContext, accessScope: string, mall: string, pool: string) {
    const database = this.transactions.database(context);
    await this.scopes.assert(context, accessScope, mall);
    const result = await database.query(`update catalog.poolbinding set status='disabled',expires_at=clock_timestamp() where pool_id=$1 and mall_id=$2 and status='active' returning *`, [pool, mall]);
    return result.rows[0] ? Object.freeze({ ...result.rows[0] }) : null;
  }
  async allocate(context: WriteTransactionContext, input: Parameters<PoolRepository['allocate']>[1]) {
    const database = this.transactions.database(context);
    if (!input.platform) await this.scopes.assert(database.transaction, input.accessScope, input.scope);
    const result = await database.query(`insert into catalog.pool(id,scope_id,kind,name,status,version) values($1,$2,$3,$4,'active',0) returning *`, [`pool:${randomUUID()}`, input.scope, input.kind, input.name]);
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
