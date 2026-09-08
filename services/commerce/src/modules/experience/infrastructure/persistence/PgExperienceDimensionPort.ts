import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OrganizationReadPort } from '../../../organization/public';
import type { ExperienceApplicationLabel, ExperienceDimensionPort } from '../../public/ExperienceDimensionPort';

interface ApplicationRow {
  readonly id: string;
  readonly name: string;
  readonly mall: string;
}

export class PgExperienceDimensionPort implements ExperienceDimensionPort {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly organizations: OrganizationReadPort
  ) {}

  async applications(context: ReadTransactionContext, scope: string, ids?: readonly string[]): Promise<readonly ExperienceApplicationLabel[]> {
    if (ids?.length === 0) return Object.freeze([]);
    const scopes = await this.organizations.descendants(context, scope);
    const result = await this.transactions.database(context).query<ApplicationRow>(
      `select application.id,application.name,application.mall_id mall
       from experience.application application
       where application.mall_id=any($1::text[]) and application.status<>'disabled'
         and ($2::text[] is null or application.id=any($2::text[]))
       order by application.name,application.id`,
      [scopes, ids === undefined ? null : [...new Set(ids)]]
    );
    const malls = await this.organizations.summaries(
      context,
      result.rows.map(({ mall }) => mall)
    );
    const mallNames = new Map(malls.map(({ id, name }) => [id, name]));
    return Object.freeze(result.rows.map((row) => Object.freeze({ id: row.id, name: row.name, mall: row.mall, mallName: mallNames.get(row.mall) ?? '当前商城' })));
  }
}
