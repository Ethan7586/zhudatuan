import { CAPACITY_MODEL, RUNTIME_LIMITS } from '@shop/config/runtime';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { RuntimeExportWork } from '../../../runtime/public';

export interface ExportPage { readonly cursor: string; readonly cells: readonly unknown[]; }
export interface CredentialPage extends ExportPage {
  readonly credential: string;
  readonly pool: string;
  readonly numberCiphertext: string;
  readonly secretCiphertext: string;
}
export interface ExportSnapshotEvidence { readonly count: number; readonly expiresAt: string; }
interface Capture {
  readonly id: string;
  readonly scope: string;
  readonly kind: 'credential' | 'issueorder' | 'action';
  readonly actor: string;
  readonly filter: Readonly<Record<string, unknown>>;
}

/** Voucher-owned snapshot persistence, called after Runtime locks the idempotent export record. */
export async function captureExportSnapshot(database: SqlExecutor, input: Capture): Promise<void> {
  const values = [input.id, input.scope, input.kind, JSON.stringify(input.filter), input.actor];
  const previous = await database.query<{ matches: boolean }>(`select kind=$3 and source_filter=$4::jsonb and created_by=$5 matches
    from voucher.exportsnapshot where id=$1 and scope_id=$2`, values);
  if (previous.rows[0]) {
    if (!previous.rows[0].matches) throw new DomainError('IDEMPOTENCY_CONFLICT');
    return;
  }
  const source = sourceOf(input);
  // Both metadata and all projected values use one PostgreSQL statement snapshot.
  // Only a bounded count returns to Node; plaintext is never copied to the snapshot.
  const captured = await database.query<{ count: number }>(`with source as materialized(${source.sql}),
    snapshot as(insert into voucher.exportsnapshot(id,scope_id,kind,source_filter,created_by,captured_at,expires_at,result_count)
      select $1,$2,$3,$4::jsonb,$5,statement_timestamp(),statement_timestamp()+$8::integer*interval '1 second',count(*) from source
      returning id,scope_id),
    items as(insert into voucher.exportsnapshotitem(snapshot_id,scope_id,ordinal,cells,credential_id,pool_id,number_ciphertext,secret_ciphertext)
      select snapshot.id,snapshot.scope_id,source.ordinal,source.cells,source.credential,source.pool,source.number,source.secret
      from source cross join snapshot returning ordinal)
    select count(*)::integer count from items`, [...values, source.reference, source.watermark, RUNTIME_LIMITS.voucherExport.snapshotTtlSeconds,
      CAPACITY_MODEL.voucherBatch + 1]);
  if (!captured.rows[0] || captured.rows[0].count > CAPACITY_MODEL.voucherBatch)
    throw new DomainError('VALIDATION_FAILED', { field: 'filter', reason: 'snapshotlimit' });
}

export async function readExportSnapshot(database: SqlExecutor, work: RuntimeExportWork): Promise<ExportSnapshotEvidence> {
  const row = (await database.query<{ count: number; expires: Date }>(`select result_count::integer count,expires_at expires
    from voucher.exportsnapshot where id=$1 and scope_id=$2 and kind=$3 and source_filter=$4::jsonb and created_by=$5
      and expires_at>clock_timestamp()`, [work.id, work.scope, work.kind, JSON.stringify(work.snapshot), work.authorization.actor])).rows[0];
  if (!row) throw new Error('VOUCHER_EXPORT_SNAPSHOT_INVALID');
  return Object.freeze({ count: Number(row.count), expiresAt: new Date(row.expires).toISOString() });
}

