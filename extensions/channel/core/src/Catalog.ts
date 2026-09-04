export type ProviderClient = 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';

export interface ProviderCatalog {
  readonly id: string;
  readonly name: string;
  readonly business: string;
  readonly clients: readonly ProviderClient[];
  readonly settings: readonly string[];
  readonly help: string;
}

export function defineProviderCatalog(catalog: ProviderCatalog): ProviderCatalog {
  if (!catalog.id.trim() || !catalog.name.trim() || !catalog.business.trim() || !catalog.clients.length || !catalog.settings.length || !catalog.help.trim()) {
    throw new Error('PROVIDER_CATALOG_INVALID');
  }
  return Object.freeze({ ...catalog, clients: Object.freeze([...catalog.clients]), settings: Object.freeze([...catalog.settings]) });
}
