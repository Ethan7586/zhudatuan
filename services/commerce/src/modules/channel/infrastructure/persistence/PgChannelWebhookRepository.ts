import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ChannelWebhookOutcome, ChannelWebhookReceipt, ChannelWebhookRepository, StandardChannelWebhook } from '../../application/port/ChannelWebhookRepository';
import type { ChannelFailure } from '../../domain/model/Failure';
import { ProviderOperation, providerResponse, type ProviderOperationSnapshot } from '../../domain/model/ProviderOperation';
import { WebhookInbox } from '../../domain/model/WebhookInbox';
import { WebhookReceipt } from '../../domain/model/WebhookReceipt';
import { ChannelPolicy } from '../../domain/policy/ChannelPolicy';

interface ReceiptRow {
  readonly id: string;
  readonly connection_id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly external_id: string;
  readonly attempts: number;
  readonly raw_ciphertext: string;
  readonly raw_key_version: string;
  readonly raw_hash: string;
  readonly signature_hash: string;
  readonly trace_id: string;
  readonly received_at: string;
  readonly version: number;
}

interface OperationRow {
  readonly id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly kind: ProviderOperationSnapshot['kind'];
  readonly idempotency_key: string;
  readonly internal_reference: string;
  readonly external_reference: string | null;
  readonly state: ProviderOperationSnapshot['state'];
  readonly request_hash: string;
  readonly response_summary: ProviderOperationSnapshot['responseSummary'];
  readonly response_hash: string;
  readonly version: number;
}

export class PgChannelWebhookRepository implements ChannelWebhookRepository {
  private readonly policy = new ChannelPolicy();
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async claim(context: WriteTransactionContext, receipt: string, scope: string): Promise<ChannelWebhookReceipt | null> {
    const database = this.transactions.database(context);
    const selected = await database.query<ReceiptRow>(
      `update channel.webhookreceipt set state='processing',attempts=attempts+1,failure_class=null,error_code=null,
      failure_retryable=null,version=version+1 where id=$1 and scope_id=$2 and state in('received','processing')
      returning id,connection_id,provider,scope_id,external_id,attempts,raw_ciphertext,raw_key_version,raw_hash,
      signature_hash,trace_id,received_at,version`,
      [receipt, scope]
    );
    const row = selected.rows[0];
    if (!row) {
      const terminal = await database.query<{ state: string }>('select state from channel.webhookreceipt where id=$1 and scope_id=$2', [receipt, scope]);
      if (terminal.rows[0]?.state === 'verified') return null;
      throw new Error('CHANNEL_WEBHOOK_NOT_RUNNABLE');
    }
    const model = new WebhookReceipt({ id: row.id, connection: row.connection_id, provider: row.provider, scope: row.scope_id,
      externalId: row.external_id, state: 'processing', attempts: row.attempts, ciphertext: row.raw_ciphertext,
      keyVersion: row.raw_key_version, rawHash: row.raw_hash, signatureHash: row.signature_hash,
      receivedAt: new Date(row.received_at).toISOString(), trace: row.trace_id, failure: null, version: Number(row.version) });
    return Object.freeze({ id: model.value.id, connection: model.value.connection, provider: model.value.provider,
      scope: model.value.scope, external: model.value.externalId, attempts: model.value.attempts,
      ciphertext: model.value.ciphertext, keyVersion: model.value.keyVersion, rawHash: model.value.rawHash,
      signatureHash: model.value.signatureHash, trace: model.value.trace, receivedAt: model.value.receivedAt,
      version: model.value.version });
  }

