import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { FavoriteRepository } from '../../application/port/FavoriteRepository';
import type { FavoriteEntry, FavoriteState } from '../../domain/model/FavoriteList';

interface FavoriteRow {
  readonly listing_id: string;
  readonly created_at: Date | string;
  readonly status: FavoriteState;
  readonly version: number | string;
}

export class PgFavoriteRepository implements FavoriteRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async list(context: ReadTransactionContext, member: string, afterTime: string | null, afterListing: string | null, fetch: number): Promise<readonly FavoriteEntry[]> {
    const result = await this.transactions.database(context).query<FavoriteRow>(
      `select listing_id,created_at,status,version from member.favorite
      where member_id=$1 and status='active'
        and ($2::timestamptz is null or (created_at,listing_id)<($2::timestamptz,$3))
      order by created_at desc,listing_id desc limit $4`,
      [member, afterTime, afterListing, fetch]
    );
    return Object.freeze(result.rows.map(favoriteEntry));
  }

  async change(context: WriteTransactionContext, member: string, listing: string, state: FavoriteState): Promise<FavoriteEntry> {
    const result = await this.transactions.database(context).query<FavoriteRow>(
      `insert into member.favorite(member_id,listing_id,status,created_at,updated_at,version)
      values($1,$2,$3,clock_timestamp(),clock_timestamp(),1)
      on conflict(member_id,listing_id) do update set status=excluded.status,updated_at=clock_timestamp(),version=member.favorite.version+1
      returning listing_id,created_at,status,version`,
      [member, listing, state]
    );
    const row = result.rows[0];
    if (!row) throw new Error('MEMBER_FAVORITE_SAVE_FAILED');
    return favoriteEntry(row);
  }
}

function favoriteEntry(row: FavoriteRow): FavoriteEntry {
  return Object.freeze({
    listing: row.listing_id,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    state: row.status,
    version: Number(row.version),
  });
}
