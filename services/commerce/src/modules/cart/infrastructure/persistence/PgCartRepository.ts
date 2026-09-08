import { randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CartRepository } from '../../application/port/CartRepository';
import { cartConflict } from '../../domain/error/CartError';
import type { Cart, CartOwner } from '../../domain/model/Cart';
import type { CartLineMutation } from '../../domain/model/CartLine';
import { readCart } from './CartRows';

export class PgCartRepository implements CartRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async current(context: ReadTransactionContext, owner: CartOwner): Promise<Cart | null> {
    const database = this.transactions.database(context);
    const selected =
      owner.kind === 'member'
        ? await database.query<{ id: string }>(`select id from cart.cart where owner_kind='member' and member_id=$1 and mall_id=$2 and application_id=$3 and state='active'`, [owner.member, owner.mall, owner.application])
        : await database.query<{ id: string }>(`select id from cart.cart where owner_kind='anonymous' and token_digest=$1 and mall_id=$2 and application_id=$3 and state='active'`, [owner.tokenDigest, owner.mall, owner.application]);
    return selected.rows[0] ? readCart(database, selected.rows[0].id) : null;
  }

  async lockOrCreate(context: WriteTransactionContext, owner: CartOwner, expectedVersion: number): Promise<Cart> {
    const current = await this.lock(context, owner, expectedVersion);
    if (current) return current;
    if (expectedVersion !== 0) return cartConflict();
    const database = this.transactions.database(context);
    const id = `cart:${randomUUID()}`;
    const inserted =
      owner.kind === 'member'
        ? await database.query<{ id: string }>(
            `insert into cart.cart(id,owner_kind,member_id,token_digest,mall_id,application_id,state,version,updated_at)
           values($1,'member',$2,null,$3,$4,'active',0,clock_timestamp()) on conflict(member_id,mall_id,application_id) where state='active' and owner_kind='member' do nothing returning id`,
            [id, owner.member, owner.mall, owner.application]
          )
        : await database.query<{ id: string }>(
            `insert into cart.cart(id,owner_kind,member_id,token_digest,mall_id,application_id,state,version,updated_at)
           values($1,'anonymous',null,$2,$3,$4,'active',0,clock_timestamp()) on conflict(token_digest,mall_id,application_id) where state='active' and owner_kind='anonymous' do nothing returning id`,
            [id, owner.tokenDigest, owner.mall, owner.application]
          );
    if (!inserted.rows[0]) return cartConflict();
    return readCart(database, inserted.rows[0].id);
  }

  async lockExisting(context: WriteTransactionContext, owner: CartOwner, expectedVersion: number): Promise<Cart> {
    return (await this.lock(context, owner, expectedVersion)) ?? cartConflict();
  }

  async mutate(context: WriteTransactionContext, cart: Cart, changes: readonly CartLineMutation[]): Promise<Cart> {
    const compact = [...new Map(changes.map((line) => [line.listing, line])).values()];
    if (compact.length === 0) return cart;
    const database = this.transactions.database(context);
    const payload = compact.map((line) => ({ listing: line.listing, sku: line.sku, quantity: line.quantity, selected: line.selected, lineversion: line.version }));
    const changed = await database.query<{ version: number }>(MUTATE_SQL, [cart.id, JSON.stringify(payload), cart.version]);
    if (!changed.rows[0]) return cartConflict();
    return readCart(database, cart.id);
  }

  snapshot(context: ReadTransactionContext, cart: string): Promise<Cart> {
    return readCart(this.transactions.database(context), cart);
  }

  async prepareMerge(context: WriteTransactionContext, tokenDigest: string, owner: Extract<CartOwner, { kind: 'member' }>) {
    const database = this.transactions.database(context);
    const claim = await database.query<{ member_id: string; mall_id: string; application_id: string }>(`select member_id,mall_id,application_id from cart.mergeclaim where token_digest=$1`, [tokenDigest]);
    if (claim.rows[0])
      return claim.rows[0].member_id === owner.member && claim.rows[0].mall_id === owner.mall && claim.rows[0].application_id === owner.application
        ? Object.freeze({ state: 'completed' as const })
        : Object.freeze({ state: 'none' as const });
    const source = await database.query<{ id: string }>(`select id from cart.cart where owner_kind='anonymous' and token_digest=$1 and mall_id=$2 and application_id=$3 and state='active'`, [tokenDigest, owner.mall, owner.application]);
    if (!source.rows[0]) return Object.freeze({ state: 'none' as const });
    const target = await this.ensureMember(database, owner);
    await database.query(`select id from cart.cart where id=any($1::text[]) order by id for update`, [[source.rows[0].id, target].sort()]);
    return Object.freeze({ state: 'ready' as const, source: await readCart(database, source.rows[0].id), target: await readCart(database, target) });
  }

  async completeMerge(context: WriteTransactionContext, source: Cart, target: Cart, changes: readonly CartLineMutation[]): Promise<Cart> {
    const database = this.transactions.database(context);
    const merged = changes.length > 0 ? await this.mutate(context, target, changes) : target;
    const consumed = await database.query(`update cart.cart set state='merged',version=version+1,updated_at=clock_timestamp() where id=$1 and state='active' and version=$2 returning id`, [source.id, source.version]);
    if (!consumed.rows[0] || source.owner.kind !== 'anonymous' || target.owner.kind !== 'member') return cartConflict();
    await database.query(`insert into cart.mergeclaim(token_digest,member_id,mall_id,application_id,target_cart_id,merged_at) values($1,$2,$3,$4,$5,clock_timestamp())`, [
      source.owner.tokenDigest,
      target.owner.member,
      target.owner.mall,
      target.owner.application,
      target.id,
    ]);
    return merged;
  }

  private async lock(context: WriteTransactionContext, owner: CartOwner, expectedVersion: number): Promise<Cart | null> {
    const database = this.transactions.database(context);
    const selected =
      owner.kind === 'member'
        ? await database.query<{ id: string; version: number }>(`select id,version::integer from cart.cart where owner_kind='member' and member_id=$1 and mall_id=$2 and application_id=$3 and state='active' for update`, [
            owner.member,
            owner.mall,
            owner.application,
          ])
        : await database.query<{ id: string; version: number }>(`select id,version::integer from cart.cart where owner_kind='anonymous' and token_digest=$1 and mall_id=$2 and application_id=$3 and state='active' for update`, [
            owner.tokenDigest,
            owner.mall,
            owner.application,
          ]);
    if (!selected.rows[0]) return null;
    if (Number(selected.rows[0].version) !== expectedVersion) return cartConflict();
    return readCart(database, selected.rows[0].id);
  }

  private async ensureMember(database: SqlExecutor, owner: Extract<CartOwner, { kind: 'member' }>): Promise<string> {
    const id = `cart:${randomUUID()}`;
    const inserted = await database.query<{ id: string }>(
      `insert into cart.cart(id,owner_kind,member_id,token_digest,mall_id,application_id,state,version,updated_at)
       values($1,'member',$2,null,$3,$4,'active',0,clock_timestamp()) on conflict(member_id,mall_id,application_id) where state='active' and owner_kind='member' do update set updated_at=cart.cart.updated_at returning id`,
      [id, owner.member, owner.mall, owner.application]
    );
    return inserted.rows[0]!.id;
  }
}

const MUTATE_SQL = `with input as(
  select item.listing,item.sku,item.quantity,item.selected,item.lineversion
  from jsonb_to_recordset($2::jsonb) item(listing text,sku text,quantity integer,selected boolean,lineversion integer)
), removed as(
  delete from cart.item target using input where target.cart_id=$1 and target.listing_id=input.listing
  and target.version=input.lineversion and input.quantity=0 returning target.listing_id
), updated as(
  update cart.item target set sku_id=input.sku,quantity=input.quantity,selected=input.selected,version=target.version+1
  from input where target.cart_id=$1 and target.listing_id=input.listing and target.version=input.lineversion and input.quantity>0 returning target.listing_id
), inserted as(
  insert into cart.item(cart_id,listing_id,sku_id,quantity,selected,version)
  select $1,input.listing,input.sku,input.quantity,input.selected,0 from input where input.quantity>0 and input.lineversion is null returning listing_id
), applied as(
  select listing_id from removed union all select listing_id from updated union all select listing_id from inserted
), bumped as(
  update cart.cart set version=version+1,updated_at=clock_timestamp() where id=$1 and version=$3
  and (select count(*) from applied)=(select count(*) from input) returning version::integer
) select version from bumped`;
