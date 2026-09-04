import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { DeviceRepository } from '../../application/port/DeviceRepository';
import { TrustedDevice } from '../../domain/model/TrustedDevice';

export class PgDeviceRepository implements DeviceRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async manage(context: WriteTransactionContext, input: Parameters<DeviceRepository['manage']>[1]) {
    const database = this.transactions.database(context);
    const existing = await database.query<{ id: string; scope_id: string; label: string; fingerprint_hash: string; public_key: string | null; status: 'trusted' | 'blocked' | 'retired'; version: number }>(
      `select id,scope_id,label,fingerprint_hash,public_key,status,version::integer from verification.device where id=$1 and scope_id=$2 for update`,
      [input.id, input.scope]
    );
    const current = existing.rows[0];
    const device = current
      ? new TrustedDevice({ id: current.id, scope: current.scope_id, label: current.label, fingerprintHash: current.fingerprint_hash, publicKey: current.public_key, state: current.status, version: current.version })
          .revise({ label: input.label, fingerprintHash: input.fingerprintHash, publicKey: input.publicKey, state: input.status }, requiredVersion(input.expectedVersion)).value
      : new TrustedDevice({ id: input.id, scope: input.scope, label: input.label, fingerprintHash: input.fingerprintHash, publicKey: input.publicKey, state: input.status, version: 0 }).value;
    if (!current && input.expectedVersion !== null) throw new DomainError('VERSION_CONFLICT');
    const result = await database.query(
      `insert into verification.device(id,scope_id,label,fingerprint_hash,public_key,status,trusted_at,retired_at,last_used_at,created_at,version)
      values($1,$2,$3,$4,$5,$6,case when $6='trusted' then $7 else null end,case when $6='retired' then $7 else null end,null,$7,$8)
      on conflict(id) do update set label=excluded.label,fingerprint_hash=excluded.fingerprint_hash,public_key=excluded.public_key,
      status=excluded.status,trusted_at=case when excluded.status='trusted' then coalesce(verification.device.trusted_at,$7) else verification.device.trusted_at end,
      retired_at=case when excluded.status='retired' then $7 else null end,version=excluded.version
      where verification.device.scope_id=$2 and verification.device.version=$9 returning id,label,status,last_used_at,version`,
      [device.id, device.scope, device.label, device.fingerprintHash, device.publicKey, device.state, input.now, device.version, current?.version ?? -1]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...result.rows[0] });
  }

  async devices(context: ReadTransactionContext, scope: string, page: Parameters<DeviceRepository['devices']>[2]) {
    const result = await this.transactions.database(context).query(
      `select id,label,status,last_used_at,version from verification.device where scope_id=$1
      and ($2::text is null or (label,id)>($2,$3)) order by label,id limit $4`,
      [scope, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
}

function requiredVersion(value: number | null): number {
  if (value === null) throw new DomainError('VERSION_CONFLICT');
  return value;
}
