import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ProviderOperationInput } from '../../public/ProviderOperation';
export class ChannelOperationPort {
  private readonly transactions = new PgTransactionAccess();
  async record(context: WriteTransactionContext, input: ProviderOperationInput): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,response,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,clock_timestamp(),clock_timestamp()) on conflict(provider,kind,idempotency_key) do update
      set external_reference=excluded.external_reference,state=excluded.state,response=excluded.response,updated_at=clock_timestamp()
      where channel.provideroperation.request_hash=excluded.request_hash returning id`,
      [input.id, input.provider, input.scope, input.kind, input.idempotency, input.reference, input.external, input.state, input.requestHash, JSON.stringify(input.response)]
    );
    if (!changed.rows[0]) throw new Error('PROVIDER_OPERATION_IDEMPOTENCY_CONFLICT');
  }
  async replayReference(context: ReadTransactionContext, operation: string, kind: 'order' | 'return' | 'refund'): Promise<string> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      internal_reference: string;
    }>(
      `select internal_reference from channel.provideroperation
      where id=$1 and kind=$2 and state='queued'`,
      [operation, kind]
    );
    const reference = result.rows[0]?.internal_reference;
    if (!reference) throw new Error('PROVIDER_OPERATION_NOT_REPLAYABLE');
    return reference;
  }
  async update(
    context: WriteTransactionContext,
    input: Readonly<{
      provider: string;
      kind: 'order' | 'return' | 'refund';
      idempotency: string;
      external?: string;
      state: 'queued' | 'processing' | 'succeeded' | 'failed' | 'unknown';
      response: unknown;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update channel.provideroperation set external_reference=coalesce($4,external_reference),state=$5,
      response=$6::jsonb,updated_at=clock_timestamp() where provider=$1 and kind=$2 and idempotency_key=$3 returning id`,
      [input.provider, input.kind, input.idempotency, input.external ?? null, input.state, JSON.stringify(input.response)]
    );
    if (!changed.rows[0]) throw new Error('PROVIDER_OPERATION_NOT_FOUND');
  }
}
