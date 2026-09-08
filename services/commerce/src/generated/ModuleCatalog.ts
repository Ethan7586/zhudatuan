// Generated from config/modules.yml. Do not edit.
import { RuntimeModule } from '../modules/runtime/Module';
import { ObservabilityModule } from '../modules/observability/Module';
import { NavigationModule } from '../modules/navigation/Module';
import { IdentityModule } from '../modules/identity/Module';
import { OrganizationModule } from '../modules/organization/Module';
import { AccessModule } from '../modules/access/Module';
import { ApprovalModule } from '../modules/approval/Module';
import { CapabilityModule } from '../modules/capability/Module';
import { PartnerModule } from '../modules/partner/Module';
import { MemberModule } from '../modules/member/Module';
import { QualificationModule } from '../modules/qualification/Module';
import { CatalogModule } from '../modules/catalog/Module';
import { PricingModule } from '../modules/pricing/Module';
import { InventoryModule } from '../modules/inventory/Module';
import { ExperienceModule } from '../modules/experience/Module';
import { MarketingModule } from '../modules/marketing/Module';
import { CartModule } from '../modules/cart/Module';
import { CheckoutModule } from '../modules/checkout/Module';
import { OrderModule } from '../modules/order/Module';
import { FulfillmentModule } from '../modules/fulfillment/Module';
import { VerificationModule } from '../modules/verification/Module';
import { PaymentModule } from '../modules/payment/Module';
import { VoucherModule } from '../modules/voucher/Module';
import { BenefitModule } from '../modules/benefit/Module';
import { FinanceModule } from '../modules/finance/Module';
import { ChannelModule } from '../modules/channel/Module';
import { SupportModule } from '../modules/support/Module';
import { NotificationModule } from '../modules/notification/Module';
import { ReportingModule } from '../modules/reporting/Module';
import { ReferralModule } from '../modules/referral/Module';
import { RiskModule } from '../modules/risk/Module';
import { AuditModule } from '../modules/audit/Module';
import { ExtensionModule } from '../modules/extension/Module';
import type { CommerceModule } from '../composition/ModuleRegistry';

export const FOUNDATION_MODULES: readonly CommerceModule[] = Object.freeze([
  RuntimeModule,
  ObservabilityModule,
]);
export const SUPPORT_MODULES: readonly CommerceModule[] = Object.freeze([
  NavigationModule,
]);
export const BUSINESS_MODULES: readonly CommerceModule[] = Object.freeze([
  IdentityModule,
  OrganizationModule,
  AccessModule,
  ApprovalModule,
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
export const COMMERCE_MODULES: readonly CommerceModule[] = Object.freeze([...FOUNDATION_MODULES, ...SUPPORT_MODULES, ...BUSINESS_MODULES]);
if (COMMERCE_MODULES.length !== 33 || new Set(COMMERCE_MODULES.map(({ id }) => id)).size !== 33) throw new Error('MODULE_CATALOG_INVALID');
