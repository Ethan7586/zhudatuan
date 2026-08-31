import { array, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableTime = union([isoUtc, nullSchema()]);
const fulfillment = strictObject({
  id: string(),
  order_id: string(),
  suborder_id: string(),
  provider: nullableText,
  partner_id: nullableText,
  store_id: nullableText,
  kind: literal(['shipment', 'delivery', 'pickup', 'service', 'digital']),
  state: literal(['pending', 'submitted', 'accepted', 'processing', 'ready', 'completed', 'cancelled', 'failed']),
  external_reference: nullableText,
  payment_id: nullableText,
  source_effect_id: nullableText,
  amount_minor: union([unsigned, nullSchema()]),
  idempotency_key: nullableText,
  created_at: nullableTime,
  updated_at: nullableTime,
  version,
});
const returned = strictObject({
  id: string(),
  aftersale_id: string(),
  fulfillment_id: string(),
  scope_id: string(),
  state: literal(['authorized', 'intransit', 'received', 'accepted', 'rejected']),
  provider: nullableText,
  provider_reference: nullableText,
  instruction: ContractJsonValueSchema,
  tracking_number: nullableText,
  created_at: isoUtc,
  updated_at: isoUtc,
  version,
});
const milestone = strictObject({ id: string(), kind: string(), state: string(), tracking: nullableText, evidence: ContractJsonValueSchema, occurredAt: isoUtc });

export const FULFILLMENT_BODY_SCHEMAS = {
  FulfillmentShipmentsCreateInput: strictObject({ tracking: string(), carrier: optional(string()) }),
  FulfillmentReturnsReceiveInput: strictObject({ tracking: optional(string()) }),
  FulfillmentReturnsInspectInput: strictObject({ accepted: literal([true, false]), inspection: optional(ContractJsonValueSchema) }),
} as const;

export const FULFILLMENT_QUERY_SCHEMAS = {
  FulfillmentTrackingReadInput: strictObject({ order: string() }),
} as const;

export const FULFILLMENT_OUTPUT_SCHEMAS = {
  FulfillmentShipmentsCreateOutput: strictObject({ ...fulfillment.shape, tracking: string() }),
  FulfillmentTrackingReadOutput: strictObject({ items: array(strictObject({ id: string(), order_id: string(), state: string(), external_reference: nullableText, milestones: array(milestone) })), count: unsigned }),
  FulfillmentReturnsReceiveOutput: returned,
  FulfillmentReturnsInspectOutput: returned,
} as const;
