import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { CONTRACT_CHECKSUM, OperationCatalog, COMMERCE_EVENTS } from '@shop/contract';
import { CONTRACT_SCHEMA_HEAD, TARGET_SCHEMA_HEAD } from '@shop/config/server';
import type { RuntimeDatabaseState, RuntimeQueueState, RuntimeRepository } from '../../application/port/RuntimeRepository';
export class PgRuntimeRepository implements RuntimeRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async databaseState(context: ReadTransactionContext): Promise<RuntimeDatabaseState> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<RuntimeDatabaseState>(
      `select not pg_is_in_recovery() writable,
       exists(select 1 from runtime.schemaversion where version=$1) migration,
       exists(select 1 from runtime.schemaversion where version=$2 and checksum=$3) contract,
       current_user='shopapp' role,
       (select count(*)::integer from runtime.operation) operations,
       (select count(*)::integer from runtime.event) events`,
      [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD, CONTRACT_CHECKSUM]
    );
    const state = result.rows[0];
    if (!state) throw new Error('RUNTIME_DATABASE_STATE_MISSING');
    if (state.operations > OperationCatalog.all().length || state.events > COMMERCE_EVENTS.length) throw new Error('RUNTIME_REGISTRY_COUNT_INVALID');
    return Object.freeze(state);
  }
  async queueState(context: ReadTransactionContext): Promise<RuntimeQueueState> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<RuntimeQueueState>(`select count(*) filter(where state='queued')::integer queued,
       count(*) filter(where state='running')::integer running,
       (select count(*)::integer from runtime.deadletter where reviewed_at is null) deadletters,
       coalesce(extract(epoch from (clock_timestamp()-(min(created_at) filter(where state='queued')))),0)::integer oldest_seconds
       from runtime.job`);
    const state = result.rows[0];
    if (!state) throw new Error('RUNTIME_QUEUE_STATE_MISSING');
    return Object.freeze(state);
  }
}
