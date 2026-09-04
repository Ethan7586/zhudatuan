import { array, int, literal, null as nullSchema, optional, positive, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, unsigned, version } from './Primitives';
import { FULFILLMENT_RETURN_STATES } from '../Vocabulary';

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
  route: literal(['physical', 'digital', 'voucher', 'channel']),
  state: literal(['pending', 'submitted', 'accepted', 'processing', 'ready', 'completed', 'cancelled', 'failed', 'needsaction']),
  external_reference: nullableText,
  payment_id: nullableText,
  source_effect_id: nullableText,
  amount_minor: union([unsigned, nullSchema()]),
  idempotency_key: nullableText,
  created_at: nullableTime,
  updated_at: nullableTime,
  version,
});
const returnLine = strictObject({ line: string(), quantity: int().check(positive()) });
const inspection = strictObject({ id: string(), sequence: int().check(positive()), accepted: literal([true, false]), evidence: ContractJsonValueSchema, actor: string(), inspectedAt: isoUtc });
const returned = strictObject({
  id: string(),
  aftersale_id: string(),
  fulfillment_id: string(),
  scope_id: string(),
  state: literal(FULFILLMENT_RETURN_STATES),
  provider: nullableText,
  provider_reference: nullableText,
  instruction: ContractJsonValueSchema,
  tracking_number: nullableText,
  created_at: isoUtc,
  updated_at: isoUtc,
  version,
  lines: array(returnLine),
  inspections: array(inspection),
});
const trackingEvent = strictObject({ id: string(), external: string(), state: string(), description: string(), location: nullableText, evidence: ContractJsonValueSchema, occurredAt: isoUtc, receivedAt: isoUtc });
const fulfillmentPackage = strictObject({ id: string(), carrier: nullableText, tracking: string(), providerReference: nullableText, state: string(), version, lines: array(returnLine), events: array(trackingEvent) });
const shipment = strictObject({ id: string(), state: literal(['draft', 'shipped', 'delivered', 'cancelled']), providerReference: nullableText, shippedAt: nullableTime, deliveredAt: nullableTime, version, packages: array(fulfillmentPackage) });

export const FULFILLMENT_BODY_SCHEMAS = {
  FulfillmentShipmentsCreateInput: strictObject({ tracking: string(), carrier: optional(string()), lines: optional(array(returnLine)) }),
  FulfillmentReturnsReceiveInput: strictObject({ tracking: optional(string()) }),
  FulfillmentReturnsInspectInput: strictObject({ accepted: literal([true, false]), inspection: optional(ContractJsonValueSchema) }),
} as const;

export const FULFILLMENT_QUERY_SCHEMAS = {
  FulfillmentTrackingReadInput: strictObject({ order: string() }),
} as const;

export const FULFILLMENT_OUTPUT_SCHEMAS = {
  FulfillmentShipmentsCreateOutput: strictObject({ ...fulfillment.shape, shipment_id: string(), package_id: string(), tracking: string(), shipped_quantity: unsigned }),
  FulfillmentTrackingReadOutput: strictObject({ items: array(strictObject({ id: string(), order_id: string(), route: literal(['physical', 'digital', 'voucher', 'channel']), state: string(), external_reference: nullableText, shipments: array(shipment) })), count: unsigned }),
  FulfillmentReturnsReceiveOutput: returned,
  FulfillmentReturnsInspectOutput: returned,
} as const;
