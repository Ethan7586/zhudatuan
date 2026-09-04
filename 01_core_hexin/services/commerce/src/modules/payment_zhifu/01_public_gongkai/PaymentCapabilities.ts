export const PAYMENT_CAPABILITIES = Object.freeze({
  read: 'payment.read',
  manage: 'payment.manage',
} as const);

export type PaymentCapability = typeof PAYMENT_CAPABILITIES[keyof typeof PAYMENT_CAPABILITIES];
