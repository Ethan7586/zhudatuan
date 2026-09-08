import { createHash } from 'node:crypto';
import { COMMERCE_EVENTS, CONTRACT_CHECKSUM, CONTRACT_VERSION, OperationCatalog } from '@shop/contract';
import { CONFIG_CHECKSUM } from '@shop/config/runtime';
import { TARGET_SCHEMA_HEAD } from '@shop/config/server';
import { JOB_CATALOG } from '../pipeline/JobCatalog';
import type { DatabasePool } from '../platform/database/Pool';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { PgTransactionManager } from '../platform/database/PgTransactionManager';
import { PgTransactionAccess } from '../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../platform/database/TransactionContext';

export interface DatabaseReadiness {
  readonly writable: boolean;
  readonly migration: boolean;
  readonly contract: boolean;
  readonly role: boolean;
  readonly operations: number;
  readonly capabilities: number;
  readonly events: number;
  readonly invitationKeys: boolean;
}

export interface RuntimeReadinessCheckpoint {
  readonly database: DatabaseReadiness;
}

export interface RuntimeReadinessState {
  readonly healthy: boolean;
  readonly condition: 'ready' | 'degraded' | 'notready';
  readonly degraded: readonly string[];
  readonly configuration: Readonly<{ checksum: string; matches: boolean }>;
  readonly contract: Readonly<{ checksum: string; matches: boolean }>;
  readonly migration: Readonly<{ head: string; matches: boolean }>;
  readonly registries: Readonly<{ operations: number; events: number; jobs: number; checksum: string }>;
  readonly database: DatabaseReadiness;
  readonly extensions: Readonly<{ registered: number; healthy: number; unhealthy: number; checksum: string }>;
}

export async function runtimeReadiness(pool: DatabasePool, extensions: ExtensionRegistry, workload: 'api' | 'jobs', invitationKeyVersions: readonly string[]): Promise<RuntimeReadinessState> {
  const expectedRole = workload === 'api' ? 'shopapp' : 'shopjob';
  const signal = new AbortController().signal;
  const deadline = Date.now() + 30_000;
  const manager = new PgTransactionManager(pool);
  const access = new PgTransactionAccess();
  const checkpoint = await manager.read(
    { tenant: 'runtime', membership: '', scope: 'runtime', actor: `bootstrap:${workload}`, trace: `readiness:${workload}`, operation: 'runtime.readiness', workload: workload === 'jobs' ? 'jobs' : 'api', signal, deadline },
    (context) => runtimeReadinessCheckpoint(context, expectedRole, invitationKeyVersions, access)
  );
  return finalizeRuntimeReadiness(checkpoint, extensions);
}

export async function runtimeReadinessCheckpoint(context: ReadTransactionContext, expectedRole: 'shopapp' | 'shopjob', invitationKeyVersions: readonly string[], access = new PgTransactionAccess()): Promise<RuntimeReadinessCheckpoint> {
  assertInvitationKeyVersions(invitationKeyVersions);
  const result = await access.database(context).query<DatabaseReadiness>(
    `select not pg_is_in_recovery() writable,
     exists(select 1 from runtime.schemaversion where version=$1) migration,
     exists(select 1 from runtime.contractcatalog catalog where catalog.artifact='commerce' and catalog.version=$2
       and catalog.status='active' and catalog.operation_count=(select count(*) from runtime.operation)
       and catalog.event_count=(select count(*) from runtime.event where retired_at is null)
       and catalog.checksum~'^[0-9a-f]{64}$') contract,
     current_user=$3 role,
     (select count(*)::integer from runtime.operation) operations,
     (select count(*)::integer from capability.operation) capabilities,
     (select count(*)::integer from runtime.event where retired_at is null) events,
     (select missing_count=0 from identity.invitation_key_readiness($4::text[])) "invitationKeys"`,
    [TARGET_SCHEMA_HEAD, CONTRACT_VERSION, expectedRole, invitationKeyVersions]
  );
  const database = result.rows[0];
  if (!database) throw new Error('RUNTIME_DATABASE_STATE_MISSING');
  return Object.freeze({ database: Object.freeze(database) });
}

export async function finalizeRuntimeReadiness(checkpoint: RuntimeReadinessCheckpoint, extensions: ExtensionRegistry): Promise<RuntimeReadinessState> {
  const database = checkpoint.database;
  const health = await extensions.healthAll();
  const operationIds = OperationCatalog.all().map(({ id }) => id);
  const eventIds = COMMERCE_EVENTS.map(({ type }) => type);
  const jobIds = JOB_CATALOG.map(({ id }) => id);
  const registries = Object.freeze({ operations: operationIds.length, events: eventIds.length, jobs: jobIds.length, checksum: digest([...operationIds, ...eventIds, ...jobIds]) });
  const configuration = Object.freeze({ checksum: CONFIG_CHECKSUM, matches: /^[0-9a-f]{64}$/.test(CONFIG_CHECKSUM) });
  const extensionIds = [...new Set(extensions.all().map(({ manifest }) => manifest.id))];
  const extensionState = Object.freeze({
    registered: extensionIds.length,
    healthy: health.filter(({ state }) => state === 'healthy').length,
    unhealthy: health.filter(({ state }) => state !== 'healthy').length,
    checksum: digest(extensionIds),
  });
  const healthy =
    configuration.matches &&
    database.writable &&
    database.migration &&
    database.contract &&
    database.role &&
    database.operations === registries.operations &&
    database.capabilities === registries.operations &&
    database.events === registries.events &&
    database.invitationKeys;
  const degraded = Object.freeze(extensionState.unhealthy === 0 ? [] : ['extension.unavailable']);
  return Object.freeze({
    healthy,
    condition: healthy ? (degraded.length === 0 ? 'ready' : 'degraded') : 'notready',
    degraded,
    configuration,
    contract: Object.freeze({ checksum: CONTRACT_CHECKSUM, matches: database.contract }),
    migration: Object.freeze({ head: TARGET_SCHEMA_HEAD, matches: database.migration }),
    registries,
    database,
    extensions: extensionState,
  });
}

function assertInvitationKeyVersions(versions: readonly string[]): void {
  if (versions.length < 1 || versions.length > 3 || new Set(versions).size !== versions.length) throw new Error('INVITATION_KEY_VERSIONS_INVALID');
}

function digest(values: readonly string[]): string {
  return createHash('sha256')
    .update([...values].sort().join('\n'))
    .digest('hex');
}

export async function assertRuntimeReady(pool: DatabasePool, extensions: ExtensionRegistry, workload: 'api' | 'jobs', invitationKeyVersions: readonly string[]): Promise<RuntimeReadinessState> {
  const state = await runtimeReadiness(pool, extensions, workload, invitationKeyVersions);
  if (!state.healthy) throw new Error(`RUNTIME_NOT_READY:${JSON.stringify(state)}`);
  return state;
}
