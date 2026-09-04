export const CHECKOUT_CAPABILITIES = Object.freeze({
  read: 'checkout.read',
  manage: 'checkout.manage',
} as const);

export type CheckoutCapability = typeof CHECKOUT_CAPABILITIES[keyof typeof CHECKOUT_CAPABILITIES];
