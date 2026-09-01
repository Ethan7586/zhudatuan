import type { JsonObject, UnsignedProviderManifest } from '@shop/contract';
import { providerLimit, type ProviderInstallation } from '@shop/providercore';
import type { IntegrationConnection } from '@shop/providercore';
import type { ExtensionCandidate, ExtensionLoader, ExtensionLoadContext } from '../modules/extension/application/port/ExtensionLoader';
import { Manifest } from '../modules/extension/domain/model/Manifest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { secretText, type SecretStore } from '../foundation/infrastructure/SecretStore';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { providerFactory } from './ProviderFactories';
import { createSupplierProviderInstallation } from '../modules/channel/Module';
import { PgTransactionManager } from '../adapter/database/PgTransactionManager';
import { PgTransactionAccess } from '../adapter/database/PgTransactionAccess';

interface InstallationRow {
  readonly id: string;
  readonly extension_id: string;
  readonly scope_id: string;
  readonly manifest: unknown;
  readonly base_url: string | null;
  readonly endpoints: unknown;
  readonly secret_ref: string | null;
  readonly health_operation: string | null;
  readonly version: number;
}

export class RuntimeExtensionLoader implements ExtensionLoader {
  private readonly transactions: PgTransactionManager;
  private readonly access = new PgTransactionAccess();
  constructor(
    private readonly pool: DatabasePool,
    private readonly secrets: SecretStore,
    private readonly registry: ExtensionRegistry
  ) {
    this.transactions = new PgTransactionManager(pool);
  }

  definition(provider: string): UnsignedProviderManifest {
    return providerFactory(provider).definition;
  }

  async load(): Promise<void> {
    const signal = new AbortController().signal;
    const rows = await this.transactions.read(
      systemOptions(signal, 'load'),
      async (context) =>
        (
          await this.access.database(context).query<InstallationRow>(`select id,extension_id,scope_id,manifest,base_url,endpoints,secret_ref,
      health_operation,version from extension.enabled_installations()`)
        ).rows
    );
    for (const row of rows) await this.registry.register(row.id, row.scope_id, Number(row.version), await this.create(row));
  }

  async stage(installation: string, context: ExtensionLoadContext): Promise<ExtensionCandidate> {
    const { workload, ...execution } = context;
    const row = await this.transactions.read<InstallationRow | undefined>({ ...execution, operation: 'extension.provider.stage', ...(workload === 'worker' ? { workload: 'jobs' as const } : {}) }, async (transaction) => {
      const result = await this.access.database(transaction).query<InstallationRow>(
        `select id,extension_id,scope_id,manifest,base_url,endpoints,secret_ref,
        health_operation,version from extension.load_installation($1,$2)`,
        [installation, context.scope]
      );
      return result.rows[0];
    });
    if (!row) throw new Error('PROVIDER_INSTALLATION_NOT_RUNNABLE');
    return this.registry.stage(row.id, row.scope_id, Number(row.version), await this.create(row));
  }

  activate(candidate: ExtensionCandidate): Promise<void> {
    return this.registry.activate(candidate.token);
  }
  discard(candidate: ExtensionCandidate): Promise<void> {
    return this.registry.discard(candidate.token);
  }
  active(candidate: ExtensionCandidate): boolean {
    return this.registry.active(candidate.provider, candidate.scope, candidate.installation);
  }
  disable(provider: string, scope: string): Promise<void> {
    return this.registry.disable(provider, scope);
  }

  async reconcile(): Promise<void> {
    const signal = new AbortController().signal;
    const ids = await this.transactions.read(
      systemOptions(signal, 'reconcile'),
      async (context) => new Set((await this.access.database(context).query<{ id: string }>('select id from extension.enabled_installations()')).rows.map(({ id }) => id))
    );
    for (const current of this.registry.registrations()) if (!ids.has(current.installation)) await this.registry.disable(current.provider, current.scope);
  }

  private async create(row: InstallationRow) {
    const manifest = Manifest.parse(row.manifest, row.extension_id).value;
    const factory = providerFactory(row.extension_id);
    if (factory.transport === 'local') {
      const installation: ProviderInstallation = { manifest, local: createSupplierProviderInstallation(this.pool, row.scope_id) };
      return factory.create(installation);
    }
    const secret = parseSecret(await secretText(this.secrets, required(row.secret_ref, 'PROVIDER_SECRET_REF_MISSING'), 'providerconfig'));
    if (row.health_operation !== manifest.healthOperation) throw new Error('PROVIDER_HEALTH_OPERATION_MISMATCH');
    const connection: IntegrationConnection = Object.freeze({
      id: row.id,
      baseUrl: required(row.base_url, 'PROVIDER_BASE_URL_MISSING'),
      endpoints: stringMap(row.endpoints, 'PROVIDER_ENDPOINTS_INVALID'),
      secret,
      limits: providerLimit(manifest),
      healthOperation: manifest.healthOperation,
    });
    return factory.create({ manifest, connection });
  }
}

function systemOptions(signal: AbortSignal, action: string) {
  return { tenant: '', membership: '', scope: 'extension', actor: 'system:extension', trace: `extension:${action}`, operation: `extension.provider.${action}`, deadline: Date.now() + 30_000, signal };
}

export async function loadProviders(pool: DatabasePool, secrets: SecretStore, registry: ExtensionRegistry): Promise<RuntimeExtensionLoader> {
  const loader = new RuntimeExtensionLoader(pool, secrets, registry);
  await loader.load();
  return loader;
}

export function providerCatalogLoader(): ExtensionLoader {
  return Object.freeze({
    definition: (provider: string) => providerFactory(provider).definition,
    stage: async () => {
      throw new Error('PROVIDER_WORKER_PROBE_REQUIRED');
    },
    activate: async () => {
      throw new Error('PROVIDER_WORKER_ACTIVATION_REQUIRED');
    },
    discard: async () => undefined,
    active: () => false,
    disable: async () => {
      throw new Error('PROVIDER_WORKER_DEACTIVATION_REQUIRED');
    },
    reconcile: async () => undefined,
  });
}

function parseSecret(value: string): Readonly<Record<string, string>> {
  try {
    return stringMap(JSON.parse(value), 'PROVIDER_SECRET_INVALID');
  } catch (cause) {
    throw new Error('PROVIDER_SECRET_JSON_INVALID', { cause });
  }
}
function stringMap(value: unknown, code: string): Readonly<Record<string, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  const entries = Object.entries(value as JsonObject);
  if (!entries.every(([, item]) => typeof item === 'string' && item.trim())) throw new Error(code);
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}
function required(value: string | null, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value;
}
