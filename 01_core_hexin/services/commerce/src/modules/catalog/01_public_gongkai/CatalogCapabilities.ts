export const CATALOG_CAPABILITIES = Object.freeze({
  read: 'catalog.read',
  manage: 'catalog.manage',
} as const);

export type CatalogCapability = (typeof CATALOG_CAPABILITIES)[keyof typeof CATALOG_CAPABILITIES];
