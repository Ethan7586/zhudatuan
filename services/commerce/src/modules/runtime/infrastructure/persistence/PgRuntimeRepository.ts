import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { RuntimeQueueState, RuntimeRepository } from '../../application/port/RuntimeRepository';
export class PgRuntimeRepository implements RuntimeRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async queueState(context: ReadTransactionContext): Promise<RuntimeQueueState> {
    const result = await this.transactions.database(context).query<RuntimeQueueState>(`select count(*) filter(where state='queued')::integer queued,
       count(*) filter(where state='running')::integer running,
       (select count(*)::integer from runtime.deadletters where state='open') deadletters,
       coalesce(extract(epoch from (clock_timestamp()-(min(created_at) filter(where state='queued')))),0)::integer oldest_seconds
       from runtime.jobs`);
    const state = result.rows[0];
    if (!state) throw new Error('RUNTIME_QUEUE_STATE_MISSING');
    return Object.freeze(state);
  }
}
