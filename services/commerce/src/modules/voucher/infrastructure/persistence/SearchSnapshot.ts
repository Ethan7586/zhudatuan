import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';

/** Voucher-owned immutable search snapshot persistence. */
interface SnapshotRow {
  readonly filter_hash: string;
  readonly watermark: Date;
  readonly result_count: number;
  readonly expires_at: Date;
}
export async function readSearchSnapshot(database: SqlExecutor, scope: string, snapshot: string, actor: string, now: Date) {
  const row = (
    await database.query<SnapshotRow>(
      `select filter_hash,watermark,result_count::integer,expires_at
    from voucher.searchsnapshot where id=$1 and scope_id=$2 and created_by=$3`,
      [snapshot, scope, actor]
    )
  ).rows[0];
  if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
  if (new Date(row.expires_at) <= now) throw new DomainError('VOUCHER_EXPORT_NOT_READY');
  return Object.freeze({ snapshot, filterHash: row.filter_hash, watermark: new Date(row.watermark).toISOString(), count: Number(row.result_count), expiresAt: new Date(row.expires_at).toISOString() });
}
