import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { localSecret } from './LocalSecrets';
import { LOCAL_OWNER } from './LocalOwner';

const environment = localSeedEnvironment();
const database = new Client({ connectionString: await localSecret(environment.adminDatabaseConnectionRef) });
const cart = 'cart:journey:ethan';
const listing = 'listing:mall-zhudatuan:sku:visual:care';

await database.connect();
try {
  await database.query('begin');
  await database.query(`delete from cart.item where cart_id in(select id from cart.cart where member_id=$1 and mall_id=$2 and state='active')`, [LOCAL_OWNER.member, LOCAL_OWNER.mall]);
  await database.query(`update cart.cart set state='abandoned',updated_at=clock_timestamp(),version=version+1 where member_id=$1 and mall_id=$2 and state='active' and id<>$3`, [LOCAL_OWNER.member, LOCAL_OWNER.mall, cart]);
  await database.query(
    `insert into cart.cart(id,member_id,mall_id,application_id,state,version,updated_at)
    values($1,$2,$3,'application:zhudatuan:local','active',1,'2026-09-01T00:00:00Z')
    on conflict(id) do update set member_id=excluded.member_id,mall_id=excluded.mall_id,application_id=excluded.application_id,
      state='active',version=cart.cart.version+1,updated_at=excluded.updated_at`,
    [cart, LOCAL_OWNER.member, LOCAL_OWNER.mall]
  );
  await database.query(
    `insert into cart.item(cart_id,listing_id,sku_id,quantity,listing_version,version,title_snapshot,unit_minor,currency,price_version)
    select $1,listing.id,listing.sku_id,1,listing.version::text,1,listing.title,price.amount_minor,book.currency,price.id
    from catalog.listing listing
    join pricing.pricebook book on book.scope_id=listing.scope_id and book.status='active'
    join pricing.price price on price.book_id=book.id and price.sku_id=listing.sku_id
      and price.effective_at<=clock_timestamp() and (price.expires_at is null or price.expires_at>clock_timestamp())
    where listing.id=$2 order by price.effective_at desc,price.id limit 1
    on conflict(cart_id,listing_id) do update set quantity=1,listing_version=excluded.listing_version,
      title_snapshot=excluded.title_snapshot,unit_minor=excluded.unit_minor,currency=excluded.currency,
      price_version=excluded.price_version,version=cart.item.version+1`,
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
