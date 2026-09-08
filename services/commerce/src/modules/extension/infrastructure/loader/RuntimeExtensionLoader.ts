import type { JsonObject, UnsignedProviderManifest } from '@shop/contract';
import { providerLimit, requireProvisioner } from '@shop/providercore';
import type { IntegrationConnection } from '@shop/providercore';
import type { ExtensionCandidate, ExtensionLoader, ExtensionLoadContext } from '../../application/port/ExtensionLoader';
import { Manifest } from '../../domain/model/Manifest';
import type { ExtensionRuntimeStore, RuntimeInstallation } from '../../application/port/ExtensionRuntimeStore';
import type { DatabasePool } from '../../../../platform/database/Pool';
import { secretText, type SecretStore } from '../../../../platform/secret/SecretStore';
import type { ExtensionRegistry } from '../../../../composition/ExtensionRegistry';
import { providerFactory } from './ProviderCatalog';
import { PgLocalProviderRuntime } from '../../../../composition/PgLocalProviderRuntime';
import { mapParallel } from '@shop/kernel';
import { PgExtensionRuntimeStore } from '../persistence/PgExtensionRuntimeStore';

export class RuntimeExtensionLoader implements ExtensionLoader {
  constructor(
    private readonly pool: DatabasePool,
    private readonly secrets: SecretStore,
    private readonly registry: ExtensionRegistry,
    private readonly store: ExtensionRuntimeStore
  ) {}

  definition(provider: string): UnsignedProviderManifest {
    return providerFactory(provider).definition;
  }

  async load(): Promise<void> {
    const signal = new AbortController().signal;
    const rows = await this.store.enabled(signal);
    for (const row of rows) await this.registry.register(row.id, row.scope_id, Number(row.version), await this.create(row));
  }

  async stage(installation: string, context: ExtensionLoadContext): Promise<ExtensionCandidate> {
    const row = await this.store.find(installation, context);
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
  disable(provider: string, scope: string, deadline?: number) {
    return this.registry.disable(provider, scope, deadline);
  }

  async reconcile(signal = new AbortController().signal, deadline = Date.now() + 30_000): Promise<void> {
    const ids = new Set((await this.store.enabled(signal, deadline)).map(({ id }) => id));
    const stale = this.registry.registrations().filter((current) => !ids.has(current.installation));
    await mapParallel(stale, 8, async (current) => {
      if (signal.aborted) return;
      await this.registry.disable(current.provider, current.scope, deadline);
    });
  }

  private async create(row: RuntimeInstallation) {
    const manifest = Manifest.parse(row.manifest, row.extension_id).value;
    const factory = providerFactory(row.extension_id);
    if (factory.transport === 'local') {
      const local = requireProvisioner(factory)(new PgLocalProviderRuntime(this.pool, row.scope_id, factory.id));
      return factory.create({ manifest, local });
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

export async function loadProviders(pool: DatabasePool, secrets: SecretStore, registry: ExtensionRegistry): Promise<RuntimeExtensionLoader> {
  const loader = new RuntimeExtensionLoader(pool, secrets, registry, new PgExtensionRuntimeStore(pool));
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
