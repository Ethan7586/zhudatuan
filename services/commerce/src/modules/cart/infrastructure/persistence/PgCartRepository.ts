import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CartLineMutation } from '../../domain/model/CartLine';
import type { CartView } from '../../domain/model/Cart';
import type { CartRepository } from '../../application/port/CartRepository';
import type { CartReadPort, CartSnapshot } from '../../public/CartReadPort';
import type { CartWritePort } from '../../public/CartWritePort';
import { cartConflict } from '../../domain/error/CartError';

interface CartRow {
  readonly id: string;
  readonly mall_id: string;
  readonly application_id: string;
  readonly version: number;
  readonly updated_at: Date | string;
}

export class PgCartRepository implements CartRepository, CartReadPort, CartWritePort {
  async currentView(database: OperationDatabase, member: string, mall: string, application: string): Promise<CartView | null> {
    const cart = await database.query<{ id: string }>(`select id from cart.cart where member_id=$1 and mall_id=$2 and application_id=$3 and state='active' order by updated_at desc,id limit 1`, [member, mall, application]);
    return cart.rows[0] ? this.snapshot(database, cart.rows[0].id) : null;
  }

  async lockOrCreate(database: OperationDatabase, member: string, mall: string, application: string, expectedVersion: number): Promise<string> {
    let cart = await database.query<{ id: string; version: number }>(`select id,version::integer from cart.cart where member_id=$1 and mall_id=$2 and application_id=$3 and state='active' for update`, [member, mall, application]);
    if (!cart.rows[0]) {
      if (expectedVersion !== 0) return cartConflict();
      cart = await database.query<{ id: string; version: number }>(
        `insert into cart.cart(id,member_id,mall_id,application_id,state,version,updated_at)
        values($1,$2,$3,$4,'active',0,clock_timestamp()) on conflict(member_id,mall_id,application_id) where state='active' do nothing
        returning id,version::integer`,
        [`cart:${randomUUID()}`, member, mall, application]
      );
      if (!cart.rows[0]) return cartConflict();
    } else if (cart.rows[0].version !== expectedVersion) return cartConflict();
    return cart.rows[0].id;
  }

  async lockExisting(database: OperationDatabase, member: string, mall: string, application: string, expectedVersion: number): Promise<string> {
    const cart = await database.query<{ id: string }>(`select id from cart.cart where member_id=$1 and mall_id=$2 and application_id=$3 and state='active' and version=$4 for update`, [member, mall, application, expectedVersion]);
    return cart.rows[0]?.id ?? cartConflict();
  }

  async lineVersions(database: OperationDatabase, cart: string, listings: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (listings.length === 0) return new Map();
    const result = await database.query<{ listing_id: string; version: number }>(`select listing_id,version::integer from cart.item where cart_id=$1 and listing_id=any($2::text[]) order by listing_id for update`, [
      cart,
      [...listings].sort(),
    ]);
    return new Map(result.rows.map((line) => [line.listing_id, line.version]));
  }

  async mutate(database: OperationDatabase, cart: string, changes: readonly CartLineMutation[]): Promise<void> {
    if (changes.length === 0) return;
    const payload = changes.map((line) => ({
      listing: line.listing,
      quantity: line.quantity,
      lineversion: line.version,
      sku: line.sku || null,
      listingversion: line.listingVersion || null,
      title: line.title || null,
      unitminor: line.unitMinor,
      currency: line.currency || null,
      priceversion: line.priceVersion || null,
    }));
    const changed = await database.query(
      `with input as(select item.listing,item.quantity,item.lineversion,item.sku,item.listingversion,item.title,
        item.unitminor,item.currency,item.priceversion from jsonb_to_recordset($2::jsonb) as item(listing text,quantity integer,
        lineversion integer,sku text,listingversion text,title text,unitminor bigint,currency text,priceversion text)),
      removed as(delete from cart.item target using input where target.cart_id=$1 and target.listing_id=input.listing
        and target.version=input.lineversion and input.quantity=0 returning target.listing_id),
      updated as(update cart.item target set quantity=input.quantity,sku_id=input.sku,listing_version=input.listingversion,
        title_snapshot=input.title,unit_minor=input.unitminor,currency=input.currency,price_version=input.priceversion,version=target.version+1 from input
        where target.cart_id=$1 and target.listing_id=input.listing and target.version=input.lineversion and input.quantity>0 returning target.listing_id),
      inserted as(insert into cart.item(cart_id,listing_id,sku_id,quantity,listing_version,title_snapshot,unit_minor,currency,price_version,version)
        select $1,input.listing,input.sku,input.quantity,input.listingversion,input.title,input.unitminor,input.currency,input.priceversion,0
        from input where input.quantity>0 and input.lineversion is null returning listing_id)
      select listing_id from removed union all select listing_id from updated union all select listing_id from inserted`,
      [cart, JSON.stringify(payload)]
    );
    if (changed.rows.length) await database.query('update cart.cart set version=version+1,updated_at=clock_timestamp() where id=$1', [cart]);
  }

