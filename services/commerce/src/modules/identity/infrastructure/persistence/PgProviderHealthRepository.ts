import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ProviderHealthRepository } from '../../application/port/ProviderHealthRepository';

export class PgProviderHealthRepository implements ProviderHealthRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async enabled(context: ReadTransactionContext, provider: string | null): Promise<readonly string[]> {
    const result = await this.transactions.database(context).query<{ id: string }>(`select id from identity.provider where status='enabled' and ($1::uuid is null or id=$1) order by id limit 64`, [provider]);
    return Object.freeze(result.rows.map(({ id }) => id));
  }

  async record(context: WriteTransactionContext, provider: string, status: 'healthy' | 'degraded' | 'unavailable', latency: number, error: string | null): Promise<void> {
    await this.transactions.database(context).query(
      `insert into identity.providerhealth(provider_id,status,latency_ms,error_code,checked_at,version) values($1,$2,$3,$4,clock_timestamp(),1)
      on conflict(provider_id) do update set status=excluded.status,latency_ms=excluded.latency_ms,error_code=excluded.error_code,
      checked_at=excluded.checked_at,version=identity.providerhealth.version+1`,
      [provider, status, latency, error]
    );
  }
}
