import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { Cart, type CartOwner } from '../../domain/model/Cart';

interface CartRow {
  readonly id: string;
  readonly owner_kind: 'member' | 'anonymous';
  readonly member_id: string | null;
  readonly token_digest: string | null;
  readonly mall_id: string;
  readonly application_id: string;
  readonly version: number;
  readonly updated_at: Date | string;
}

export async function readCart(database: SqlExecutor, id: string): Promise<Cart> {
  const selected = await database.query<CartRow>(
    `select id,owner_kind,member_id,token_digest,mall_id,application_id,version::integer,updated_at from cart.cart where id=$1`,
    [id]
  );
  const row = selected.rows[0];
  if (!row) throw new DomainError('CART_EMPTY');
  const lines = await database.query<{ listing_id: string; sku_id: string; quantity: number; selected: boolean; version: number }>(
    `select listing_id,sku_id,quantity::integer,selected,version::integer from cart.item where cart_id=$1 order by listing_id`,
    [id]
  );
  return new Cart({
    id: row.id,
    owner: owner(row),
    version: Number(row.version),
    updatedAt: row.updated_at,
    lines: lines.rows.map((line) => ({ listing: line.listing_id, sku: line.sku_id, quantity: Number(line.quantity), selected: line.selected, version: Number(line.version) })),
  });
}

function owner(row: CartRow): CartOwner {
  if (row.owner_kind === 'member' && row.member_id) return Object.freeze({ kind: 'member', member: row.member_id, mall: row.mall_id, application: row.application_id });
  if (row.owner_kind === 'anonymous' && row.token_digest) return Object.freeze({ kind: 'anonymous', tokenDigest: row.token_digest, mall: row.mall_id, application: row.application_id });
  throw new Error('CART_OWNER_CORRUPT');
}
