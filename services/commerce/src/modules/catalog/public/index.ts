import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { CatalogSku } from '../application/port/CatalogSku';
export type { CatalogSourceInput } from './CatalogSource';

export interface ChannelCatalogPort {
  accept(context: WriteTransactionContext, input: import('./CatalogSource').CatalogSourceInput): Promise<void>;
  sku(context: ReadTransactionContext, provider: string, scope: string, external: string): Promise<string | null>;
  keys(context: ReadTransactionContext, provider: string, scope: string, after: string | null): Promise<readonly string[]>;
}
export interface InventoryCatalogPort {
  find(context: ReadTransactionContext, scope: string, reference: string): Promise<string | null>;
}
export const PROVIDER_CATALOG_PORT = publicPort<ChannelCatalogPort>('catalog', 'providersync');
export const INVENTORY_CATALOG_PORT = publicPort<InventoryCatalogPort>('catalog', 'inventoryimport');
export interface CatalogRiskDecisionPort {
  execute(context: WriteTransactionContext, command: Readonly<{ decision: string; scope: string; listing: string }>): Promise<void>;
}
export const RISK_CATALOG_PORT = publicPort<CatalogRiskDecisionPort>('catalog', 'risk');
export { REFERRAL_CATALOG_PORT, type ReferralCatalogPort } from './ReferralCatalogPort';
export { CART_CATALOG_PORT, type CartCatalogPort, type CartListingSnapshot } from './CartCatalogPort';
export { CHECKOUT_CATALOG_PORT, type CheckoutCatalogItem, type CheckoutCatalogPort } from './CheckoutCatalogPort';
export { EXPERIENCE_CATALOG_PORT, type ExperienceCatalogPort, type ExperienceCatalogReferences } from './ExperienceCatalogPort';
export { CATALOG_READ_PORT, type CatalogPosition, type CatalogReadPort, type StorefrontListing } from './CatalogReadPort';
export { MEMBER_CATALOG_PORT, type MemberCatalogPort } from './MemberCatalogPort';
