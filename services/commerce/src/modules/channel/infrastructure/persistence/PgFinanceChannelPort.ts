import { PROVIDER_REQUIREMENTS } from '@shop/contract';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ChannelProviderAvailability, ChannelStatement, FinanceChannelPort } from '../../public/FinanceChannelPort';

const labels = Object.freeze(Object.fromEntries(PROVIDER_REQUIREMENTS.map(({ id, label }) => [id, label])) as Readonly<Record<string, string>>);

export class PgFinanceChannelPort implements FinanceChannelPort {
  private readonly transactions = new PgTransactionAccess();

  async importProviders(context: ReadTransactionContext, scopes: readonly string[]): Promise<readonly ChannelProviderAvailability[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{ provider: string; count: string }>(
      `select provider,count(*)::text count from channel.connection
      where scope_id=any($1::text[]) and status in('enabled','degraded')
      group by provider order by provider`,
      [scopes]
    );
    return Object.freeze(
      result.rows.map(({ provider, count }) =>
        Object.freeze({
          id: provider,
          label: labels[provider] ?? '自定义服务商',
          count: Number(count),
        } satisfies ChannelProviderAvailability)
      )
    );
  }

  async statement(context: ReadTransactionContext, id: string, scope: string): Promise<ChannelStatement | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      scope: string;
      object_ref: string;
      sha256: string;
      period_start: string;
      period_end: string;
      timezone: string;
    }>(
      `select id,scope_id scope,object_ref,sha256,period_start::text,period_end::text,timezone
      from channel.statement where id=$1 and scope_id=$2`,
      [id, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, scope: row.scope, objectRef: row.object_ref, sha256: row.sha256, period: Object.freeze({ start: row.period_start, end: row.period_end, timezone: row.timezone }) }) : null;
  }
}