export async function readExportPage(database: SqlExecutor, work: RuntimeExportWork, cursor: string | null, limit: number): Promise<readonly ExportPage[]> {
  await readExportSnapshot(database, work);
  const rows = await database.query<{ ordinal: number; cells: readonly unknown[]; credential: string | null; pool: string | null; number: string | null; secret: string | null }>(
    `select ordinal::integer,cells,credential_id credential,pool_id pool,number_ciphertext number,secret_ciphertext secret
     from voucher.exportsnapshotitem where snapshot_id=$1 and scope_id=$2 and ($3::bigint is null or ordinal>$3)
     order by ordinal limit $4`, [work.id, work.scope, cursor === null ? null : Number(cursor), limit]);
  return Object.freeze(rows.rows.map(row => {
    const projection = { cursor: String(row.ordinal), cells: Object.freeze([...row.cells]) };
    if (work.kind !== 'credential') return Object.freeze(projection);
    if (!row.credential || !row.pool || !row.number || !row.secret) throw new Error('VOUCHER_EXPORT_SNAPSHOT_INVALID');
    return Object.freeze({ ...projection, credential: row.credential, pool: row.pool, numberCiphertext: row.number, secretCiphertext: row.secret });
  }));
}

export async function pruneExportSnapshots(database: SqlExecutor): Promise<number> {
  const items = await database.query(`with expired as(select item.snapshot_id,item.ordinal from voucher.exportsnapshotitem item
    join voucher.exportsnapshot snapshot on snapshot.id=item.snapshot_id and snapshot.scope_id=item.scope_id
    where snapshot.expires_at<=clock_timestamp() order by snapshot.expires_at,item.snapshot_id,item.ordinal
    limit $1)
    delete from voucher.exportsnapshotitem item using expired where item.snapshot_id=expired.snapshot_id and item.ordinal=expired.ordinal`,
  [RUNTIME_LIMITS.voucherExport.pageRows]);
  const snapshots = await database.query(`with expired as(select snapshot.id from voucher.exportsnapshot snapshot
    where snapshot.expires_at<=clock_timestamp() and not exists(select 1 from voucher.exportsnapshotitem item where item.snapshot_id=snapshot.id)
    order by snapshot.expires_at,snapshot.id limit $1)
    delete from voucher.exportsnapshot snapshot using expired where snapshot.id=expired.id`, [RUNTIME_LIMITS.voucherExport.pageRows]);
  return (items.rowCount ?? 0) + (snapshots.rowCount ?? 0);
}

function sourceOf(input: Capture) {
  if (input.kind === 'credential') return { reference: required(input.filter.pool), watermark: required(input.filter.watermark), sql: `
    select row_number() over(order by credential.id) ordinal,
      jsonb_build_array(credential.id,credential.pool_id,credential.product_id,credential.state,credential.key_version,credential.created_at) cells,
      credential.id credential,credential.pool_id pool,credential.number_ciphertext number,credential.secret_ciphertext secret
    from voucher.credential credential where credential.scope_id=$2 and credential.pool_id=$6 and credential.created_at<=$7::timestamptz
    order by credential.id limit $9` };
  if (input.kind === 'issueorder') return { reference: required(input.filter.order), watermark: null, sql: `
    select row_number() over(order by item.batch_id,item.ordinal) ordinal,
      jsonb_build_array(item.ordinal,item.batch_id,item.state,item.credential_id,voucher.id,voucher.number_masked,item.error_code,item.updated_at) cells,
      null::text credential,null::text pool,null::text number,null::text secret
    from voucher.issueitem item join voucher.issuebatch batch on batch.id=item.batch_id and batch.scope_id=item.scope_id
      left join voucher.voucher voucher on voucher.credential_id=item.credential_id and voucher.scope_id=item.scope_id
    where item.scope_id=$2 and batch.order_id=$6 and $7::timestamptz is null order by item.batch_id,item.ordinal limit $9` };
  return { reference: required(input.filter.batch), watermark: null, sql: `
    select row_number() over(order by voucher_id) ordinal,
      jsonb_build_array(voucher_id,state,previous_state,next_state,error_code,retryable,updated_at) cells,
      null::text credential,null::text pool,null::text number,null::text secret
    from voucher.actionitem where scope_id=$2 and batch_id=$6 and $7::timestamptz is null order by voucher_id limit $9` };
}
function required(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new DomainError('VALIDATION_FAILED');
  return value;
}
