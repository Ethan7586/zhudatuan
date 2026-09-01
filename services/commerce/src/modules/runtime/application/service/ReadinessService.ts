import { createHash } from 'node:crypto';
import { COMMERCE_EVENTS, CONTRACT_CHECKSUM, OperationCatalog } from '@shop/contract';
import { CONFIG_CHECKSUM } from '@shop/config/runtime';
import { TARGET_SCHEMA_HEAD } from '@shop/config/server';
import { JOB_CATALOG } from '../../../../foundation/application/JobCatalog';
import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CapabilityReadinessPort } from '../../../capability/public/ReadinessPort';
import type { IdentityReadinessPort } from '../../../identity/public/ReadinessPort';
import type { RuntimeDatabaseState, RuntimeRepository } from '../port/RuntimeRepository';

export interface ReadinessCheckpoint {
  readonly database: RuntimeDatabaseState & Readonly<{ capabilities: number; invitationKeys: boolean }>;
}

export interface ReadinessState {
  readonly healthy: boolean;
  readonly condition: 'ready' | 'degraded' | 'notready';
  readonly degraded: readonly string[];
  readonly configuration: Readonly<{ checksum: string; matches: boolean }>;
  readonly contract: Readonly<{ checksum: string; matches: boolean }>;
  readonly migration: Readonly<{ head: string; matches: boolean }>;
  readonly registries: Readonly<{ operations: number; events: number; jobs: number; checksum: string }>;
  readonly database: ReadinessCheckpoint['database'];
  readonly extensions: Readonly<{ registered: number; healthy: number; unhealthy: number; checksum: string }>;
}

export class ReadinessService {
  constructor(
    private readonly runtime: RuntimeRepository,
    private readonly capabilities: CapabilityReadinessPort,
    private readonly identity: IdentityReadinessPort,
    private readonly extensions: ExtensionRegistry,
    private readonly invitationKeyVersions: readonly string[]
  ) {
    if (invitationKeyVersions.length < 1 || invitationKeyVersions.length > 3 || new Set(invitationKeyVersions).size !== invitationKeyVersions.length) {
      throw new Error('INVITATION_KEY_VERSIONS_INVALID');
    }
  }

  async checkpoint(context: ReadTransactionContext): Promise<ReadinessCheckpoint> {
    const database = await this.runtime.databaseState(context);
    const capabilities = await this.capabilities.operationCount(context);
    const invitationKeys = await this.identity.invitationKeysReady(context, this.invitationKeyVersions);
    return Object.freeze({ database: Object.freeze({ ...database, capabilities, invitationKeys }) });
  }

  async finalize(checkpoint: ReadinessCheckpoint): Promise<ReadinessState> {
    const health = await this.extensions.healthAll();
    const operationIds = OperationCatalog.all().map(({ id }) => id);
    const eventIds = COMMERCE_EVENTS.map(({ type }) => type);
    const jobIds = JOB_CATALOG.map(({ id }) => id);
    const registries = Object.freeze({ operations: operationIds.length, events: eventIds.length, jobs: jobIds.length, checksum: digest([...operationIds, ...eventIds, ...jobIds]) });
    const configuration = Object.freeze({ checksum: CONFIG_CHECKSUM, matches: /^[0-9a-f]{64}$/.test(CONFIG_CHECKSUM) });
    const extensionIds = [...new Set(this.extensions.all().map(({ manifest }) => manifest.id))];
    const extensions = Object.freeze({
      registered: extensionIds.length,
      healthy: health.filter(({ state }) => state === 'healthy').length,
      unhealthy: health.filter(({ state }) => state !== 'healthy').length,
      checksum: digest(extensionIds),
    });
    const database = checkpoint.database;
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
    const degraded = Object.freeze(extensions.unhealthy === 0 ? [] : ['extension.unavailable']);
    return Object.freeze({
      healthy,
      condition: healthy ? (degraded.length === 0 ? 'ready' : 'degraded') : 'notready',
      degraded,
      configuration,
      contract: Object.freeze({ checksum: CONTRACT_CHECKSUM, matches: database.contract }),
      migration: Object.freeze({ head: TARGET_SCHEMA_HEAD, matches: database.migration }),
      registries,
      database,
      extensions,
    });
  }
}

function digest(values: readonly string[]): string {
  return createHash('sha256')
    .update([...values].sort().join('\n'))
    .digest('hex');
}
