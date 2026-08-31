import { array, int, maxLength, maximum, minLength, minimum, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { isoUtc, unsigned, version } from './Primitives';

const item = strictObject({ listing: string(), sku: string(), quantity: unsigned, version, title: string() });
const quantity = number().check(int(), minimum(0), maximum(999));

export const CART_BODY_SCHEMAS = {
  CartItemsPutInput: strictObject({ quantity, lineVersion: union([version, nullSchema()]) }),
  CartItemsBatchInput: strictObject({ items: array(strictObject({ listingId: string(), quantity, lineVersion: union([version, nullSchema()]) })).check(minLength(1), maxLength(100)) }),
} as const;
export const CART_QUERY_SCHEMAS = { CartCurrentReadInput: strictObject({}) } as const;
export const CART_OUTPUT_SCHEMAS = {
  CartCurrentReadOutput: strictObject({
    id: optional(union([string(), nullSchema()])),
    mall_id: optional(union([string(), nullSchema()])),
    application_id: optional(union([string(), nullSchema()])),
    version,
    updated_at: optional(union([isoUtc, nullSchema()])),
    items: array(item),
  }),
  CartItemsPutOutput: strictObject({ id: string(), mall_id: string(), application_id: string(), version, updated_at: isoUtc, items: array(item) }),
  CartItemsBatchOutput: strictObject({ id: string(), mall_id: string(), application_id: string(), version, updated_at: isoUtc, items: array(item) }),
} as const;
