import { null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, unsigned, version } from './Primitives';

const rule = strictObject({
  id: string(),
  scope_id: string(),
  priority: unsigned,
  kind: string(),
  condition: ContractJsonValueSchema,
  effect: ContractJsonValueSchema,
  version,
  status: string(),
  effective_at: union([isoUtc, nullSchema()]),
});
export const PRICING_QUERY_SCHEMAS = {} as const;
export const PRICING_BODY_SCHEMAS = {
  PricingRulesCreateInput: strictObject({ priority: unsigned, kind: optional(string()), condition: optional(ContractJsonValueSchema), effect: optional(ContractJsonValueSchema) }),
  PricingRulesPublishInput: strictObject({}),
} as const;
export const PRICING_OUTPUT_SCHEMAS = { PricingRulesCreateOutput: rule, PricingRulesPublishOutput: rule } as const;
