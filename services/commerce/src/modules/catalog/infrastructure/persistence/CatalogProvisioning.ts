import { randomUUID } from 'node:crypto';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';

export async function provisionCatalogPool(database: SqlExecutor, input: Readonly<{ mall: string; name: string; source?: string }>): Promise<string> {
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

export async function activeCatalogBinding(database: SqlExecutor, malls: readonly string[]): Promise<Readonly<{ mall: string; pool: string }> | null> {
  if (malls.length === 0) return null;
  const result = await database.query<{ mall_id: string; pool_id: string }>(
    `select binding.mall_id,binding.pool_id from catalog.poolbinding binding join catalog.pool pool on pool.id=binding.pool_id and pool.status='active'
       where binding.mall_id=any($1::text[]) and binding.status='active' and (binding.effective_at is null or binding.effective_at<=clock_timestamp())
       and (binding.expires_at is null or binding.expires_at>clock_timestamp()) order by binding.mall_id,binding.pool_id limit 1`,
    [malls]
  );
  const row = result.rows[0];
  return row ? Object.freeze({ mall: row.mall_id, pool: row.pool_id }) : null;
}
