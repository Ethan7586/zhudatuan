import type { ExtensionRegistry } from '../../../../composition/ExtensionRegistry';
import type { SecretStore } from '../../../../platform/secret/SecretStore';
import type { DatabasePool } from '../../../../platform/database/Pool';
import type { ExtensionLoader } from '../../application/port/ExtensionLoader';
import { loadProviders, providerCatalogLoader } from './RuntimeExtensionLoader';

export function extensionCatalog(): ExtensionLoader {
  return providerCatalogLoader();
}

export function extensionLoader(pool: DatabasePool, secrets: SecretStore, registry: ExtensionRegistry): Promise<ExtensionLoader> {
  return loadProviders(pool, secrets, registry);
}