  async snapshot(database: OperationDatabase, cart: string): Promise<CartView> {
    const result = await database.query<CartView & CartRow>(
      `select target.id,target.mall_id,target.application_id,target.version,target.updated_at,
      coalesce(jsonb_agg(jsonb_build_object('listing',item.listing_id,'sku',item.sku_id,'quantity',item.quantity,
        'version',item.version,'title',item.title_snapshot) order by item.listing_id) filter(where item.listing_id is not null),'[]') items
      from cart.cart target left join cart.item item on item.cart_id=target.id where target.id=$1 group by target.id`,
      [cart]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('CART_EMPTY');
    return Object.freeze(row);
  }

  async current(database: OperationDatabase, member: string, mall: string): Promise<CartSnapshot> {
    const selected = await database.query<{ id: string }>(`select id from cart.cart where member_id=$1 and mall_id=$2 and state='active' order by updated_at desc,id limit 1`, [member, mall]);
    if (!selected.rows[0]) throw new DomainError('CART_EMPTY');
    return this.read(database, selected.rows[0].id, member, mall);
  }

  async read(database: OperationDatabase, cart: string, member: string, mall: string): Promise<CartSnapshot> {
    const selected = await database.query<{ id: string; application_id: string; version: number }>(`select id,application_id,version::integer from cart.cart where id=$1 and member_id=$2 and mall_id=$3 and state='active'`, [
      cart,
      member,
      mall,
    ]);
    const row = selected.rows[0];
    if (!row) return cartConflict();
    const items = await database.query<{ listing_id: string; sku_id: string; title_snapshot: string; quantity: number; listing_version: string; unit_minor: number; currency: string; price_version: string; version: number }>(
      `select listing_id,sku_id,title_snapshot,quantity::integer,listing_version,unit_minor::float8 unit_minor,
      currency,price_version,version::integer from cart.item where cart_id=$1 order by listing_id`,
      [row.id]
    );
    return Object.freeze({
      id: row.id,
      application: row.application_id,
      version: row.version,
      items: Object.freeze(
        items.rows.map((item) =>
          Object.freeze({
            listing: item.listing_id,
            sku: item.sku_id,
            title: item.title_snapshot,
            quantity: item.quantity,
            listingVersion: item.listing_version,
            unitMinor: item.unit_minor,
            currency: item.currency,
            priceVersion: item.price_version,
            version: item.version,
          })
        )
      ),
    });
  }

  async lockActive(database: OperationDatabase, cart: string, member: string, mall: string, expectedVersion: number): Promise<void> {
    const locked = await database.query(`select id from cart.cart where id=$1 and member_id=$2 and mall_id=$3 and state='active' and version=$4 for update`, [cart, member, mall, expectedVersion]);
    if (!locked.rows[0]) cartConflict();
  }

  async convert(database: OperationDatabase, cart: string): Promise<void> {
    const changed = await database.query(`update cart.cart set state='converted',version=version+1,updated_at=clock_timestamp() where id=$1 and state='active' returning id`, [cart]);
    if (!changed.rows[0]) cartConflict();
  }
}
