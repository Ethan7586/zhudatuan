import { array, literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, integer, isoUtc, unsigned, version } from './Primitives';

const rule = strictObject({
  id: string(),
  scope_id: string(),
  priority: unsigned,
  kind: string(),
  condition: ContractJsonValueSchema,
  effect: ContractJsonValueSchema,
  version,
  status: string(),
  effective_at: isoUtc,
  expires_at: union([isoUtc, nullSchema()]),
  approved_by: union([string(), nullSchema()]),
});
const nullableTime = union([isoUtc, nullSchema()]);
const breakdown = strictObject({
  kind: literal(['base', 'markup', 'discount', 'tax', 'freight']),
  label: string(),
  amountMinor: integer,
});
const offer = strictObject({
  sku: string(),
  scope: string(),
  amountMinor: unsigned,
  compareMinor: union([unsigned, nullSchema()]),
  currency,
  breakdown: array(breakdown),
  status: literal('effective'),
  effectiveAt: isoUtc,
  expiresAt: nullableTime,
  version: string(),
  watermark: isoUtc,
});
export const PRICING_QUERY_SCHEMAS = {
  PricingOffersReadInput: strictObject({ sku: optional(union([string(), array(string())])) }),
} as const;
export const PRICING_BODY_SCHEMAS = {
  PricingRulesCreateInput: strictObject({ priority: unsigned, kind: optional(literal(['markup', 'discount', 'tax', 'freight'])),
    condition: optional(record(string(), ContractJsonValueSchema)), effect: optional(record(string(), ContractJsonValueSchema)),
    effectiveAt: optional(isoUtc), expiresAt: optional(isoUtc) }),
  PricingRulesPublishInput: strictObject({}),
} as const;
export const PRICING_OUTPUT_SCHEMAS = {
  PricingOffersReadOutput: strictObject({ items: array(offer), count: unsigned, watermark: nullableTime }),
  PricingRulesCreateOutput: rule,
  PricingRulesPublishOutput: rule,
} as const;
