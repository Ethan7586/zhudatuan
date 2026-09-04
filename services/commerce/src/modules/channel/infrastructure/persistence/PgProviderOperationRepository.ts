import { randomUUID } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ProviderOperationRepository } from '../../application/port/ProviderOperationRepository';
import { ChannelOperationPort, operation, type ProviderOperationRow } from './ChannelOperationPort';
import { ChannelPolicy } from '../../domain/policy/ChannelPolicy';

export class PgProviderOperationRepository extends ChannelOperationPort implements ProviderOperationRepository {
  private readonly replayPolicy = new ChannelPolicy();
  constructor(transactions: PgTransactionAccess) {
    super(transactions);
  }

  async read(context: ReadTransactionContext, scope: string, page: Parameters<ProviderOperationRepository['read']>[2]) {
    const database = this.transactions.database(context);
    const result = await database.query(
      `select id,provider,kind,internal_reference,external_reference,state,response_summary response,created_at,updated_at
      from channel.provideroperation where scope_id=$1 and ($2::timestamptz is null or (updated_at,id)<($2::timestamptz,$3))
      order by updated_at desc,id desc limit $4`,
      [scope, page.sort, page.id, page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async replay(context: WriteTransactionContext, operationId: string, scope: string) {
    const database = this.transactions.database(context);
    const selected = await database.query<ProviderOperationRow>(
      `select id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,
      response_summary,response_hash,version from channel.provideroperation where id=$1 and scope_id=$2 for update`,
      [operationId, scope]
    );
    const current = selected.rows[0];
    if (!current) throw new Error('PROVIDER_OPERATION_NOT_REPLAYABLE');
    this.replayPolicy.requireReplay(operation(current));
    const result = await database.query<{ id: string; kind: string; internal_reference: string }>(
      `update channel.provideroperation set state='queued',updated_at=clock_timestamp(),version=version+1
      where id=$1 and scope_id=$2 and version=$3 returning id,kind,internal_reference`,
      [operationId, scope, current.version]
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
}
