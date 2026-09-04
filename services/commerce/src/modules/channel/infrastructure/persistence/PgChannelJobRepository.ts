import { createHash, randomUUID } from 'node:crypto';
import type { JsonObject, ProviderCapability } from '@shop/contract';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ChannelJobRepository, ChannelSyncRun } from '../../application/port/ChannelJobRepository';
import type { ConnectionState } from '../../domain/model/Connection';
import type { SyncPhase } from '../../domain/model/SyncRun';
import { SyncPolicy } from '../../domain/policy/SyncPolicy';

interface RunRow {
  readonly run: string;
  readonly id: string;
  readonly provider: string;
  readonly scope_id: string;
  readonly version: number;
  readonly run_version: number;
  readonly status: ConnectionState;
  readonly capability_snapshot: readonly ProviderCapability[];
  readonly region: string;
  readonly kind: 'catalog' | 'price' | 'stock' | 'statement';
  readonly cursor_value: string | null;
  readonly input_hash: string;
  readonly phase: SyncPhase;
  readonly watermark: string | null;
  readonly pulled_count: number;
  readonly accepted_count: number;
  readonly rejected_count: number;
  readonly input: JsonObject;
}

export class PgChannelJobRepository implements ChannelJobRepository {
  private readonly transactions = new PgTransactionAccess();
  private readonly policy = new SyncPolicy();

  async claim(context: WriteTransactionContext, id: string, scope: string): Promise<ChannelSyncRun | undefined> {
    const result = await this.transactions.database(context).query<RunRow>(
      `update channel.syncrun run set state='running',phase='pull',started_at=coalesce(started_at,clock_timestamp()),version=version+1
      from channel.connection connection where run.id=$1 and connection.id=run.connection_id and connection.scope_id=$2
      and run.state in('queued','running') and connection.status='enabled'
      returning run.id run,run.kind,run.cursor_value,run.input,run.input_hash,run.phase,run.watermark,
      run.pulled_count,run.accepted_count,run.rejected_count,run.version run_version,
      connection.id,connection.provider,connection.scope_id,connection.status,connection.capability_snapshot,
      connection.version,connection.region`,
      [id, scope]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          run: row.run,
          connection: row.id,
          provider: row.provider,
          scope: row.scope_id,
          connectionVersion: row.version,
          runVersion: row.run_version,
          connectionState: row.status,
          capabilities: Object.freeze([...row.capability_snapshot]),
          region: row.region,
          kind: row.kind,
          cursor: row.cursor_value,
          inputHash: row.input_hash,
          progress: Object.freeze({
            pulled: Number(row.pulled_count),
            accepted: Number(row.accepted_count),
            rejected: Number(row.rejected_count),
            phase: row.phase,
            cursor: row.cursor_value,
            watermark: row.watermark === null ? null : new Date(row.watermark).toISOString(),
          }),
          input: row.input,
        })
      : undefined;
  }

  async providerTenant(context: ReadTransactionContext, scope: string): Promise<string> {
    const result = await this.transactions.database(context).query<{ tenant: string | null }>(`select access.scope_object($1)->>'tenant' tenant`, [scope]);
    return result.rows[0]?.tenant ?? scope;
  }

  async beginApply(context: WriteTransactionContext, run: ChannelSyncRun): Promise<ChannelSyncRun> {
    const database = this.transactions.database(context);
    const changed = await database.query<{ version: number }>(`update channel.syncrun set phase='apply',version=version+1 where id=$1 and state='running' and phase='pull' and version=$2 returning version`, [run.run, run.runVersion]);
    const row = changed.rows[0];
    if (!row) {
      const current = await database.query<{ state: string }>(`select state from channel.syncrun where id=$1`, [run.run]);
      if (current.rows[0]?.state === 'cancelled') throw new Error('CHANNEL_SYNC_CANCELLED');
      throw new Error('CHANNEL_SYNC_VERSION_CONFLICT');
    }
    return Object.freeze({
      ...run,
      runVersion: Number(row.version),
      progress: Object.freeze({ ...run.progress, phase: 'apply' as const }),
    });
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
    const watermark = new Date().toISOString();
    const errors = safeErrors(input.errors);
    this.policy.requireCheckpoint(input.run.progress, {
      phase: 'commit',
      progress: {
        pulled: input.run.progress.pulled + input.accepted + input.rejected,
        accepted: input.run.progress.accepted + input.accepted,
        rejected: input.run.progress.rejected + input.rejected,
        phase: 'commit',
        cursor: input.cursor,
        watermark,
      },
    });
    const changed = await database.query<{ version: number; accepted_count: number; rejected_count: number }>(
      `update channel.syncrun set state=$2,cursor_value=$3,pulled_count=pulled_count+$4,accepted_count=accepted_count+$5,
      rejected_count=rejected_count+$6,error_summary=error_summary||$7::jsonb,phase='commit',watermark=clock_timestamp(),
      completed_at=case when $2='completed' then clock_timestamp() end,version=version+1
      where id=$1 and state='running' and phase='apply' and version=$8 returning version,accepted_count,rejected_count`,
      [input.run.run, input.complete ? 'completed' : 'running', input.cursor, input.accepted + input.rejected, input.accepted, input.rejected, JSON.stringify(errors), input.run.runVersion]
    );
    const checkpoint = changed.rows[0];
    if (!checkpoint) throw new Error('CHANNEL_SYNC_VERSION_CONFLICT');
    const runtime = new PgRuntimeWriter(database);
    if (input.complete) {
      await runtime.append({
        id: `event:${randomUUID()}`,
        type: 'channel.sync.completed',
        aggregateType: 'syncrun',
        aggregate: input.run.run,
        scope: input.run.scope,
        payload: { run: input.run.run, kind: input.run.kind, provider: input.run.provider, accepted: Number(checkpoint.accepted_count), rejected: Number(checkpoint.rejected_count) },
        trace: input.trace,
      });
    } else {
      await runtime.schedule({
        id: `job:channelsync:${input.run.run}:${checkpoint.version}`,
        kind: input.job,
        owner: input.owner,
        scope: input.run.scope,
        payload: { subtype: 'channelsync', run: input.run.run },
        priority: 30,
      });
    }
  }

  async fail(context: WriteTransactionContext, run: string, scope: string, failure: import('../../domain/model/Failure').ChannelFailure): Promise<void> {
    await this.transactions.database(context).query(
      `update channel.syncrun run set state='failed',failure_class=$3,failure_code=$4,failure_retryable=$5,
      completed_at=clock_timestamp(),version=run.version+1 from channel.connection connection
      where run.id=$1 and run.connection_id=connection.id and connection.scope_id=$2 and run.state in('queued','running')`,
      [run, scope, failure.classification, failure.code, failure.retryable]
    );
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeErrors(errors: readonly unknown[]): readonly Readonly<{ keyHash: string; code: string }>[] {
  return Object.freeze(
    errors.slice(0, 100).map((value) => {
      const item = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {};
      const keyHash = typeof item.keyHash === 'string' && /^[a-f0-9]{64}$/.test(item.keyHash) ? item.keyHash : digest('invalid');
      const code = typeof item.code === 'string' && /^[A-Z][A-Z0-9_]{2,127}$/.test(item.code) ? item.code : 'CHANNEL_SYNC_ERROR_INVALID';
      return Object.freeze({ keyHash, code });
    })
  );
}
