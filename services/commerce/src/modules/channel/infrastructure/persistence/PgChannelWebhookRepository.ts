import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ChannelWebhookRecord, ChannelWebhookRepository } from '../../application/port/ChannelJobRepository';
import { WebhookInbox } from '../../domain/model/WebhookInbox';

interface WebhookRow {
  readonly id: string;
  readonly connection_id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly external_id: string;
  readonly attempts: number;
  readonly raw_ciphertext: string;
  readonly raw_hash: string;
  readonly signature_hash: string;
  readonly trace_id: string;
}

export class PgChannelWebhookRepository implements ChannelWebhookRepository {
  private readonly transactions = new PgTransactionAccess();

  async claim(context: WriteTransactionContext, webhook: string): Promise<ChannelWebhookRecord | null> {
    const database = this.transactions.database(context);
    const selected = await database.query<WebhookRow>(
      `update channel.webhookinbox set state='processing',attempts=attempts+1
      where id=$1 and state in('received','processing') returning id,connection_id,provider,scope_id,external_id,attempts,
      raw_ciphertext,raw_hash,signature_hash,trace_id`,
      [webhook]
    );
    const row = selected.rows[0];
    if (!row) {
      const done = await database.query(`select 1 from channel.webhookinbox where id=$1 and state in('applied','ignored')`, [webhook]);
      if (done.rows[0]) return null;
      throw new Error('CHANNEL_WEBHOOK_NOT_RUNNABLE');
    }
    return Object.freeze({
      id: row.id,
      connection: row.connection_id,
      provider: row.provider,
      scope: row.scope_id,
      external: row.external_id,
      attempts: row.attempts,
      ciphertext: row.raw_ciphertext,
      rawHash: row.raw_hash,
      signatureHash: row.signature_hash,
      trace: row.trace_id,
    });
  }

  async apply(
    context: WriteTransactionContext,
    webhook: ChannelWebhookRecord,
    normalized: Readonly<Record<string, unknown>>,
    eventType: string,
    reference: string | null,
    kind: string,
    state: 'processing' | 'succeeded' | 'failed' | 'unknown'
  ): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(`update channel.webhookinbox set event_type=$2,external_reference=$3,normalized=$4::jsonb where id=$1 and state='processing'`, [webhook.id, eventType, reference, JSON.stringify(normalized)]);
    new WebhookInbox(webhook.id, webhook.connection, webhook.external, eventType, 'processing', webhook.attempts, webhook.rawHash, webhook.signatureHash);
    const operation =
      reference === null
        ? undefined
        : (
            await database.query<{ id: string; internal_reference: string }>(
              `update channel.provideroperation set state=$3,response=coalesce(response,'{}'::jsonb)||$4::jsonb,updated_at=clock_timestamp()
              where provider=$1 and external_reference=$2 returning id,internal_reference`,
              [webhook.provider, reference, state, JSON.stringify({ webhook: webhook.id, state: normalized.state })]
            )
          ).rows[0];
    const runtime = new PgRuntimeWriter(database);
    if (['order', 'shipment', 'tracking', 'delivery'].includes(kind) && operation) {
      await runtime.schedule({
        id: `job:tracking:webhook:${webhook.id}`,
        kind: 'tracking',
        owner: 'fulfillment',
        scope: webhook.scope,
        payload: { fulfillment: operation.internal_reference },
        priority: 5,
      });
    }
    await runtime.append({
      id: `event:channel:webhook:${webhook.id}`,
      type: kind === 'refund' ? 'channel.refund.changed' : 'channel.webhook.applied',
      aggregateType: 'webhook',
      aggregate: webhook.id,
      scope: webhook.scope,
      payload: {
        webhook: webhook.id,
        provider: webhook.provider,
        kind,
        reference,
        operation: operation?.id ?? null,
        internalReference: operation?.internal_reference ?? null,
        state,
      },
      trace: webhook.trace,
    });
    await database.query(
      `update channel.webhookinbox set state=case when $2::boolean then 'applied' else 'ignored' end,
      processed_at=clock_timestamp(),error_code=null where id=$1`,
      [webhook.id, operation !== undefined]
    );
  }
}
