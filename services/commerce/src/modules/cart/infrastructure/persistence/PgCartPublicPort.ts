import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { cartConflict } from '../../domain/error/CartError';
import type { CartReadPort, CartSnapshot } from '../../public/CartReadPort';
import type { CartWritePort } from '../../public/CartWritePort';

export class PgCartPublicPort implements CartReadPort, CartWritePort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async current(context: ReadTransactionContext, member: string, mall: string): Promise<CartSnapshot> {
    const database = this.transactions.database(context);
    const selected = await database.query<{ id: string }>(
      `select id from cart.cart where owner_kind='member' and member_id=$1 and mall_id=$2 and state='active' order by updated_at desc,id limit 1`,
      [member, mall]
    );
    if (!selected.rows[0]) return cartConflict();
    return this.read(context, selected.rows[0].id, member, mall);
  }

  async read(context: ReadTransactionContext, cart: string, member: string, mall: string): Promise<CartSnapshot> {
    const database = this.transactions.database(context);
    const selected = await database.query<{ id: string; application_id: string; version: number }>(
      `select id,application_id,version::integer from cart.cart where id=$1 and owner_kind='member' and member_id=$2 and mall_id=$3 and state='active'`,
      [cart, member, mall]
    );
    const row = selected.rows[0];
    if (!row) return cartConflict();
    const items = await database.query<{ listing_id: string; sku_id: string; quantity: number; selected: boolean; version: number }>(
      `select listing_id,sku_id,quantity::integer,selected,version::integer from cart.item where cart_id=$1 order by listing_id`,
      [row.id]
    );
    return Object.freeze({
      id: row.id,
      application: row.application_id,
      version: Number(row.version),
      items: Object.freeze(items.rows.map((item) => Object.freeze({ listing: item.listing_id, sku: item.sku_id, quantity: Number(item.quantity), selected: item.selected, version: Number(item.version) }))),
    });
  }

  async lockActive(context: WriteTransactionContext, cart: string, member: string, mall: string, expectedVersion: number): Promise<void> {
    const database = this.transactions.database(context);
    const locked = await database.query(
      `select id from cart.cart where id=$1 and owner_kind='member' and member_id=$2 and mall_id=$3 and state='active' and version=$4 for update`,
      [cart, member, mall, expectedVersion]
    );
    if (!locked.rows[0]) cartConflict();
  }

  async convert(context: WriteTransactionContext, cart: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(`update cart.cart set state='converted',version=version+1,updated_at=clock_timestamp() where id=$1 and state='active' returning id`, [cart]);
    if (!changed.rows[0]) cartConflict();
  }
}
