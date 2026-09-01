import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { StorefrontBinding, PublishedStorefront, ExperienceReadPort } from '../../public/ExperienceReadPort';
interface BindingRow extends QueryResultRow {
  readonly application: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly version: string;
  readonly tenant: string;
}
export class PgExperienceReadPort implements ExperienceReadPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async resolveHost(context: ReadTransactionContext, host: string): Promise<StorefrontBinding> {
    const result = await this.transactions.database(context).query<BindingRow>(
      `select application,mall,pool,release,version,tenant
      from experience.resolve_storefront_host($1)`,
      [host]
    );
    const row = result.rows[0];
    if (!row) throw new Error('STOREFRONT_HOST_NOT_PUBLISHED');
    return Object.freeze(row);
  }
  async published(context: ReadTransactionContext, binding: StorefrontBinding): Promise<PublishedStorefront> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      document: Readonly<Record<string, unknown>>;
      version: string;
      as_of: string;
    }>(
      `select version.configuration document,version.id version,
        to_char(release.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as_of
        from experience.release release join experience.version version on version.id=release.version_id
        where release.id=$1 and release.application_id=$2 and release.state='active'`,
      [binding.release, binding.application]
    );
    const row = result.rows[0];
    if (!row) throw new Error('STOREFRONT_RELEASE_NOT_PUBLISHED');
    return Object.freeze({ document: Object.freeze(row.document), version: row.version, asOf: row.as_of });
  }
}
