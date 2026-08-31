import { createHash } from 'node:crypto';
import { COMMERCE_EVENTS, CONTRACT_CHECKSUM, OperationCatalog } from '@shop/contract';
import { CONFIG_CHECKSUM } from '@shop/config/runtime';
import { CONTRACT_SCHEMA_HEAD, TARGET_SCHEMA_HEAD } from '@shop/config/server';
import { JOB_CATALOG } from '../app/jobs';
import type { DatabasePool } from '../foundation/persistence/Pool';
import type { ExtensionRegistry } from './ExtensionRegistry';

interface DatabaseReadiness {
  readonly writable: boolean;
  readonly migration: boolean;
  readonly contract: boolean;
  readonly role: boolean;
  readonly operations: number;
  readonly capabilities: number;
  readonly events: number;
  readonly invitationKeys: boolean;
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
  if (invitationKeyVersions.length < 1 || invitationKeyVersions.length > 3 || new Set(invitationKeyVersions).size !== invitationKeyVersions.length) {
    throw new Error('INVITATION_KEY_VERSIONS_INVALID');
  }
  const expectedRole = workload === 'api' ? 'shopapp' : 'shopjob';
  const client = await pool.connect();
  let database: DatabaseReadiness;
  try {
    await client.query('begin read only');
    await client.query("select set_config('app.workload',$1,true)", [workload]);
    const result = await client.query<DatabaseReadiness>(
      `select not pg_is_in_recovery() writable,
       exists(select 1 from runtime.schemaversion where version=$1) migration,
       exists(select 1 from runtime.schemaversion where version=$2 and checksum=$3) contract,
       current_user=$4 role,
       (select count(*)::integer from runtime.operation) operations,
       (select count(*)::integer from capability.operation) capabilities,
       (select count(*)::integer from runtime.event) events,
       (select missing_count=0 from identity.invitation_key_readiness($5::text[])) "invitationKeys"`,
      [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD, CONTRACT_CHECKSUM, expectedRole, invitationKeyVersions]
    );
    database = result.rows[0]!;
    await client.query('commit');
  } catch (cause) {
    await client.query('rollback').catch(() => undefined);
    throw cause;
  } finally {
    client.release();
  }
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
