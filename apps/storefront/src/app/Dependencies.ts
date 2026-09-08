import type { StorefrontHandle } from '@shop/contract';
import { storefrontClientEnvironment } from '@shop/config/client';
import { createFetchBenefit } from '@shop/sdk/benefit';
import { createFetchCart } from '@shop/sdk/cart';
import { createFetchCheckout } from '@shop/sdk/checkout';
import { createFetchFinance } from '@shop/sdk/finance';
import { createFetchFulfillment } from '@shop/sdk/fulfillment';
import { createFetchIdentity } from '@shop/sdk/identity';
import { createFetchMember } from '@shop/sdk/member';
import { createFetchNotification } from '@shop/sdk/notification';
import { createFetchOrder } from '@shop/sdk/order';
import { createFetchPayment } from '@shop/sdk/payment';
import { createFetchReferral } from '@shop/sdk/referral';
import { createFetchStorefront } from '@shop/sdk/storefront';
import { createFetchSupport } from '@shop/sdk/support';
import { createFetchVoucher } from '@shop/sdk/voucher';
import { createStorefrontContext } from '../shared/api/RequestContext';
import { BrowserShareAdapter } from '../shared/platform/BrowserShareAdapter';
import type { SharePort } from '../shared/platform/SharePort';
import { SessionGateway } from '../entity/session';
import { AccountGateway } from '../feature/account/infrastructure/AccountGateway';
import { AfterSaleGateway } from '../feature/aftersale/infrastructure/AfterSaleGateway';
import { BenefitGateway } from '../feature/benefit/infrastructure/BenefitGateway';
import { CartGateway } from '../feature/cart/infrastructure/CartGateway';
import { CartTokenStore } from '../feature/cart/infrastructure/CartTokenStore';
import { CatalogGateway } from '../feature/catalog/infrastructure/CatalogGateway';
import { CheckoutGateway } from '../feature/checkout/infrastructure/CheckoutGateway';
import { HomeGateway } from '../feature/home/infrastructure/HomeGateway';
import { NotificationGateway } from '../feature/notification/infrastructure/NotificationGateway';
import { InvoiceGateway } from '../feature/order/infrastructure/InvoiceGateway';
import { OrderGateway } from '../feature/order/infrastructure/OrderGateway';
import { PaymentGateway } from '../feature/payment/infrastructure/PaymentGateway';
import { ProductGateway } from '../feature/product/infrastructure/ProductGateway';
import { ReferralGateway } from '../feature/referral/infrastructure/ReferralGateway';
import { SecurityGateway } from '../feature/security/infrastructure/SecurityGateway';
import { StepupGateway } from '../feature/security/infrastructure/StepupGateway';
import { SupportGateway } from '../feature/support/infrastructure/SupportGateway';
import { VoucherGateway } from '../feature/voucher/infrastructure/VoucherGateway';

export interface Dependencies {
  readonly session: SessionGateway;
  readonly account: AccountGateway;
  readonly aftersale: AfterSaleGateway;
  readonly benefit: BenefitGateway;
  readonly cart: CartGateway;
  readonly catalog: CatalogGateway;
  readonly checkout: CheckoutGateway;
  readonly home: HomeGateway;
  readonly notification: NotificationGateway;
  readonly invoice: InvoiceGateway;
  readonly order: OrderGateway;
  readonly payment: PaymentGateway;
  readonly product: ProductGateway;
  readonly referral: ReferralGateway;
  readonly share: SharePort;
  readonly security: SecurityGateway;
  readonly stepup: StepupGateway;
  readonly support: SupportGateway;
  readonly voucher: VoucherGateway;
}

export function createDependencies(handle: StorefrontHandle): Dependencies {
  const environment = storefrontClientEnvironment();
  const origin = environment.apiOrigin;
  const context = createStorefrontContext(environment.clientVersion, handle);
  const api = Object.freeze({
    benefit: createFetchBenefit(origin),
    cart: createFetchCart(origin),
    checkout: createFetchCheckout(origin),
    finance: createFetchFinance(origin),
    fulfillment: createFetchFulfillment(origin),
    identity: createFetchIdentity(origin),
    member: createFetchMember(origin),
    notification: createFetchNotification(origin),
    order: createFetchOrder(origin),
    payment: createFetchPayment(origin),
    referral: createFetchReferral(origin),
    storefront: createFetchStorefront(origin),
    support: createFetchSupport(origin),
    voucher: createFetchVoucher(origin),
  });
  return Object.freeze({
    session: new SessionGateway(api.identity, context),
    account: new AccountGateway(api.member, api.identity, context),
    aftersale: new AfterSaleGateway(api.order, context),
    benefit: new BenefitGateway(api.benefit, context),
    cart: new CartGateway(api.cart, context, new CartTokenStore(window.localStorage, `cart:${handle}`)),
    catalog: new CatalogGateway(api.storefront, context),
    checkout: new CheckoutGateway(api.checkout, api.order, context),
    home: new HomeGateway(api.storefront, context),
    notification: new NotificationGateway(api.notification, context),
    invoice: new InvoiceGateway(api.finance, context),
    order: new OrderGateway(api.order, api.fulfillment, context),
    payment: new PaymentGateway(api.payment, context),
    product: new ProductGateway(api.storefront, context),
    referral: new ReferralGateway(api.referral, context),
    share: new BrowserShareAdapter(window.navigator),
    security: new SecurityGateway(api.identity, context),
    stepup: new StepupGateway(api.identity, context),
    support: new SupportGateway(api.support, context),
    voucher: new VoucherGateway(api.voucher, context),
  });
}
