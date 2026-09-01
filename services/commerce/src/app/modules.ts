import type { CommerceModule } from '../bootstrap/ModuleRegistry';
import { RuntimeModule } from '../modules/runtime/Module';
import { ObservabilityModule } from '../modules/observability/Module';
import { AccessModule } from '../modules/access/Module';
import { AuditModule } from '../modules/audit/Module';
import { BenefitModule } from '../modules/benefit/Module';
import { CapabilityModule } from '../modules/capability/Module';
import { CartModule } from '../modules/cart/Module';
import { CatalogModule } from '../modules/catalog/Module';
import { ChannelModule } from '../modules/channel/Module';
import { CheckoutModule } from '../modules/checkout/Module';
import { ExperienceModule } from '../modules/experience/Module';
import { ExtensionModule } from '../modules/extension/Module';
import { FinanceModule } from '../modules/finance/Module';
import { FulfillmentModule } from '../modules/fulfillment/Module';
import { IdentityModule } from '../modules/identity/Module';
import { InventoryModule } from '../modules/inventory/Module';
import { MarketingModule } from '../modules/marketing/Module';
import { MemberModule } from '../modules/member/Module';
import { NotificationModule } from '../modules/notification/Module';
import { OrderModule } from '../modules/order/Module';
import { OrganizationModule } from '../modules/organization/Module';
import { PartnerModule } from '../modules/partner/Module';
import { PaymentModule } from '../modules/payment/Module';
import { PricingModule } from '../modules/pricing/Module';
import { QualificationModule } from '../modules/qualification/Module';
import { ReportingModule } from '../modules/reporting/Module';
import { ReferralModule } from '../modules/referral/Module';
import { RiskModule } from '../modules/risk/Module';
import { SupportModule } from '../modules/support/Module';
import { VerificationModule } from '../modules/verification/Module';
import { VoucherModule } from '../modules/voucher/Module';
import { NavigationModule } from '../modules/navigation/Module';

export const BUSINESS_MODULES: readonly CommerceModule[] = Object.freeze([
  IdentityModule,
  OrganizationModule,
  AccessModule,
  CapabilityModule,
  PartnerModule,
  MemberModule,
  QualificationModule,
  CatalogModule,
  PricingModule,
  InventoryModule,
  ExperienceModule,
  MarketingModule,
  CartModule,
  CheckoutModule,
  OrderModule,
  FulfillmentModule,
  VerificationModule,
  PaymentModule,
  VoucherModule,
  BenefitModule,
  FinanceModule,
  ChannelModule,
  SupportModule,
  NotificationModule,
  ReportingModule,
  ReferralModule,
  RiskModule,
  AuditModule,
  ExtensionModule,
]);

export const SUPPORT_MODULES: readonly CommerceModule[] = Object.freeze([NavigationModule]);
export const COMMERCE_MODULES: readonly CommerceModule[] = Object.freeze([RuntimeModule, ObservabilityModule, ...SUPPORT_MODULES, ...BUSINESS_MODULES]);

if (BUSINESS_MODULES.length !== 29 || new Set(BUSINESS_MODULES.map(({ id }) => id)).size !== 29) throw new Error('BUSINESS_MODULE_CATALOG_INVALID');
if (SUPPORT_MODULES.length !== 1 || new Set(SUPPORT_MODULES.map(({ id }) => id)).size !== 1) throw new Error('SUPPORT_MODULE_CATALOG_INVALID');
