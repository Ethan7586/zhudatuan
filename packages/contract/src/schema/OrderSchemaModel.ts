import { array, boolean, literal, null as nullSchema, strictObject, string, union } from 'zod/mini';
import { ORDER_AFTERSALE_STATES, ORDER_FULFILLMENT_STATES, ORDER_LIFECYCLE_STATES, ORDER_PAYMENT_STATES } from '../OrderContract';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, isoUtc, unsigned, version } from './Primitives';

export const line = strictObject({
  id: string(),
  sku: string(),
  listing: string(),
  title: string(),
  quantity: unsigned,
  unitMinor: unsigned,
  totalMinor: unsigned,
  discountMinor: unsigned,
  payableMinor: unsigned,
  productType: string(),
  category: string(),
  provider: union([string(), nullSchema()]),
  partner: union([string(), nullSchema()]),
});
export const address = strictObject({
  recipientMasked: string(),
  mobileMasked: string(),
  addressMasked: string(),
  regionCode: string(),
});
export const paymentTender = strictObject({
  sequence: unsigned,
  kind: literal(['wechat', 'benefit', 'voucher']),
  referenceMasked: union([string(), nullSchema()]),
  amountMinor: unsigned,
  state: literal(['planned', 'held', 'captured', 'released']),
});
export const paymentDetail = strictObject({
  paymentId: union([string(), nullSchema()]),
  version,
  capturedMinor: unsigned,
  refundedMinor: unsigned,
  refundableMinor: unsigned,
  updatedAt: union([isoUtc, nullSchema()]),
  tenders: array(paymentTender),
});
export const fulfillmentMilestone = strictObject({
  id: string(),
  kind: string(),
  state: string(),
  trackingMasked: union([string(), nullSchema()]),
  occurredAt: isoUtc,
});
export const fulfillmentDetail = strictObject({
  id: string(),
  provider: union([string(), nullSchema()]),
  partner: union([string(), nullSchema()]),
  kind: literal(['shipment', 'delivery', 'pickup', 'service', 'digital']),
  state: literal(['pending', 'submitted', 'accepted', 'processing', 'ready', 'completed', 'cancelled', 'failed', 'needsaction']),
  version,
  externalReferenceMasked: union([string(), nullSchema()]),
  createdAt: isoUtc,
  updatedAt: isoUtc,
  milestones: array(fulfillmentMilestone),
});
export const refundTender = strictObject({
  sequence: unsigned,
  kind: literal(['wechat', 'benefit', 'voucher']),
  referenceMasked: union([string(), nullSchema()]),
  amountMinor: unsigned,
  state: literal(['planned', 'processing', 'succeeded', 'failed']),
});
export const refundDetail = strictObject({
  id: string(),
  aftersaleId: union([string(), nullSchema()]),
  provider: string(),
  providerReferenceMasked: string(),
  amountMinor: unsigned,
  currency,
  state: literal(['requested', 'submitted', 'processing', 'succeeded', 'failed', 'cancelled']),
  reason: string(),
  createdAt: isoUtc,
  updatedAt: isoUtc,
  tenders: array(refundTender),
});
export const auditTimeline = strictObject({
  id: string(),
  action: string(),
  resourceType: string(),
  resourceMasked: union([string(), nullSchema()]),
  actorMasked: string(),
  occurredAt: isoUtc,
  traceMasked: string(),
});
export const order = strictObject({
  id: string(),
  order_number: string(),
  scope_id: string(),
  member_id: string(),
  mall_id: string(),
  checkout_id: string(),
  currency,
  total_minor: unsigned,
  payment_state: literal(ORDER_PAYMENT_STATES),
  fulfillment_state: literal(ORDER_FULFILLMENT_STATES),
  aftersale_state: literal(ORDER_AFTERSALE_STATES),
  lifecycle_state: literal(ORDER_LIFECYCLE_STATES),
  address: union([address, nullSchema()]),
  payment: paymentDetail,
  fulfillments: array(fulfillmentDetail),
  refunds: array(refundDetail),
  timeline: array(auditTimeline),
  receivedAt: union([isoUtc, nullSchema()]),
  created_at: isoUtc,
  updated_at: isoUtc,
  version,
  lines: array(line),
});
export const detailError = strictObject({ code: string(), message: string(), retryable: boolean(), traceId: string() });
export const localError = strictObject({ code: string(), message: string(), retryable: boolean() });
export const hidden = strictObject({ state: literal('hidden') });
export const unavailable = strictObject({ state: literal('unavailable'), error: detailError });
export const localUnavailable = strictObject({ state: literal('unavailable'), error: localError });
export const detailSummary = strictObject({
  id: string(),
  orderNumber: string(),
  scopeId: string(),
  mallId: string(),
  currency,
  totalMinor: unsigned,
  paymentState: literal(ORDER_PAYMENT_STATES),
  fulfillmentState: literal(ORDER_FULFILLMENT_STATES),
  aftersaleState: literal(ORDER_AFTERSALE_STATES),
  lifecycleState: literal(ORDER_LIFECYCLE_STATES),
  sourceChannel: union([string(), nullSchema()]),
  externalOrderNo: union([string(), nullSchema()]),
  sourceState: union([string(), nullSchema()]),
  verificationState: literal(['verified', 'pending', 'rejected']),
  orderedAt: isoUtc,
  address: union([address, nullSchema()]),
  receivedAt: union([isoUtc, nullSchema()]),
  createdAt: isoUtc,
  updatedAt: isoUtc,
  version,
});
export const productSection = union([strictObject({ state: literal('ready'), data: array(line) }), hidden, unavailable]);
export const paymentSection = union([strictObject({ state: literal('ready'), data: paymentDetail }), hidden, unavailable]);
export const fulfillmentSection = union([strictObject({ state: literal('ready'), data: array(fulfillmentDetail) }), hidden, unavailable]);
export const aftersaleSection = union([strictObject({ state: literal('ready'), data: strictObject({ state: literal(ORDER_AFTERSALE_STATES), refunds: array(refundDetail) }) }), hidden, unavailable]);
export const financeDetail = strictObject({
  grossMinor: unsigned,
  capturedMinor: unsigned,
  refundedMinor: unsigned,
  netMinor: unsigned,
  outstandingMinor: unsigned,
  currency,
  state: literal(['pending', 'balanced', 'partialrefund', 'refunded', 'attention']),
  verificationState: literal(['verified', 'pending', 'rejected']),
  watermark: isoUtc,
});
export const financeSection = union([strictObject({ state: literal('ready'), data: financeDetail }), hidden, unavailable]);
export const auditSection = union([strictObject({ state: literal('ready'), data: array(auditTimeline) }), hidden, unavailable]);
export const facetSection = union([
  strictObject({
    state: literal('ready'),
    data: strictObject({
      counts: strictObject({ all: unsigned, unpaid: unsigned, unshipped: unsigned, active: unsigned, completed: unsigned, aftersale: unsigned, exception: unsigned }),
      watermarks: strictObject({
        order: union([isoUtc, nullSchema()]),
        payment: union([isoUtc, nullSchema()]),
        fulfillment: union([isoUtc, nullSchema()]),
        aftersale: union([isoUtc, nullSchema()]),
        refund: union([isoUtc, nullSchema()]),
      }),
    }),
  }),
  localUnavailable,
]);
export const exportResult = strictObject({
  id: string(),
  scope: string(),
  report: literal('orders'),
  filter: ContractJsonValueSchema,
  watermark: isoUtc,
  state: literal('queued'),
  cursor: nullSchema(),
  recordCount: literal(0),
  objectReference: nullSchema(),
  objectHash: nullSchema(),
  objectSize: nullSchema(),
  scanState: nullSchema(),
  expiresAt: nullSchema(),
  createdAt: isoUtc,
  generatedAt: nullSchema(),
});
