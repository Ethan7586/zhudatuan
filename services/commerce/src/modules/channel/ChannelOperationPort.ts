import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface ProviderOperationInput {
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly kind: 'order' | 'refund';
  readonly idempotency: string;
  readonly reference: string;
  readonly external: string | null;
  readonly state: 'queued' | 'processing' | 'succeeded' | 'failed' | 'unknown';
  readonly requestHash: string;
  readonly response: unknown;
}

export class ChannelOperationPort {
  async record(database: OperationDatabase, input: ProviderOperationInput): Promise<void> {
    await database.query(`insert into channel.provideroperation(id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,response,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,clock_timestamp(),clock_timestamp()) on conflict(provider,kind,idempotency_key) do update
      set external_reference=excluded.external_reference,state=excluded.state,response=excluded.response,updated_at=clock_timestamp()
      where channel.provideroperation.request_hash=excluded.request_hash`, [input.id, input.provider, input.scope, input.kind, input.idempotency,
      input.reference, input.external, input.state, input.requestHash, JSON.stringify(input.response)]);
  }

  async replayReference(database: OperationDatabase, operation: string, kind: 'order' | 'refund'): Promise<string> {
    const result = await database.query<{ internal_reference: string }>(`select internal_reference from channel.provideroperation
      where id=$1 and kind=$2 and state='queued'`, [operation, kind]);
    const reference = result.rows[0]?.internal_reference;
    if (!reference) throw new Error('PROVIDER_OPERATION_NOT_REPLAYABLE');
    return reference;
  }

  async update(database: OperationDatabase, input: Readonly<{ provider: string; kind: 'order' | 'refund'; idempotency: string;
    external?: string; state: 'queued' | 'processing' | 'succeeded' | 'failed' | 'unknown'; response: unknown }>): Promise<void> {
    const changed = await database.query(`update channel.provideroperation set external_reference=coalesce($4,external_reference),state=$5,
      response=$6::jsonb,updated_at=clock_timestamp() where provider=$1 and kind=$2 and idempotency_key=$3 returning id`,
    [input.provider, input.kind, input.idempotency, input.external ?? null, input.state, JSON.stringify(input.response)]);
    if (!changed.rows[0]) throw new Error('PROVIDER_OPERATION_NOT_FOUND');
  }
}

export const channelOperationPort = new ChannelOperationPort();
