import type { ExtensionRegistry } from '../../../../bootstrap/ExtensionRegistry';
import type { SecretStore } from '../../../../foundation/infrastructure/SecretStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { ExtensionLoader } from '../../application/port/ExtensionLoader';
import { loadProviders, providerCatalogLoader } from './RuntimeExtensionLoader';

export function extensionCatalog(): ExtensionLoader {
  return providerCatalogLoader();
}

export function extensionLoader(pool: DatabasePool, secrets: SecretStore, registry: ExtensionRegistry): Promise<ExtensionLoader> {
  return loadProviders(pool, secrets, registry);
}
