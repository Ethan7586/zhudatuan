export type { CatalogSku } from '../application/port/CatalogSku';
export type { CatalogSourceInput } from '../CatalogSourcePort';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
export interface ChannelCatalogPort {
  accept(database: OperationDatabase, input: import('../CatalogSourcePort').CatalogSourceInput): Promise<void>;
  sku(database: OperationDatabase, provider: string, scope: string, external: string): Promise<string | null>;
  keys(database: OperationDatabase, provider: string, scope: string, after: string | null): Promise<readonly string[]>;
}
export interface CatalogRiskDecisionPort {
  execute(database: OperationDatabase, command: Readonly<{ decision: string; scope: string; listing: string }>): Promise<void>;
}
export { REFERRAL_CATALOG_PORT, PgReferralCatalogPort, type ReferralCatalogPort } from './ReferralCatalogPort';
export { CART_CATALOG_PORT, PgCartCatalogPort, type CartCatalogPort, type CartListingSnapshot } from './CartCatalogPort';
export { CHECKOUT_CATALOG_PORT, PgCheckoutCatalogPort, type CheckoutCatalogItem, type CheckoutCatalogPort } from './CheckoutCatalogPort';
export { EXPERIENCE_CATALOG_PORT, PgExperienceCatalogPort, type ExperienceCatalogPort, type ExperienceCatalogReferences } from './ExperienceCatalogPort';
export { CATALOG_READ_PORT, PgCatalogReadPort, type CatalogPosition, type CatalogReadPort, type StorefrontListing } from './CatalogReadPort';
export { MEMBER_CATALOG_PORT, PgMemberCatalogPort, type MemberCatalogPort } from './MemberCatalogPort';
