import { randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ExportPort, ImportObjectPort, ImportPort, JobPort, RuntimeExportRecord, RuntimeJobRecord } from '../../../runtime/public';
import type { CredentialRepository } from '../../application/port/CredentialRepository';
import { createVoucherExport } from './PgVoucherExport';
import { body, CREDENTIAL, cursor, expected, limit, one, optionalText, page, path, query, requiredIdempotency, text, write } from './VoucherSupport';

export class PgCredentialRepository implements CredentialRepository {
  constructor(
    private readonly jobs: JobPort,
    private readonly imports: ImportPort,
    private readonly exports: ExportPort,
    private readonly objects?: ImportObjectPort,
    private readonly transactions = new PgTransactionAccess()
  ) {}
  async generate(call: Parameters<CredentialRepository['generate']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const pool = path(call, 'poolid');
    const count = Number(body(call).count);
    const idempotency = requiredIdempotency(call);
    const existing = await this.jobs.find(call.context.transaction, call.scope, 'voucher', 'credentialgenerate', idempotency);
    if (existing) return reply<'voucher.credentials.generate'>(202, existing);
    const selected = await database.query<{ mode: string; state: string; generated: number; capacity: number }>(`select mode,state,generated::integer,capacity::integer from voucher.credentialpool where id=$1 and scope_id=$2 for update`, [
      pool,
      call.scope,
    ]);
    const row = selected.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    if (row.mode !== 'generated' || row.state !== 'open') throw new DomainError('VOUCHER_POOL_CLOSED');
    if (!Number.isSafeInteger(count) || count <= 0 || row.generated + count > row.capacity) throw new DomainError('VOUCHER_STOCK_INSUFFICIENT');
    const start = row.generated + 1;
    await database.query(`update voucher.credentialpool set generated=generated+$3,version=version+1 where id=$1 and scope_id=$2`, [pool, call.scope, count]);
    const job = await this.jobs.create(write(call), { scope: call.scope, owner: 'voucher', kind: 'credentialgenerate', queue: 'batch', payload: { pool, count, start }, idempotency, actor: call.actor });
    return reply<'voucher.credentials.generate'>(202, job);
  }
  async import(call: Parameters<CredentialRepository['import']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const pool = path(call, 'poolid');
    const value = body(call);
    if (!this.objects) throw new Error('VOUCHER_IMPORT_OBJECT_SERVICE_REQUIRED');
    const object = await this.objects.prepare({ body: { objectRef: value.upload, sha256: value.fileHash, fileName: value.fileName } }, call.tenant);
    const selected = await database.query<{ mode: string; state: string }>(`select mode,state from voucher.credentialpool where id=$1 and scope_id=$2`, [pool, call.scope]);
    if (!selected.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    if (selected.rows[0].mode !== 'imported' || selected.rows[0].state !== 'open') throw new DomainError('VOUCHER_POOL_CLOSED');
    const imported = await this.imports.create(write(call), {
      id: `import:${randomUUID()}`,
      scope: call.scope,
      owner: 'voucher',
      kind: 'credential',
      reference: object.reference,
      sha256: object.sha256,
      name: object.name,
      mediaType: object.mediaType,
      size: object.size,
      actor: call.actor,
      authorization: call.authorization,
      metadata: { pool },
    });
    await this.jobs.create(write(call), { scope: call.scope, owner: 'voucher', kind: 'credentialimport', queue: 'import', payload: { pool, import: imported.id }, idempotency: requiredIdempotency(call), actor: call.actor });
    return { status: 202, body: imported } as Awaited<ReturnType<CredentialRepository['import']>>;
  }
  async list(call: Parameters<CredentialRepository['list']>[0]) {
    const database = this.transactions.database(call.context.transaction);
    const filter = query(call);
    const fetch = limit(filter.limit);
    const rows = await database.query(
      `${CREDENTIAL} where credential.scope_id=$1 and ($2::text is null or credential.pool_id=$2)
      and ($3::text is null or credential.state=$3) and ($4::text is null or credential.id>$4) order by credential.id limit $5`,
      [call.scope, optionalText(filter.pool), optionalText(filter.state), cursor(filter.cursor), fetch + 1]
    );
    return page<'voucher.credentials.list'>(rows.rows, fetch);
  }
  async get(call: Parameters<CredentialRepository['get']>[0]) {
    const row = await this.transactions.database(call.context.transaction).query(`${CREDENTIAL} where credential.id=$1 and credential.scope_id=$2`, [path(call, 'credentialid'), call.scope]);
    return one<'voucher.credentials.get'>(200, row.rows[0]);
  }
  async export(call: Parameters<CredentialRepository['export']>[0]) {
    const value = body(call);
    const pool = text(value.pool, 'pool');
    const source = await this.transactions.database(call.context.transaction).query<{ version: number; state: string }>(`select version::integer,state from voucher.credentialpool where id=$1 and scope_id=$2 for update`, [pool, call.scope]);
    if (!source.rows[0]) throw new DomainError('RESOURCE_NOT_FOUND');
    if (source.rows[0].version !== expected(call)) throw new DomainError('VERSION_CONFLICT');
    const watermark = text(value.watermark, 'watermark');
    if (!Number.isFinite(Date.parse(watermark)) || Date.parse(watermark) > call.now.getTime()) throw new DomainError('VALIDATION_FAILED', { field: 'watermark' });
    const result = await createVoucherExport(
      call,
      { kind: 'credential', snapshot: { pool, watermark }, poolVersion: source.rows[0].version },
      {
        database: this.transactions.database(call.context.transaction),
        exports: this.exports,
        jobs: this.jobs,
      }
    );
    return reply<'voucher.credentialexports.create'>(202, result);
  }
  async job(call: Parameters<CredentialRepository['job']>[0]) {
    const result = await this.jobs.read(call.context.transaction, path(call, 'jobid'), call.scope, 'voucher');
    if (!result) throw new DomainError('RESOURCE_NOT_FOUND');
    return reply<'voucher.jobs.get'>(200, result);
  }
}
function reply<TKey extends 'voucher.credentials.generate' | 'voucher.credentialexports.create' | 'voucher.jobs.get'>(status: number, value: RuntimeJobRecord | RuntimeExportRecord) {
  return { status, body: value } as Awaited<ReturnType<CredentialRepository[KeyFor<TKey>]>>;
}
type KeyFor<TKey> = TKey extends 'voucher.credentials.generate' ? 'generate' : TKey extends 'voucher.credentialexports.create' ? 'export' : 'job';
