import { array, boolean, literal, maxLength, minLength, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, expectedVersion, id, isoUtc, pageQuery, unsigned, version } from './Primitives';
import { ORDER_AFTERSALE_BODY_SCHEMAS, ORDER_AFTERSALE_OUTPUT_SCHEMAS } from './OrderAfterSaleSchema';
import { importCreated, importInput, importRead } from './ImportSchema';
import { ORDER_AFTERSALE_STATES, ORDER_FULFILLMENT_STATES, ORDER_LIFECYCLE_STATES, ORDER_LIST_VIEWS, ORDER_PAYMENT_STATES, ORDER_PLACED_FILTERS } from '../OrderContract';

import { aftersaleSection, auditSection, detailSummary, exportResult, facetSection, financeSection, fulfillmentSection, order, paymentSection, productSection } from './OrderSchemaModel';

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
