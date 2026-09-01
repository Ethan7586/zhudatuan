import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { ProviderOperationRepository } from '../../application/port/ProviderOperationRepository';
export class PgProviderOperationRepository implements ProviderOperationRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async read(context: ReadTransactionContext, scope: string, page: Parameters<ProviderOperationRepository['read']>[2]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select id,provider,kind,internal_reference,external_reference,state,response,created_at,updated_at
      from channel.provideroperation where scope_id=$1 and ($2::timestamptz is null or (updated_at,id)<($2::timestamptz,$3))
      order by updated_at desc,id desc limit $4`,
      [scope, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async replay(context: ReadTransactionContext, operation: string, scope: string) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      kind: string;
      internal_reference: string;
    }>(
      `update channel.provideroperation set state='queued',updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and state in('failed','unknown') returning id,kind,internal_reference`,
      [operation, scope]
    );
    const found = result.rows[0];
    if (!found) throw new Error('PROVIDER_OPERATION_NOT_REPLAYABLE');
    const kind = found.kind === 'refund' ? 'paymentrefund' : 'fulfillment';
    await new PgRuntimeWriter(database).schedule({
      id: `job:${randomUUID()}`,
      kind,
      owner: 'channel',
      scope,
      payload: kind === 'paymentrefund' ? { refund: found.internal_reference } : { operation: found.id },
      priority: 20,
    });
    return Object.freeze({ operation: found.id, state: 'queued' });
  }
  async record(context: WriteTransactionContext, input: Parameters<ProviderOperationRepository['record']>[1]): Promise<void> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,response,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,clock_timestamp(),clock_timestamp()) on conflict(provider,kind,idempotency_key) do update
      set external_reference=excluded.external_reference,state=excluded.state,response=excluded.response,updated_at=clock_timestamp()
      where channel.provideroperation.request_hash=excluded.request_hash returning id`,
      [input.id, input.provider, input.scope, input.kind, input.idempotency, input.reference, input.external, input.state, input.requestHash, JSON.stringify(input.response)]
    );
    if (!result.rows[0]) throw new Error('PROVIDER_OPERATION_IDEMPOTENCY_CONFLICT');
  }
  async replayReference(context: ReadTransactionContext, operation: string, kind: 'order' | 'return' | 'refund'): Promise<string> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      internal_reference: string;
    }>(`select internal_reference from channel.provideroperation where id=$1 and kind=$2 and state='queued'`, [operation, kind]);
    if (!result.rows[0]) throw new Error('PROVIDER_OPERATION_NOT_REPLAYABLE');
    return result.rows[0].internal_reference;
  }
  async update(context: WriteTransactionContext, input: Parameters<ProviderOperationRepository['update']>[1]): Promise<void> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `update channel.provideroperation set external_reference=coalesce($4,external_reference),state=$5,
      response=$6::jsonb,updated_at=clock_timestamp() where provider=$1 and kind=$2 and idempotency_key=$3 returning id`,
      [input.provider, input.kind, input.idempotency, input.external ?? null, input.state, JSON.stringify(input.response)]
    );
    if (!result.rows[0]) throw new Error('PROVIDER_OPERATION_NOT_FOUND');
  }
}
