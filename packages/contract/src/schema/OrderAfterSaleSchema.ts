import { array, boolean, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, isoUtc, unsigned, version } from './Primitives';
import { ORDER_AFTERSALE_ATTACHMENT_TYPES, ORDER_AFTERSALE_REASONS, ORDER_AFTERSALE_STATES } from '../Vocabulary';

const state = literal(ORDER_AFTERSALE_STATES);
const unavailable = union([string(), nullSchema()]);
const line = strictObject({
  lineId: string(),
  skuId: string(),
  listingId: string(),
  title: string(),
  productType: string(),
  provider: union([string(), nullSchema()]),
  purchasedQuantity: unsigned,
  fulfilledQuantity: unsigned,
  claimedQuantity: unsigned,
  requestedQuantity: unsigned,
  maximumQuantity: unsigned,
  unitMinor: unsigned,
  refundMinor: unsigned,
  available: boolean(),
  unavailableReason: unavailable,
});
const attachment = strictObject({ objectId: string(), name: string(), mediaType: string(), sizeBytes: unsigned, contentHash: string() });
const timeline = strictObject({
  sequence: unsigned,
  kind: string(),
  previousState: union([state, nullSchema()]),
  state,
  evidence: ContractJsonValueSchema,
  occurredAt: isoUtc,
});
const aftersale = strictObject({
  id: string(),
  orderId: string(),
  orderNumber: string(),
  state,
  reasonCode: string(),
  description: string(),
  currency,
  expectedRefundMinor: unsigned,
  expectedRefund: strictObject({ totalMinor: unsigned, currency, tenders: array(strictObject({ kind: string(), reference: union([string(), nullSchema()]), amountMinor: unsigned })) }),
  requiresReturn: boolean(),
  unavailableReason: unavailable,
  requestedBy: union([string(), nullSchema()]),
  createdAt: isoUtc,
  updatedAt: isoUtc,
  version,
  lines: array(line),
  attachments: array(attachment),
  timeline: array(timeline),
});
const availableLine = strictObject({
  lineId: string(),
  skuId: string(),
  listingId: string(),
  title: string(),
  productType: string(),
  provider: union([string(), nullSchema()]),
  purchasedQuantity: unsigned,
  fulfilledQuantity: unsigned,
  claimedQuantity: unsigned,
  maximumQuantity: unsigned,
  expectedRefundMinor: unsigned,
  available: boolean(),
  unavailableReason: unavailable,
  deadline: union([isoUtc, nullSchema()]),
  requiresReturn: boolean(),
});

export const ORDER_AFTERSALE_BODY_SCHEMAS = {
  OrderAftersaleattachmentsCreateInput: strictObject({
    name: string(),
    contentType: literal(ORDER_AFTERSALE_ATTACHMENT_TYPES),
    sizeBytes: unsigned,
    sha256: string(),
  }),
  OrderAftersalesApplyInput: strictObject({
    lines: array(strictObject({ lineId: string(), quantity: unsigned })),
    reason: literal(ORDER_AFTERSALE_REASONS),
    description: string(),
    attachments: optional(array(strictObject({ objectId: string(), name: string(), contentType: literal(ORDER_AFTERSALE_ATTACHMENT_TYPES), sizeBytes: unsigned, sha256: string() }))),
  }),
  OrderAftersalesApproveInput: strictObject({ reason: string(), evidence: optional(ContractJsonValueSchema) }),
  OrderAftersalesRejectInput: strictObject({ reason: string(), evidence: optional(ContractJsonValueSchema) }),
} as const;

export const ORDER_AFTERSALE_OUTPUT_SCHEMAS = {
  OrderAftersalesReadOutput: strictObject({ items: array(aftersale), count: unsigned, nextCursor: optional(string()), availableLines: array(availableLine) }),
  OrderAftersaleattachmentsCreateOutput: strictObject({
    objectId: string(),
    upload: strictObject({ url: string(), method: literal('PUT'), headers: record(string(), string()), expiresAt: isoUtc }),
  }),
  OrderAftersalesApplyOutput: strictObject({ id: string(), orderId: string(), state: literal('reviewing'), expectedRefundMinor: unsigned, currency, requiresReturn: boolean(), createdAt: isoUtc, updatedAt: isoUtc, version }),
  OrderAftersalesApproveOutput: strictObject({ id: string(), orderId: string(), state: literal(['approved', 'refunding']), version, updatedAt: isoUtc }),
  OrderAftersalesRejectOutput: strictObject({ id: string(), orderId: string(), state: literal('rejected'), version, updatedAt: isoUtc }),
} as const;
