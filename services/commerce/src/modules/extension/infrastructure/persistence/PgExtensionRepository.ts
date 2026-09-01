import { DomainError } from '../../../../foundation/domain/DomainError';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExtensionListRow, ExtensionRepository, InstallInput, RegisteredManifest } from '../../application/port/ExtensionLoader';
import type { HealthRecord } from '../../domain/model/HealthRecord';
import { Installation, type InstallationState } from '../../domain/model/Installation';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';

interface InstallationRow {
  readonly id: string;
  readonly extension_id: string;
  readonly extension_version: string;
  readonly scope_id: string;
  readonly status: InstallationState;
  readonly version: number;
}

export class PgExtensionRepository implements ExtensionRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async manifest(context: ReadTransactionContext, provider: string): Promise<RegisteredManifest | null> {
    const database = this.transactions.database(context);
    const result = await database.query<RegisteredManifest>(
      `select manifest.id,manifest.version,manifest.manifest,manifest.manifest_hash,
      manifest.signature,manifest.contract_version,contract.status contract_status,contract.schema_hash from extension.manifest manifest
      join extension.contractversion contract on contract.extension_id=manifest.id and contract.contract_version=manifest.contract_version
      where manifest.id=$1 and contract.status='verified' order by manifest.registered_at desc limit 1`,
      [provider]
    );
    return result.rows[0] ?? null;
  }

  async install(context: WriteTransactionContext, input: InstallInput): Promise<Installation> {
    const database = this.transactions.database(context);
    const result = await database.query<InstallationRow>(
      `insert into extension.installation(id,extension_id,extension_version,scope_id,status,
      manifest,base_url,endpoints,secret_ref,health_operation,version,installed_at) values($1,$2,$3,$4,'disabled',$5::jsonb,$6,$7::jsonb,$8,$9,0,
      clock_timestamp()) returning id,extension_id,extension_version,scope_id,status,version`,
      [input.id, input.manifest.id, input.manifest.version, input.scope, JSON.stringify(input.manifest), input.baseUrl, JSON.stringify(input.endpoints), input.secretRef, input.healthOperation]
    );
    const row = result.rows[0];
    if (!row) throw new Error('EXTENSION_INSTALL_FAILED');
    await this.history(database, row.id, null, 'disabled', input.actor, { reason: 'installed', manifestHash: input.manifestHash });
    return installation(row);
  }

  async reconfigure(
    context: WriteTransactionContext,
    id: string,
    scope: string,
    input: Readonly<{ baseUrl: string | null; endpoints: Readonly<Record<string, string>>; secretRef: string | null; healthOperation: string; actor: string; trace: string }>
  ): Promise<Installation> {
    const database = this.transactions.database(context);
    const current = await this.lock(context, id, scope);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    if (current.state !== 'disabled') throw new Error('EXTENSION_RECONFIGURE_STATE_INVALID');
    const result = await database.query<InstallationRow>(
      `update extension.installation set base_url=$3,endpoints=$4::jsonb,secret_ref=$5,
      health_operation=$6,version=version+1 where id=$1 and scope_id=$2 and status='disabled' and version=$7
      returning id,extension_id,extension_version,scope_id,status,version`,
      [id, scope, input.baseUrl, JSON.stringify(input.endpoints), input.secretRef, input.healthOperation, current.version]
    );
    const row = result.rows[0];
    if (!row) throw new Error('EXTENSION_VERSION_CONFLICT');
    await this.history(database, id, 'disabled', 'disabled', input.actor, { reason: 'configuration changed', trace: input.trace });
    return installation(row);
  }

  async lock(context: WriteTransactionContext, id: string, scope: string): Promise<Installation | null> {
    const database = this.transactions.database(context);
    const result = await database.query<InstallationRow>(
      `select id,extension_id,extension_version,scope_id,status,version
      from extension.installation where id=$1 and scope_id=$2 for update`,
      [id, scope]
    );
    return result.rows[0] ? installation(result.rows[0]) : null;
  }

  async activation(context: WriteTransactionContext, id: string, scope: string, provider: string): Promise<Readonly<{ candidate: Installation; active: Installation | null }>> {
    const database = this.transactions.database(context);
    const result = await database.query<InstallationRow>(
      `select id,extension_id,extension_version,scope_id,status,version
      from extension.installation where scope_id=$2 and extension_id=$3 and (id=$1 or status='enabled') order by id for update`,
      [id, scope, provider]
    );
    const candidate = result.rows.find((row) => row.id === id);
    if (!candidate) throw new DomainError('RESOURCE_NOT_FOUND');
    const active = result.rows.find((row) => row.id !== id && row.status === 'enabled');
    return Object.freeze({ candidate: installation(candidate), active: active ? installation(active) : null });
  }

  async latestHealth(context: ReadTransactionContext, id: string, version: number): Promise<Readonly<{ state: 'healthy' | 'degraded' | 'unavailable'; checkedAt: string; latency: number }> | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{ state: 'healthy' | 'degraded' | 'unavailable'; checkedAt: string; latency: number }>(
      `select state,checked_at "checkedAt",latency_ms latency from extension.health
      where installation_id=$1 and connection_version=$2 order by checked_at desc limit 1`,
      [id, version]
    );
    return result.rows[0] ?? null;
  }

  async transition(context: WriteTransactionContext, current: Installation, next: InstallationState, actor: string, evidence: unknown): Promise<Installation> {
    const database = this.transactions.database(context);
    const transitioned = current.transition(next);
    const result = await database.query<InstallationRow>(
      `update extension.installation set status=$3,version=version+1 where id=$1 and scope_id=$2
      and status=$4 and version=$5 returning id,extension_id,extension_version,scope_id,status,version`,
      [current.id, current.scope, next, current.state, current.version]
    );
    const row = result.rows[0];
    if (!row || row.version !== transitioned.version) throw new Error('EXTENSION_VERSION_CONFLICT');
    await this.history(database, current.id, current.state, next, actor, evidence);
    if (next === 'enabled' || next === 'disabled' || next === 'degraded') {
      await new PgRuntimeWriter(database).append({
        id: `event:${randomUUID()}`,
        type: `extension.${next}`,
        aggregateType: 'extension',
        aggregate: current.id,
        scope: current.scope,
        payload: { installation: current.id, provider: current.extension, state: next, version: row.version },
        trace: evidenceTrace(evidence),
      });
    }
    return installation(row);
  }

  async health(context: WriteTransactionContext, record: HealthRecord): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `insert into extension.health(installation_id,checked_at,connection_version,state,latency_ms,reason)
      values($1,$2,$3,$4,$5,$6) on conflict(installation_id,checked_at) do nothing`,
      [record.installation, record.checkedAt, record.version, record.state, record.latency, record.reason ?? null]
    );
  }

  async enqueueHealth(context: WriteTransactionContext, id: string, scope: string, delaySeconds = 0): Promise<void> {
    const database = this.transactions.database(context);
    const availableAt = delayed(delaySeconds);
    await new PgRuntimeWriter(database).schedule({
      id: `job:extensionhealth:${id}:${minuteKey(availableAt)}`,
      kind: 'extensionhealth',
      owner: 'extension',
      scope,
      payload: { installation: id },
      priority: 40,
      availableAt: availableAt.toISOString(),
    });
  }

  async enqueueScan(context: WriteTransactionContext, delaySeconds = 60): Promise<void> {
    const database = this.transactions.database(context);
    const availableAt = delayed(delaySeconds);
    await new PgRuntimeWriter(database).schedule({
      id: `job:extensionhealth:scan:${minuteKey(availableAt)}`,
      kind: 'extensionhealth',
      owner: 'extension',
      scope: null,
      payload: { scan: true },
      priority: 50,
      availableAt: availableAt.toISOString(),
    });
  }

  async list(context: ReadTransactionContext, scopes: readonly string[], cursor: Readonly<{ sort: string | null; id: string | null }>, fetch: number): Promise<readonly ExtensionListRow[]> {
    const database = this.transactions.database(context);
    const result = await database.query<ExtensionListRow>(
      `select installation.id,installation.extension_id,installation.extension_version,
      installation.scope_id,installation.status,installation.manifest,installation.version,installation.installed_at,
      health.state health_state,health.latency_ms health_latency_ms,health.reason health_reason,health.checked_at
      from extension.installation installation left join lateral(select state,latency_ms,reason,checked_at from extension.health
        where installation_id=installation.id order by checked_at desc limit 1) health on true
      where installation.scope_id=any($1::text[])
      and ($2::timestamptz is null or (installation.installed_at,installation.id)<($2::timestamptz,$3))
      order by installation.installed_at desc,installation.id desc limit $4`,
      [scopes, cursor.sort, cursor.id, fetch]
    );
    return result.rows;
  }

  async targets(context: ReadTransactionContext, limit: number) {
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string; scope_id: string; extension_id: string; status: InstallationState }>(
      `select id,scope_id,
      extension_id,status from extension.installation where status in('testing','enabled','degraded') order by installed_at,id limit $1`,
      [limit]
    );
    return result.rows;
  }

  async summaries(context: ReadTransactionContext, ids: readonly string[]) {
    const database = this.transactions.database(context);
    if (ids.length === 0) return [];
    const result = await database.query<import('../../application/port/ExtensionLoader').ExtensionSummary>(
      `select installation.id,
      installation.manifest->'capabilities' capabilities,health.state health_state,health.latency_ms health_latency_ms,
      health.reason health_reason,health.checked_at from extension.installation installation left join lateral(
        select state,latency_ms,reason,checked_at from extension.health where installation_id=installation.id
        order by checked_at desc limit 1) health on true where installation.id=any($1::text[])`,
      [ids]
    );
    return result.rows;
  }

  private async history(database: ReturnType<PgTransactionAccess['database']>, id: string, previous: InstallationState | null, next: InstallationState, actor: string, evidence: unknown): Promise<void> {
    await database.query(
      `insert into extension.activationhistory(installation_id,sequence,previous_state,next_state,actor_id,evidence,occurred_at)
      select $1,coalesce(max(sequence),0)+1,$2,$3,$4,$5::jsonb,clock_timestamp() from extension.activationhistory where installation_id=$1`,
      [id, previous, next, actor, JSON.stringify(evidence)]
    );
  }
}

function delayed(seconds: number): Date {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 86_400) throw new Error('EXTENSION_HEALTH_DELAY_INVALID');
  return new Date(Date.now() + seconds * 1_000);
}

function minuteKey(value: Date): string {
  return value.toISOString().replace(/[-:T]/g, '').slice(0, 12);
}

function installation(row: InstallationRow): Installation {
  return new Installation(row.id, row.extension_id, row.extension_version, row.scope_id, row.status, Number(row.version));
}

function evidenceTrace(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof Reflect.get(value, 'trace') === 'string') return Reflect.get(value, 'trace') as string;
  throw new Error('EXTENSION_TRACE_REQUIRED');
}
