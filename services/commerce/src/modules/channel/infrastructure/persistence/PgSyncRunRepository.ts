import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { createHash, randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { SyncRunRepository } from '../../application/port/SyncRunRepository';
const jobs = Object.freeze({ catalog: 'catalogsync', price: 'pricesync', stock: 'inventorysync', statement: 'statementsync' } as const);
export class PgSyncRunRepository implements SyncRunRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async start(context: WriteTransactionContext, input: Parameters<SyncRunRepository['start']>[1]) {
    const database = this.transactions.database(context);
    const document = Object.freeze({ connection: input.connection, kind: input.kind, cursor: input.cursor ?? null, ...input.parameters });
    const serialized = JSON.stringify(document);
    const run = `sync:${randomUUID()}`;
    const result = await database.query(
      `insert into channel.syncrun(id,connection_id,kind,state,cursor_value,input_hash,input,error_summary)
      select $1,id,$3,'queued',$4,$5,$6::jsonb,'[]'::jsonb from channel.connection where id=$2 and scope_id=$7
      and status='enabled' returning *,xmin::text::bigint version`,
      [run, input.connection, input.kind, input.cursor ?? null, createHash('sha256').update(serialized).digest('hex'), serialized, input.scope]
    );
    if (!result.rows[0]) throw new Error('ENABLED_CONNECTION_REQUIRED');
    await new PgRuntimeWriter(database).schedule({ id: `job:${randomUUID()}`, kind: jobs[input.kind], owner: 'channel', scope: input.scope, payload: { subtype: 'channelsync', run }, priority: 30 });
    return Object.freeze({ ...result.rows[0] });
  }
  async read(context: ReadTransactionContext, scope: string, page: Parameters<SyncRunRepository['read']>[2]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select run.id,run.connection_id,run.kind,run.state,run.cursor_value,run.input_hash,run.input,run.error_summary,
      run.watermark,run.pulled_count,run.accepted_count,run.rejected_count,run.started_at,run.completed_at,
      run.xmin::text::bigint version,coalesce(run.started_at,'infinity')::text cursor_sort
      from channel.syncrun run join channel.connection connection on connection.id=run.connection_id where connection.scope_id=$1
      and ($2::timestamptz is null or (coalesce(run.started_at,'infinity'),run.id)<($2::timestamptz,$3))
      order by coalesce(run.started_at,'infinity') desc,run.id desc limit $4`,
      [scope, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async cancel(context: ReadTransactionContext, id: string, scope: string, expectedVersion: number | null) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `update channel.syncrun run set state='cancelled',completed_at=clock_timestamp()
      from channel.connection connection where run.id=$1 and connection.id=run.connection_id and connection.scope_id=$2
      and run.state in('queued','running') and ($3::bigint is null or run.xmin::text::bigint=$3)
      returning run.*,run.xmin::text::bigint version`,
      [id, scope, expectedVersion]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...result.rows[0] });
  }
}
