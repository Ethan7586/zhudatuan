import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';
export type { CatalogSku } from './CatalogSku';
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
  execute(context: WriteTransactionContext, command: Readonly<{ decision: string; scope: string; listing: string; proof: string; action: 'suggestunlist'; evidenceHash: string }>): Promise<void>;
  qualification(
    context: WriteTransactionContext,
    command: Readonly<{
      event: string;
      qualification: string;
      scope: string;
      subjectKind: string;
      subjectId: string;
      productIds: readonly string[];
      categoryIds: readonly string[];
      regionIds: readonly string[];
    }>
  ): Promise<number>;
}
export const RISK_CATALOG_PORT = publicPort<CatalogRiskDecisionPort>('catalog', 'risk');
export { REFERRAL_CATALOG_PORT, type ReferralCatalogPort } from './ReferralCatalogPort';
export { CART_CATALOG_PORT, type CartCatalogPort, type CartListingSnapshot } from './CartCatalogPort';
export { CHECKOUT_CATALOG_PORT, type CheckoutCatalogItem, type CheckoutCatalogPort } from './CheckoutCatalogPort';
export { EXPERIENCE_CATALOG_PORT, type ExperienceCatalogEvidence, type ExperienceCatalogItem, type ExperienceCatalogPort, type ExperienceCatalogReferences } from './ExperienceCatalogPort';
export { CATALOG_READ_PORT, type CatalogPosition, type CatalogReadPort, type StorefrontCategoryFacet, type StorefrontListing } from './CatalogReadPort';
export { CATALOG_DIMENSION_PORT, type CatalogDimensionKind, type CatalogDimensionLabel, type CatalogDimensionPort } from './CatalogDimensionPort';
export { MEMBER_CATALOG_PORT, type MemberCatalogPort, type MemberCatalogVisibility } from './MemberCatalogPort';
