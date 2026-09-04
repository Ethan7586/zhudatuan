import { array, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, expectedVersion, id, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';
import { ORDER_AFTERSALE_BODY_SCHEMAS, ORDER_AFTERSALE_OUTPUT_SCHEMAS } from './OrderAfterSaleSchema';
import { ORDER_FULFILLMENT_STATES, ORDER_LIFECYCLE_STATES, ORDER_LIST_VIEWS, ORDER_PAYMENT_STATES, ORDER_PLACED_FILTERS } from '../OrderContract';

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
  state: literal(['pending', 'submitted', 'accepted', 'processing', 'ready', 'completed', 'cancelled', 'failed']),
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
  payment_state: string(),
  fulfillment_state: string(),
  aftersale_state: string(),
  lifecycle_state: string(),
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
const exportResult = strictObject({
  id: string(),
  scope: string(),
  report: literal('orders'),
  filter: ContractJsonValueSchema,
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
    order: optional(string()),
    view: optional(literal(ORDER_LIST_VIEWS)),
    placed: optional(literal(ORDER_PLACED_FILTERS)),
    lifecycle: optional(literal(ORDER_LIFECYCLE_STATES)),
    payment: optional(literal(ORDER_PAYMENT_STATES)),
    fulfillment: optional(literal(ORDER_FULFILLMENT_STATES)),
    mall: optional(string()),
  }),
  OrderAftersalesReadInput: strictObject({
    ...pageQuery,
    order: optional(string()),
    placed: optional(literal(ORDER_PLACED_FILTERS)),
    lifecycle: optional(literal(ORDER_LIFECYCLE_STATES)),
    payment: optional(literal(ORDER_PAYMENT_STATES)),
    fulfillment: optional(literal(ORDER_FULFILLMENT_STATES)),
    mall: optional(string()),
  }),
} as const;

export const ORDER_BODY_SCHEMAS = {
  OrderOrdersCreateInput: strictObject({ quoteId: string(), paymentScene: literal(['miniapp', 'jsapi']) }),
  OrderRemindersCreateInput: strictObject({}),
  OrderOrdersExportInput: strictObject({ order: optional(string()), placed: optional(string()), lifecycle: optional(string()), payment: optional(string()), fulfillment: optional(string()), mall: optional(string()) }),
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
      payment_state: string(),
      fulfillment_state: string(),
      aftersale_state: string(),
      lifecycle_state: string(),
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
  OrderOrdersReadOutput: pageOutput(order),
  OrderRemindersCreateOutput: strictObject({ id: string(), order_id: string(), member_id: string(), kind: literal('fulfillment'), state: literal('queued'), created_at: isoUtc }),
  OrderOrdersExportOutput: exportResult,
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
