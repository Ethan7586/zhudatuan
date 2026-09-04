export const CART_CAPABILITIES = Object.freeze({
  read: 'cart.read',
  manage: 'cart.manage',
});

export type CartCapability = (typeof CART_CAPABILITIES)[keyof typeof CART_CAPABILITIES];
