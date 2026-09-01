import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ProviderManifest } from '@shop/contract';
import type { InstallationListItem, InstallationRepository } from '../../application/port/InstallationRepository';
type DatabaseTime = string | Date;
interface InstallationRecord {
  readonly id: string;
  readonly extension_id: string;
  readonly extension_version: string;
  readonly scope_id: string;
  readonly status: InstallationListItem['status'];
  readonly installed_at: DatabaseTime;
  readonly checked_at: DatabaseTime | null;
  readonly manifest: ProviderManifest;
  readonly version: number;
  readonly health_state: InstallationListItem['health_state'];
  readonly health_latency_ms: number | null;
  readonly health_reason: string | null;
}
export class PgInstallationRepository implements InstallationRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async list(
    context: ReadTransactionContext,
    cursor: Readonly<{
      sort: string | null;
      id: string | null;
    }>,
    fetch: number
  ): Promise<readonly InstallationListItem[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<InstallationRecord>(
      `select installation.id,installation.extension_id,installation.extension_version,
       installation.scope_id,installation.status,installation.manifest,installation.version,installation.installed_at,
       health.state health_state,health.latency_ms health_latency_ms,health.reason health_reason,health.checked_at
       from extension.installation installation left join lateral(
         select state,latency_ms,reason,checked_at from extension.health where installation_id=installation.id
         order by checked_at desc limit 1
       ) health on true
       where ($1::timestamptz is null or (installation.installed_at,installation.id)<($1::timestamptz,$2))
       order by installation.installed_at desc,installation.id desc limit $3`,
      [cursor.sort, cursor.id, fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, installed_at: utc(row.installed_at), checked_at: row.checked_at === null ? null : utc(row.checked_at) })));
  }
}
function utc(value: DatabaseTime): string {
  const time = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(time.getTime())) throw new Error('EXTENSION_TIME_INVALID');
  return time.toISOString();
}
