import type { OperationExecutor } from './OperationDescriptor';
import type { MiniappSurfaceClient } from './SurfaceCatalog';
import { createIdentityOperations } from './operations/identity';
import { createMemberOperations } from './operations/member';
import { createPricingOperations } from './operations/pricing';
import { createInventoryOperations } from './operations/inventory';
import { createExperienceOperations } from './operations/experience';
import { createCartOperations } from './operations/cart';
import { createCheckoutOperations } from './operations/checkout';
import { createOrderOperations } from './operations/order';
import { createFulfillmentOperations } from './operations/fulfillment';
import { createPaymentOperations } from './operations/payment';
import { createVerificationOperations } from './operations/verification';
import { createVoucherOperations } from './operations/voucher';
import { createBenefitOperations } from './operations/benefit';
import { createFinanceOperations } from './operations/finance';
import { createInvoiceOperations } from './operations/invoice';
import { createSupportOperations } from './operations/support';
import { createNotificationOperations } from './operations/notification';
import { createObservabilityOperations } from './operations/observability';
import { createReferralOperations } from './operations/referral';
import { createStorefrontOperations } from './operations/storefront';

export function createMiniappClient(executor: OperationExecutor): MiniappSurfaceClient {
  return Object.freeze({
    identity: createIdentityOperations(executor),
    member: createMemberOperations(executor),
    pricing: createPricingOperations(executor),
    inventory: createInventoryOperations(executor),
    experience: createExperienceOperations(executor),
    cart: createCartOperations(executor),
    checkout: createCheckoutOperations(executor),
    order: createOrderOperations(executor),
    fulfillment: createFulfillmentOperations(executor),
    payment: createPaymentOperations(executor),
    verification: createVerificationOperations(executor),
    voucher: createVoucherOperations(executor),
    benefit: createBenefitOperations(executor),
    finance: createFinanceOperations(executor),
    invoice: createInvoiceOperations(executor),
    support: createSupportOperations(executor),
    notification: createNotificationOperations(executor),
    observability: createObservabilityOperations(executor),
    referral: createReferralOperations(executor),
    storefront: createStorefrontOperations(executor),
  });
}
