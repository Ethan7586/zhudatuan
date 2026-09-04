import { array, boolean, literal, maxLength, minLength, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, expectedVersion, id, isoUtc, pageQuery, unsigned, version } from './Primitives';
import { ORDER_AFTERSALE_BODY_SCHEMAS, ORDER_AFTERSALE_OUTPUT_SCHEMAS } from './OrderAfterSaleSchema';
import { importCreated, importInput, importRead } from './ImportSchema';
import { ORDER_AFTERSALE_STATES, ORDER_FULFILLMENT_STATES, ORDER_LIFECYCLE_STATES, ORDER_LIST_VIEWS, ORDER_PAYMENT_STATES, ORDER_PLACED_FILTERS } from '../OrderContract';

const line = strictObject({
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
const address = strictObject({
  recipientMasked: string(),
  mobileMasked: string(),
  addressMasked: string(),
  regionCode: string(),
});
const paymentTender = strictObject({
  sequence: unsigned,
  kind: literal(['wechat', 'benefit', 'voucher']),
  referenceMasked: union([string(), nullSchema()]),
  amountMinor: unsigned,
  state: literal(['planned', 'held', 'captured', 'released']),
});
const paymentDetail = strictObject({
  paymentId: union([string(), nullSchema()]),
  version,
  capturedMinor: unsigned,
  refundedMinor: unsigned,
  refundableMinor: unsigned,
  updatedAt: union([isoUtc, nullSchema()]),
  tenders: array(paymentTender),
});
const fulfillmentMilestone = strictObject({
  id: string(),
  kind: string(),
  state: string(),
  trackingMasked: union([string(), nullSchema()]),
  occurredAt: isoUtc,
});
const fulfillmentDetail = strictObject({
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
const refundTender = strictObject({
  sequence: unsigned,
  kind: literal(['wechat', 'benefit', 'voucher']),
  referenceMasked: union([string(), nullSchema()]),
  amountMinor: unsigned,
  state: literal(['planned', 'processing', 'succeeded', 'failed']),
});
const refundDetail = strictObject({
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
const auditTimeline = strictObject({
  id: string(),
  action: string(),
  resourceType: string(),
  resourceMasked: union([string(), nullSchema()]),
  actorMasked: string(),
  occurredAt: isoUtc,
  traceMasked: string(),
});
const order = strictObject({
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
const detailError = strictObject({ code: string(), message: string(), retryable: boolean(), traceId: string() });
const localError = strictObject({ code: string(), message: string(), retryable: boolean() });
const hidden = strictObject({ state: literal('hidden') });
const unavailable = strictObject({ state: literal('unavailable'), error: detailError });
const localUnavailable = strictObject({ state: literal('unavailable'), error: localError });
const detailSummary = strictObject({
  id: string(), orderNumber: string(), scopeId: string(), mallId: string(), currency, totalMinor: unsigned,
  paymentState: literal(ORDER_PAYMENT_STATES), fulfillmentState: literal(ORDER_FULFILLMENT_STATES), aftersaleState: literal(ORDER_AFTERSALE_STATES), lifecycleState: literal(ORDER_LIFECYCLE_STATES),
  sourceChannel: union([string(), nullSchema()]), externalOrderNo: union([string(), nullSchema()]),
  sourceState: union([string(), nullSchema()]), verificationState: literal(['verified', 'pending', 'rejected']), orderedAt: isoUtc,
  address: union([address, nullSchema()]), receivedAt: union([isoUtc, nullSchema()]), createdAt: isoUtc, updatedAt: isoUtc, version,
});
const productSection = union([strictObject({ state: literal('ready'), data: array(line) }), hidden, unavailable]);
const paymentSection = union([strictObject({ state: literal('ready'), data: paymentDetail }), hidden, unavailable]);
const fulfillmentSection = union([strictObject({ state: literal('ready'), data: array(fulfillmentDetail) }), hidden, unavailable]);
const aftersaleSection = union([strictObject({ state: literal('ready'), data: strictObject({ state: literal(ORDER_AFTERSALE_STATES), refunds: array(refundDetail) }) }), hidden, unavailable]);
const financeDetail = strictObject({
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
const financeSection = union([strictObject({ state: literal('ready'), data: financeDetail }), hidden, unavailable]);
const auditSection = union([strictObject({ state: literal('ready'), data: array(auditTimeline) }), hidden, unavailable]);
const facetSection = union([
  strictObject({
    state: literal('ready'),
    data: strictObject({
      counts: strictObject({ all: unsigned, unpaid: unsigned, unshipped: unsigned, active: unsigned, completed: unsigned, aftersale: unsigned, exception: unsigned }),
      watermarks: strictObject({
        order: union([isoUtc, nullSchema()]), payment: union([isoUtc, nullSchema()]), fulfillment: union([isoUtc, nullSchema()]),
        aftersale: union([isoUtc, nullSchema()]), refund: union([isoUtc, nullSchema()]),
      }),
    }),
  }),
  localUnavailable,
]);
const exportResult = strictObject({
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

export const ORDER_QUERY_SCHEMAS = {
  OrderOrdersReadInput: strictObject({
    ...pageQuery,
    search: optional(string()),
    view: optional(literal(ORDER_LIST_VIEWS)),
    placed: optional(literal(ORDER_PLACED_FILTERS)),
    from: optional(isoUtc),
    to: optional(isoUtc),
    lifecycle: optional(literal(ORDER_LIFECYCLE_STATES)),
    payment: optional(literal(ORDER_PAYMENT_STATES)),
    fulfillment: optional(literal(ORDER_FULFILLMENT_STATES)),
    mall: optional(string()),
    channel: optional(string()),
    product: optional(string()),
    member: optional(string()),
    minimumMinor: optional(unsigned),
    maximumMinor: optional(unsigned),
  }),
  OrderDetailReadInput: strictObject({}),
  OrderImportsReadInput: strictObject({}),
  OrderAftersalesReadInput: strictObject({
    ...pageQuery,
    order: optional(string()),
    search: optional(string()),
    placed: optional(literal(ORDER_PLACED_FILTERS)),
    from: optional(isoUtc),
    to: optional(isoUtc),
    lifecycle: optional(literal(ORDER_LIFECYCLE_STATES)),
    payment: optional(literal(ORDER_PAYMENT_STATES)),
    fulfillment: optional(literal(ORDER_FULFILLMENT_STATES)),
    mall: optional(string()),
    channel: optional(string()),
    product: optional(string()),
    member: optional(string()),
    minimumMinor: optional(unsigned),
    maximumMinor: optional(unsigned),
  }),
} as const;

export const ORDER_BODY_SCHEMAS = {
  OrderOrdersCreateInput: strictObject({ quoteId: string(), confirmationToken: string().check(minLength(43), maxLength(171)), paymentScene: literal(['miniapp', 'jsapi']) }),
  OrderOrdersCancelInput: strictObject({ expectedVersion, reason: string().check(minLength(2), maxLength(1000)) }),
  OrderRemindersCreateInput: strictObject({}),
  OrderOrdersExportInput: strictObject({
    search: optional(string()), placed: optional(literal(ORDER_PLACED_FILTERS)), from: optional(isoUtc), to: optional(isoUtc),
    lifecycle: optional(literal(ORDER_LIFECYCLE_STATES)), payment: optional(literal(ORDER_PAYMENT_STATES)),
    fulfillment: optional(literal(ORDER_FULFILLMENT_STATES)), mall: optional(string()), channel: optional(string()),
    product: optional(string()), member: optional(string()), minimumMinor: optional(unsigned), maximumMinor: optional(unsigned),
  }),
  OrderImportsCreateInput: importInput,
  ...ORDER_AFTERSALE_BODY_SCHEMAS,
  OrderOrdersReceiveInput: strictObject({ expectedVersion, receivedAt: optional(isoUtc), reason: optional(string()) }),
} as const;

export const ORDER_OUTPUT_SCHEMAS = {
  OrderOrdersCreateOutput: strictObject({
    order: strictObject({
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
      evidence: ContractJsonValueSchema,
      address_snapshot: union([ContractJsonValueSchema, nullSchema()]),
      invoice_snapshot: union([ContractJsonValueSchema, nullSchema()]),
      delivery_snapshot: ContractJsonValueSchema,
      experience_version: union([string(), nullSchema()]),
      created_at: isoUtc,
      updated_at: isoUtc,
      version,
    }),
    payment: union([
      strictObject({ paymentId: string(), state: literal('captured') }),
      strictObject({ paymentId: string(), state: literal('pending'), action: record(string(), string()), expiresAt: isoUtc }),
      strictObject({ paymentId: string(), state: literal('recovery'), retryAfter: unsigned }),
    ]),
  }),
  OrderOrdersCancelOutput: strictObject({
    orderId: id<'order'>(),
    lifecycleState: literal('cancelled'),
    fulfillmentState: literal('cancelled'),
    cancelledAt: isoUtc,
    version,
    eventId: id<'event'>(),
    repeated: boolean(),
  }),
  OrderOrdersReadOutput: strictObject({ items: array(order), count: unsigned, nextCursor: optional(string()), facets: facetSection }),
  OrderDetailReadOutput: strictObject({ summary: detailSummary, products: productSection, payment: paymentSection, fulfillment: fulfillmentSection, aftersale: aftersaleSection, finance: financeSection, audit: auditSection }),
  OrderRemindersCreateOutput: strictObject({ id: string(), order_id: string(), member_id: string(), kind: literal('fulfillment'), state: literal('queued'), created_at: isoUtc }),
  OrderOrdersExportOutput: exportResult,
  OrderImportsCreateOutput: importCreated,
  OrderImportsReadOutput: importRead,
  ...ORDER_AFTERSALE_OUTPUT_SCHEMAS,
  OrderOrdersReceiveOutput: strictObject({
    orderId: id<'order'>(),
    fulfillmentState: literal('received'),
    receivedAt: isoUtc,
    version,
    eventId: id<'event'>(),
    repeated: literal([true, false]),
  }),
} as const;
