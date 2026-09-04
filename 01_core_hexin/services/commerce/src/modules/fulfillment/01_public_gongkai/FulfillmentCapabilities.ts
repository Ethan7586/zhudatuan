export const FULFILLMENT_CAPABILITIES = Object.freeze({
  read: 'fulfillment.read',
  manage: 'fulfillment.manage',
});

export type FulfillmentCapability = (typeof FULFILLMENT_CAPABILITIES)[keyof typeof FULFILLMENT_CAPABILITIES];
