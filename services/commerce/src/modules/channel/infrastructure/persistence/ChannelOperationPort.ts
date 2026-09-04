import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ProviderOperationInput, ProviderOperationUpdate } from '../../public/ProviderOperation';
import { ProviderOperation, providerResponse, providerResult, requestSummary, type ProviderOperationKind, type ProviderOperationState } from '../../domain/model/ProviderOperation';
import { ChannelPolicy } from '../../domain/policy/ChannelPolicy';

export interface ProviderOperationRow {
  readonly id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly kind: ProviderOperationKind;
  readonly idempotency_key: string;
  readonly internal_reference: string;
  readonly external_reference: string | null;
  readonly state: ProviderOperationState;
  readonly request_hash: string;
  readonly response_summary: Readonly<Record<string, string | number | boolean>>;
  readonly response_hash: string;
  readonly version: number;
}

export class ChannelOperationPort {
  private readonly policy = new ChannelPolicy();
  constructor(protected readonly transactions = new PgTransactionAccess()) {}

  async record(context: WriteTransactionContext, input: ProviderOperationInput): Promise<void> {
    const database = this.transactions.database(context);
    if (input.scope !== context.scope) throw new Error('PROVIDER_OPERATION_SCOPE_INVALID');
    requestSummary(input.requestHash);
    const result = providerResult(input.result);
    const response = providerResponse(result);
    new ProviderOperation({ id: input.id, provider: input.provider, scope: input.scope, kind: input.kind, idempotency: input.idempotency,
      internalReference: input.reference, externalReference: result?.externalReference ?? null, state: input.state, requestHash: input.requestHash,
      responseSummary: response.summary, responseHash: response.hash, version: 0 });
    const changed = await database.query(
      `insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,
      request_hash,response_summary,response_hash,created_at,updated_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,clock_timestamp(),clock_timestamp(),0)
      on conflict(provider,scope_id,kind,idempotency_key) do update set external_reference=excluded.external_reference,
      state=excluded.state,response_summary=excluded.response_summary,response_hash=excluded.response_hash,
      updated_at=clock_timestamp(),version=channel.provideroperation.version+1
      where channel.provideroperation.request_hash=excluded.request_hash and channel.provideroperation.internal_reference=excluded.internal_reference returning id`,
      [input.id, input.provider, input.scope, input.kind, input.idempotency, input.reference, result?.externalReference ?? null, input.state,
        input.requestHash, JSON.stringify(response.summary), response.hash]
    );
    if (!changed.rows[0]) throw new Error('PROVIDER_OPERATION_IDEMPOTENCY_CONFLICT');
  }
  async replayReference(context: ReadTransactionContext, operation: string, kind: 'order' | 'return' | 'refund'): Promise<string> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      internal_reference: string;
    }>(
      `select internal_reference from channel.provideroperation
      where id=$1 and kind=$2 and state='queued' and (scope_id=$3 or $3='system')`,
      [operation, kind, context.scope]
    );
    const reference = result.rows[0]?.internal_reference;
    if (!reference) throw new Error('PROVIDER_OPERATION_NOT_REPLAYABLE');
    return reference;
  }
  async update(
    context: WriteTransactionContext,
    input: ProviderOperationUpdate
  ): Promise<void> {
    const database = this.transactions.database(context);
    const current = await this.load(database, input.provider, context.scope, input.kind, input.idempotency);
    this.policy.requireOperationTransition(current, input.state);
    const result = providerResult(input.result);
    const response = providerResponse(result);
    const changed = await database.query(
      `update channel.provideroperation set external_reference=coalesce($5,external_reference),state=$6,
      response_summary=$7::jsonb,response_hash=$8,updated_at=clock_timestamp(),version=version+1
      where provider=$1 and scope_id=$2 and kind=$3 and idempotency_key=$4 and version=$9 returning id`,
      [input.provider, context.scope, input.kind, input.idempotency, result?.externalReference ?? null, input.state,
        JSON.stringify(response.summary), response.hash, current.value.version]
    );
    if (!changed.rows[0]) throw new Error('PROVIDER_OPERATION_NOT_FOUND');
  }

  protected async load(database: ReturnType<PgTransactionAccess['database']>, provider: string, scope: string, kind: ProviderOperationKind, idempotency: string): Promise<ProviderOperation> {
    const result = await database.query<ProviderOperationRow>(
      `select id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,
      response_summary,response_hash,version from channel.provideroperation
      where provider=$1 and scope_id=$2 and kind=$3 and idempotency_key=$4 for update`,
      [provider, scope, kind, idempotency]
    );
    const row = result.rows[0];
    if (!row) throw new Error('PROVIDER_OPERATION_NOT_FOUND');
    return operation(row);
  }
}

export function operation(row: ProviderOperationRow): ProviderOperation {
  return new ProviderOperation({ id: row.id, provider: row.provider, scope: row.scope_id, kind: row.kind,
    idempotency: row.idempotency_key, internalReference: row.internal_reference, externalReference: row.external_reference,
    state: row.state, requestHash: row.request_hash, responseSummary: row.response_summary, responseHash: row.response_hash,
    version: Number(row.version) });
}
