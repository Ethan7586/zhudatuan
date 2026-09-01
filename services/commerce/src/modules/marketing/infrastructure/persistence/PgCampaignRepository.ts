import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CampaignRecord, CampaignRepository } from '../../application/port/CampaignRepository';
interface CampaignRow extends Record<string, unknown> {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly state: string;
  readonly budget_minor: number;
  readonly spent_minor: number;
  readonly currency: string;
  readonly effective_at: Date;
  readonly expires_at: Date | null;
  readonly version: number;
  readonly updated_at: Date;
}
export class PgCampaignRepository implements CampaignRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async read(
    context: ReadTransactionContext,
    scope: string,
    cursor: Readonly<{
      sort: string | null;
      id: string | null;
      fetch: number;
    }>
  ): Promise<readonly CampaignRecord[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<CampaignRow>(
      `select id,kind,name,state,budget_minor,spent_minor,currency,effective_at,expires_at,version,updated_at
      from marketing.campaign where scope_id=$1 and ($2::timestamptz is null or (updated_at,id)<($2::timestamptz,$3))
      order by updated_at desc,id desc limit $4`,
      [scope, cursor.sort, cursor.id, cursor.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, effective_at: row.effective_at.toISOString(), expires_at: row.expires_at?.toISOString() ?? null, updated_at: row.updated_at.toISOString() })));
  }
}
