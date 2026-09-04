import { PROVIDER_UI_CATALOGS, type ProviderUiCatalog } from '@shop/contract';
import { createRegistry, type RegistryPort } from './Registry';

export type ExtensionRegistration = ProviderUiCatalog;
export type ExtensionRegistryPort = RegistryPort<string, ExtensionRegistration>;

export function createExtensionRegistry(): ExtensionRegistryPort {
  const consoleExtensions = PROVIDER_UI_CATALOGS.filter(({ clients }) => clients.includes('console'));
  return createRegistry(consoleExtensions, consoleExtensions.map(({ id }) => id), 'EXTENSION');
}
