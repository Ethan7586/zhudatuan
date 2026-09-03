import { storefrontClientEnvironment } from '@shop/config/client';
import type { CommerceClient } from '@shop/sdk';
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
import { requestContext, type RequestOptions, type StorefrontSession } from './Session';
import { currentStorefrontHandle } from '../../route/EntryPath';

type StorefrontCommerce = Pick<CommerceClient, 'benefit' | 'cart' | 'checkout' | 'finance' | 'fulfillment' | 'identity' | 'member' | 'notification' | 'order' | 'payment' | 'referral' | 'storefront' | 'support' | 'voucher'>;

export class StorefrontClient {
  readonly commerce: StorefrontCommerce;
  readonly clientVersion: string;

  constructor(environment = storefrontClientEnvironment()) {
    const origin = environment.apiOrigin;
    this.commerce = Object.freeze({
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
    this.clientVersion = environment.clientVersion;
  }

  context(session: StorefrontSession | null, options: RequestOptions = {}) {
    return requestContext(this.clientVersion, currentStorefrontHandle(), session, options);
  }
}

export const storefrontClient = new StorefrontClient();
