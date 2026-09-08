import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { IdempotencyCleanupKey, RuntimeControlCleanup } from '../../application/port/CleanupPort';
import { cleanupIds, cleanupLimit } from './PgCleanupValue';

export class PgControlCleanup implements RuntimeControlCleanup {
  constructor(private readonly transactions = new PgTransactionAccess()) {}
  async planIdempotency(context: ReadTransactionContext, limit: number): Promise<readonly IdempotencyCleanupKey[]> {
    cleanupLimit(limit);
    const result = await this.transactions.database(context).query<{ scope: string; actor: string; key: string }>(
      `select scope,actor_id actor,key from runtime.idempotency where expires_at<clock_timestamp() and state in('completed','failed')
       order by expires_at,scope,actor_id,key limit $1`,
      [limit]
    );
    return idempotencyKeys(result.rows);
  }

  async purgeIdempotency(context: WriteTransactionContext, keys: readonly IdempotencyCleanupKey[]): Promise<number> {
    const planned = idempotencyKeys(keys);
    if (planned.length === 0) return 0;
    const result = await this.transactions.database(context).query(
      `delete from runtime.idempotency where state in('completed','failed') and expires_at<clock_timestamp()
       and (scope,actor_id,key) in(select value->>'scope',value->>'actor',value->>'key' from jsonb_array_elements($1::jsonb) value)
       returning key`,
      [JSON.stringify(planned)]
    );
    return result.rows.length;
  }

  async planDeadletters(context: ReadTransactionContext, limit: number): Promise<readonly string[]> {
    cleanupLimit(limit);
    const result = await this.transactions.database(context).query<{ id: string }>(
      `select id from runtime.deadletters where state in('resolved','discarded') and retention_until<clock_timestamp()
       order by retention_until,id limit $1`,
      [limit]
    );
    return cleanupIds(
      result.rows.map(({ id }) => id),
      'deadletter:'
    );
  }

  async purgeDeadletters(context: WriteTransactionContext, ids: readonly string[]): Promise<number> {
    const planned = cleanupIds(ids, 'deadletter:');
    if (planned.length === 0) return 0;
    const result = await this.transactions.database(context).query(
      `delete from runtime.deadletters where id=any($1::text[]) and state in('resolved','discarded')
       and retention_until<clock_timestamp() returning id`,
      [planned]
    );
    return result.rows.length;
  }
}

function idempotencyKeys(rows: readonly IdempotencyCleanupKey[]): readonly IdempotencyCleanupKey[] {
  const values = rows.map(({ scope, actor, key }) => Object.freeze({ scope, actor, key }));
  const identities = values.map(({ scope, actor, key }) => JSON.stringify([scope, actor, key]));
  if (values.length > 5000 || new Set(identities).size !== values.length || values.some(({ scope, actor, key }) => [scope, actor, key].some((value) => typeof value !== 'string' || value.length < 1)))
    throw new Error('CLEANUP_IDEMPOTENCY_SET_INVALID');
  return Object.freeze(values);
}