  async apply(context: WriteTransactionContext, receipt: ChannelWebhookReceipt, webhook: StandardChannelWebhook): Promise<ChannelWebhookOutcome> {
    const database = this.transactions.database(context);
    if (receipt.scope !== context.scope) throw new Error('CHANNEL_WEBHOOK_SCOPE_MISMATCH');
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`channel:webhook:${receipt.provider}:${receipt.external}`]);
    const inboxId = receipt.id.replace(/^webhookreceipt:/, 'webhook:');
    if (inboxId === receipt.id) throw new Error('CHANNEL_WEBHOOK_RECEIPT_ID_INVALID');
    const inserted = await database.query<{ version: number }>(
      `insert into channel.webhookinbox(id,receipt_id,connection_id,provider,scope_id,external_id,event_type,external_reference,
      normalized,raw_hash,signature_hash,state,received_at,watermark,trace_id,attempts,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,'processing',$12,$12,$13,$14,0)
      on conflict(connection_id,external_id) do nothing returning version`,
      [inboxId, receipt.id, receipt.connection, receipt.provider, receipt.scope, receipt.external, webhook.eventType,
        webhook.reference, JSON.stringify(webhook.normalized), receipt.rawHash, receipt.signatureHash, receipt.receivedAt,
        receipt.trace, receipt.attempts]
    );
    if (!inserted.rows[0]) return this.replayed(database, receipt, inboxId);
    new WebhookInbox({ id: inboxId, receipt: receipt.id, connection: receipt.connection, externalId: receipt.external,
      eventType: webhook.eventType, state: 'processing', attempts: receipt.attempts, rawHash: receipt.rawHash,
      signatureHash: receipt.signatureHash, watermark: receipt.receivedAt, failure: null, version: 0 });
    const operation = await this.operation(database, receipt, webhook.reference);
    if (!operation) {
      await this.completeInbox(database, inboxId, 0, 'failed');
      await this.verifyReceipt(database, receipt);
      return Object.freeze({ status: 'deadlettered', error: 'CHANNEL_WEBHOOK_MAPPING_MISSING' });
    }
    const decision = this.policy.webhookTransition(operation, webhook.state);
    if (decision === 'apply') await this.updateOperation(database, operation, webhook);
    await this.completeInbox(database, inboxId, 0, 'applied');
    await this.verifyReceipt(database, receipt);
    if (decision !== 'apply') return Object.freeze({ status: decision });
    return Object.freeze({ status: 'applied', event: Object.freeze({ webhook: inboxId, provider: receipt.provider,
      kind: webhook.kind, reference: webhook.reference, operation: operation.value.id,
      internalReference: operation.value.internalReference, state: webhook.state }) });
  }

  async fail(context: WriteTransactionContext, receipt: string, scope: string, failure: ChannelFailure): Promise<void> {
    const changed = await this.transactions.database(context).query(
      `update channel.webhookreceipt set state='failed',failure_class=$3,error_code=$4,failure_retryable=$5,
      failed_at=clock_timestamp(),version=version+1 where id=$1 and scope_id=$2 and state in('received','processing') returning id`,
      [receipt, scope, failure.classification, failure.code, failure.retryable]
    );
    if (!changed.rows[0]) {
      const terminal = await this.transactions.database(context).query('select 1 from channel.webhookreceipt where id=$1 and scope_id=$2 and state in(\'verified\',\'failed\')', [receipt, scope]);
      if (!terminal.rows[0]) throw new Error('CHANNEL_WEBHOOK_RECEIPT_NOT_FOUND');
    }
  }

  private async operation(database: ReturnType<PgTransactionAccess['database']>, receipt: ChannelWebhookReceipt, reference: string | null): Promise<ProviderOperation | null> {
    if (reference === null) return null;
    const selected = await database.query<OperationRow>(
      `select id,provider,scope_id,kind,idempotency_key,internal_reference,external_reference,state,request_hash,
      response_summary,response_hash,version from channel.provideroperation where provider=$1 and external_reference=$2 for update`,
      [receipt.provider, reference]
    );
    const row = selected.rows[0];
    if (!row || row.scope_id !== receipt.scope) return null;
    return new ProviderOperation({ id: row.id, provider: row.provider, scope: row.scope_id, kind: row.kind,
      idempotency: row.idempotency_key, internalReference: row.internal_reference, externalReference: row.external_reference,
      state: row.state, requestHash: row.request_hash, responseSummary: row.response_summary,
      responseHash: row.response_hash, version: Number(row.version) });
  }

  private async updateOperation(database: ReturnType<PgTransactionAccess['database']>, operation: ProviderOperation, webhook: StandardChannelWebhook): Promise<void> {
    const response = providerResponse({ state: webhook.state, externalReference: webhook.reference ?? undefined });
    const changed = await database.query(
      `update channel.provideroperation set state=$2,response_summary=$3::jsonb,response_hash=$4,
      updated_at=clock_timestamp(),version=version+1 where id=$1 and version=$5 returning id`,
      [operation.value.id, webhook.state, JSON.stringify(response.summary), response.hash, operation.value.version]
    );
    if (!changed.rows[0]) throw new Error('CHANNEL_PROVIDER_OPERATION_VERSION_CONFLICT');
  }

  private async replayed(database: ReturnType<PgTransactionAccess['database']>, receipt: ChannelWebhookReceipt, inbox: string): Promise<ChannelWebhookOutcome> {
    const current = await database.query<{ receipt_id: string; raw_hash: string; signature_hash: string; state: string }>(
      'select receipt_id,raw_hash,signature_hash,state from channel.webhookinbox where id=$1 for update', [inbox]
    );
    const row = current.rows[0];
    if (!row || row.receipt_id !== receipt.id || row.raw_hash !== receipt.rawHash || row.signature_hash !== receipt.signatureHash) {
      throw new Error('CHANNEL_WEBHOOK_REPLAY_EVIDENCE_CONFLICT');
    }
    if (!['applied', 'failed'].includes(row.state)) throw new Error('CHANNEL_WEBHOOK_REPLAY_STATE_INVALID');
    await this.verifyReceipt(database, receipt);
    return Object.freeze({ status: 'duplicate' });
  }

  private async completeInbox(database: ReturnType<PgTransactionAccess['database']>, inbox: string, version: number, state: 'applied' | 'failed'): Promise<void> {
    const failed = state === 'failed';
    const changed = await database.query(
      `update channel.webhookinbox set state=$2,error_code=$3,failure_class=$4,failure_retryable=$5,
      processed_at=clock_timestamp(),version=version+1 where id=$1 and state='processing' and version=$6 returning id`,
      [inbox, state, failed ? 'CHANNEL_WEBHOOK_MAPPING_MISSING' : null, failed ? 'unavailable' : null, failed ? false : null, version]
    );
    if (!changed.rows[0]) throw new Error('CHANNEL_WEBHOOK_VERSION_CONFLICT');
  }

  private async verifyReceipt(database: ReturnType<PgTransactionAccess['database']>, receipt: ChannelWebhookReceipt): Promise<void> {
    const changed = await database.query(
      `update channel.webhookreceipt set state='verified',verified_at=clock_timestamp(),failure_class=null,error_code=null,
      failure_retryable=null,failed_at=null,version=version+1 where id=$1 and scope_id=$2 and state='processing' and version=$3 returning id`,
      [receipt.id, receipt.scope, receipt.version]
    );
    if (!changed.rows[0]) throw new Error('CHANNEL_WEBHOOK_RECEIPT_VERSION_CONFLICT');
  }
}
