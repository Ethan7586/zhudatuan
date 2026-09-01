import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { StorefrontEntry, PublishedStorefront, ExperienceReadPort } from '../../public/ExperienceReadPort';
import type { EntryResolver } from '../../application/service/EntryResolver';
export class PgExperienceReadPort implements ExperienceReadPort {
  constructor(
    private readonly resolver: EntryResolver,
    private readonly transactions = new PgTransactionAccess()
  ) {}
  async resolveEntry(context: ReadTransactionContext, handle: string): Promise<StorefrontEntry> {
    return this.resolver.resolve(context, handle);
  }
  async published(context: ReadTransactionContext, entry: StorefrontEntry): Promise<PublishedStorefront> {
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
      [entry.release, entry.application]
    );
    const row = result.rows[0];
    if (!row) throw new Error('STOREFRONT_RELEASE_NOT_PUBLISHED');
    return Object.freeze({ document: Object.freeze(row.document), version: row.version, asOf: row.as_of });
  }
}
