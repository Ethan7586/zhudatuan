import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { localSecret } from './LocalSecrets';
import { LOCAL_OWNER } from './LocalOwner';

const environment = localSeedEnvironment();
const database = new Client({ connectionString: await localSecret(environment.adminDatabaseConnectionRef) });
const listing = 'listing:mall-zhudatuan:sku:visual:care';
const application = 'application:zhudatuan:local';

await database.connect();
try {
  await database.query('begin');
  await database.query(`update cart.cart set state='abandoned',updated_at=clock_timestamp(),version=version+1 where member_id=$1 and mall_id=$2 and application_id<>$3 and state='active'`, [LOCAL_OWNER.member, LOCAL_OWNER.mall, application]);
  const selected = await database.query<{ id: string }>(
    `insert into cart.cart(id,member_id,mall_id,application_id,state,version,updated_at)
    values($1,$2,$3,$4,'active',0,clock_timestamp())
    on conflict(member_id,mall_id,application_id) where state='active' and owner_kind='member'
    do update set version=cart.cart.version+1,updated_at=clock_timestamp()
    returning id`,
    [`cart:journey:${randomUUID()}`, LOCAL_OWNER.member, LOCAL_OWNER.mall, application]
  );
  const cart = selected.rows[0]?.id;
  if (!cart) throw new Error('LOCAL_JOURNEY_CART_UNAVAILABLE');
  await database.query(`delete from cart.item where cart_id=$1`, [cart]);
  await database.query(
    `insert into cart.item(cart_id,listing_id,sku_id,quantity,version,selected)
    select $1,listing.id,listing.sku_id,1,0,true
    from catalog.listing listing
    where listing.id=$2
    on conflict(cart_id,sku_id) do update set quantity=1,selected=true,version=cart.item.version+1`,
    [cart, listing]
  );
  await database.query(
    `insert into member.favorite(member_id,listing_id,created_at) values($1,$2,'2026-09-01T00:00:00Z')
    on conflict(member_id,listing_id) do nothing`,
    [LOCAL_OWNER.member, listing]
  );
  const result = await database.query<{ valid: boolean }>(`select
    exists(select 1 from cart.cart where id=$1 and member_id=$2 and mall_id=$3 and state='active')
    and exists(select 1 from cart.item where cart_id=$1 and listing_id=$4 and quantity=1)
    and exists(select 1 from member.favorite where member_id=$2 and listing_id=$4) valid`, [cart, LOCAL_OWNER.member, LOCAL_OWNER.mall, listing]);
  if (result.rows[0]?.valid !== true) throw new Error('LOCAL_JOURNEY_SEED_INCOMPLETE');
  await database.query('commit');
  process.stdout.write('LOCAL_JOURNEY_SEEDED cart=1 favorite=1\n');
} catch (cause) {
  await database.query('rollback');
  throw cause;
} finally {
  await database.end();
}
