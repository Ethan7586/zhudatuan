import type { Client } from 'pg';

export const LOCAL_PRICEBOOK = Object.freeze({
  id: 'pricebook:local:zhudatuan',
  scope: 'mall-zhudatuan',
  currency: 'CNY',
  name: '主打团福利商城验收价目表',
});

export async function ensureLocalPricebook(database: Pick<Client, 'query'>): Promise<void> {
  const stale = await database.query<{ id: string }>(
    `select id from pricing.pricebook where scope_id=$2 and name=$3 and id<>$1 for update`,
    [LOCAL_PRICEBOOK.id, LOCAL_PRICEBOOK.scope, LOCAL_PRICEBOOK.name]
  );
  const staleIds = stale.rows.map(({ id }) => id);
  if (staleIds.length > 0) {
    await database.query(
      `update pricing.pricebook set name='__local_rekey__'||md5(id),status='retired',version=version+1 where id=any($1::text[])`,
      [staleIds]
    );
  }
  await database.query(
    `insert into pricing.pricebook(id,scope_id,currency,name,status,version)
    values($1,$2,$3,$4,'active',1)
    on conflict(id) do update set scope_id=excluded.scope_id,currency=excluded.currency,name=excluded.name,status='active',
      version=pricing.pricebook.version+1`,
    [LOCAL_PRICEBOOK.id, LOCAL_PRICEBOOK.scope, LOCAL_PRICEBOOK.currency, LOCAL_PRICEBOOK.name]
  );
  if (staleIds.length === 0) return;
  await database.query(`update pricing.price set book_id=$1 where book_id=any($2::text[])`, [LOCAL_PRICEBOOK.id, staleIds]);
  await database.query(`delete from pricing.pricebook where id=any($1::text[])`, [staleIds]);
}
