import { createHash, randomUUID } from 'node:crypto';
import type { JsonObject } from '@shop/contract';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ChannelJobRepository, ChannelSyncRun } from '../../application/port/ChannelJobRepository';

interface RunRow {
  readonly run: string;
  readonly id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly version: number;
  readonly region: string;
  readonly kind: 'catalog' | 'price' | 'stock' | 'statement';
  readonly cursor_value: string | null;
  readonly input: JsonObject;
}

export class PgChannelJobRepository implements ChannelJobRepository {
  private readonly transactions = new PgTransactionAccess();

  async claim(context: WriteTransactionContext, id: string): Promise<ChannelSyncRun | undefined> {
    const result = await this.transactions.database(context).query<RunRow>(
      `update channel.syncrun run set state='running',started_at=coalesce(started_at,clock_timestamp())
      from channel.connection connection where run.id=$1 and connection.id=run.connection_id and run.state in('queued','running') and connection.status='enabled'
      returning run.id run,run.kind,run.cursor_value,run.input,connection.id,connection.provider,connection.scope_id,connection.version,connection.region`,
      [id]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          run: row.run,
          connection: row.id,
          provider: row.provider,
          scope: row.scope_id,
          connectionVersion: row.version,
          region: row.region,
          kind: row.kind,
          cursor: row.cursor_value,
          input: row.input,
        })
      : undefined;
  }

  async providerTenant(context: ReadTransactionContext, scope: string): Promise<string> {
    const result = await this.transactions.database(context).query<{ tenant: string | null }>(`select access.scope_object($1)->>'tenant' tenant`, [scope]);
    return result.rows[0]?.tenant ?? scope;
  }

  async saveSource(context: WriteTransactionContext, input: Readonly<{ provider: string; scope: string; external: string; version: string; payload: Readonly<Record<string, unknown>> }>): Promise<void> {
    const serialized = JSON.stringify(input.payload);
    await this.transactions.database(context).query(
      `insert into channel.sourcerecord(id,provider,scope_id,objecttype,externalid,sourceversion,payload,payload_hash,disposition,observed_at)
      values($1,$2,$3,'product',$4,$5,$6::jsonb,$7,'accepted',clock_timestamp())
      on conflict(provider,scope_id,objecttype,externalid,sourceversion) do nothing`,
      [`source:${digest(`${input.scope}:${input.provider}:${input.external}:${input.version}`)}`, input.provider, input.scope, input.external, input.version, serialized, digest(serialized)]
    );
  }

  async saveStatement(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      connection: string;
      provider: string;
      scope: string;
      partner: string;
      start: string;
      end: string;
      timezone: string;
      objectReference: string;
      sha256: string;
    }>
  ): Promise<void> {
    await this.transactions.database(context).query(
      `insert into channel.statement(id,connection_id,provider,scope_id,partner_id,period_start,period_end,timezone,object_ref,sha256,generated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,clock_timestamp()) on conflict(connection_id,period_start,period_end) do nothing`,
      [input.id, input.connection, input.provider, input.scope, input.partner, input.start, input.end, input.timezone, input.objectReference, input.sha256]
    );
  }

  scheduleReconciliation(context: WriteTransactionContext, reconciliation: string, scope: string): Promise<void> {
    return new PgRuntimeWriter(this.transactions.database(context)).schedule({
      id: `job:${reconciliation}`,
      kind: 'reconciliation',
      owner: 'finance',
      scope,
      payload: { reconciliation },
      priority: 20,
    });
  }

  async finish(context: WriteTransactionContext, input: Parameters<ChannelJobRepository['finish']>[1]): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update channel.syncrun set state=$2,cursor_value=$3,pulled_count=pulled_count+$4,accepted_count=accepted_count+$5,
      rejected_count=rejected_count+$6,error_summary=error_summary||$7::jsonb,watermark=clock_timestamp(),completed_at=case when $2='completed' then clock_timestamp() end
      where id=$1`,
      [input.run.run, input.complete ? 'completed' : 'running', input.cursor, input.accepted + input.rejected, input.accepted, input.rejected, JSON.stringify(input.errors)]
    );
    const runtime = new PgRuntimeWriter(database);
    if (input.complete) {
      await runtime.append({
        id: `event:${randomUUID()}`,
        type: 'channel.sync.completed',
        aggregateType: 'syncrun',
        aggregate: input.run.run,
        scope: input.run.scope,
        payload: { run: input.run.run, kind: input.run.kind, provider: input.run.provider, accepted: input.accepted, rejected: input.rejected },
        trace: input.trace,
      });
    } else {
      await runtime.schedule({
        id: `job:${randomUUID()}`,
        kind: input.job,
        owner: input.owner,
        scope: input.run.scope,
        payload: { subtype: 'channelsync', run: input.run.run },
        priority: 30,
      });
    }
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
