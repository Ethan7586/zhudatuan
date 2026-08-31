import type { CommerceModule } from '../bootstrap/ModuleRegistry';
import { RuntimeModule } from '../modules/RuntimeModule';
import { ObservabilityModule } from '../modules/observability/ObservabilityModule';
import { AccessModule } from '../modules/access/AccessModule';
import { AuditModule } from '../modules/audit/AuditModule';
import { BenefitModule } from '../modules/benefit/BenefitModule';
import { CapabilityModule } from '../modules/capability/CapabilityModule';
import { CartModule } from '../modules/cart/CartModule';
import { CatalogModule } from '../modules/catalog/CatalogModule';
import { ChannelModule } from '../modules/channel/ChannelModule';
import { CheckoutModule } from '../modules/checkout/CheckoutModule';
import { ExperienceModule } from '../modules/experience/ExperienceModule';
import { ExtensionModule } from '../modules/extension/ExtensionModule';
import { FinanceModule } from '../modules/finance/FinanceModule';
import { FulfillmentModule } from '../modules/fulfillment/FulfillmentModule';
import { IdentityModule } from '../modules/identity/IdentityModule';
import { InventoryModule } from '../modules/inventory/InventoryModule';
import { MarketingModule } from '../modules/marketing/MarketingModule';
<<<<<<< HEAD
<<<<<<< HEAD
import { ReferralModule } from '../modules/referral/ReferralModule';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { ReferralModule } from '../modules/referral/ReferralModule';
>>>>>>> 018b2a71 (chore(release): capture current production source)
import { MemberModule } from '../modules/member/MemberModule';
import { NotificationModule } from '../modules/notification/NotificationModule';
import { OrderModule } from '../modules/order/OrderModule';
import { OrganizationModule } from '../modules/organization/OrganizationModule';
import { PartnerModule } from '../modules/partner/PartnerModule';
import { PaymentModule } from '../modules/payment/PaymentModule';
import { PricingModule } from '../modules/pricing/PricingModule';
import { QualificationModule } from '../modules/qualification/QualificationModule';
import { ReportingModule } from '../modules/reporting/ReportingModule';
import { RiskModule } from '../modules/risk/RiskModule';
import { SupportModule } from '../modules/support/SupportModule';
import { VerificationModule } from '../modules/verification/VerificationModule';
import { VoucherModule } from '../modules/voucher/VoucherModule';
import { EVENT_SCHEMA_TYPES } from './events';

export const BUSINESS_MODULES: readonly CommerceModule[] = Object.freeze([
  IdentityModule, OrganizationModule, AccessModule, CapabilityModule, PartnerModule, MemberModule, QualificationModule,
<<<<<<< HEAD
<<<<<<< HEAD
  CatalogModule, PricingModule, InventoryModule, ExperienceModule, MarketingModule, ReferralModule, CartModule, CheckoutModule, OrderModule,
=======
  CatalogModule, PricingModule, InventoryModule, ExperienceModule, MarketingModule, CartModule, CheckoutModule, OrderModule,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  CatalogModule, PricingModule, InventoryModule, ExperienceModule, MarketingModule, ReferralModule, CartModule, CheckoutModule, OrderModule,
>>>>>>> 018b2a71 (chore(release): capture current production source)
  FulfillmentModule, VerificationModule, PaymentModule, VoucherModule, BenefitModule, FinanceModule, ChannelModule, SupportModule,
  NotificationModule, ReportingModule, RiskModule, AuditModule, ExtensionModule,
]);

export const COMMERCE_MODULES: readonly CommerceModule[] = Object.freeze([RuntimeModule, ObservabilityModule, ...BUSINESS_MODULES]);

<<<<<<< HEAD
<<<<<<< HEAD
if (BUSINESS_MODULES.length !== 29 || new Set(BUSINESS_MODULES.map(({ id }) => id)).size !== 29) throw new Error('BUSINESS_MODULE_CATALOG_INVALID');
=======
if (BUSINESS_MODULES.length !== 28 || new Set(BUSINESS_MODULES.map(({ id }) => id)).size !== 28) throw new Error('BUSINESS_MODULE_CATALOG_INVALID');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
if (BUSINESS_MODULES.length !== 29 || new Set(BUSINESS_MODULES.map(({ id }) => id)).size !== 29) throw new Error('BUSINESS_MODULE_CATALOG_INVALID');
>>>>>>> 018b2a71 (chore(release): capture current production source)
if (new Set<string>(EVENT_SCHEMA_TYPES).size !== EVENT_SCHEMA_TYPES.length) throw new Error('EVENT_SCHEMA_CATALOG_DUPLICATE');
