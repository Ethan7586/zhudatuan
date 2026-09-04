import { array, boolean, int, literal, maxLength, maximum, minLength, minimum, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { isoUtc, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const nullableNumber = union([number().check(int(), minimum(0)), nullSchema()]);
const quantity = number().check(int(), minimum(0), maximum(999));
const validity = strictObject({
  state: literal(['valid', 'invalid']),
  code: literal(['valid', 'unpublished', 'unavailable', 'outofscope', 'unpriced', 'outofstock', 'variantchanged']),
  message: string(),
});
const item = strictObject({
  listing: string(),
  sku: string(),
  quantity: number().check(int(), minimum(1), maximum(999)),
  selected: boolean(),
  version,
  title: string(),
  amountMinor: nullableNumber,
  currency: nullableText,
  available: nullableNumber,
  benefitApplicable: boolean(),
  validity,
});
const cart = {
  id: nullableText,
  mall_id: nullableText,
  application_id: nullableText,
  version,
  updated_at: union([isoUtc, nullSchema()]),
  merge: literal(['none', 'completed', 'blocked']),
  merge_reason: nullableText,
  items: array(item),
} as const;
const change = { quantity, lineVersion: union([version, nullSchema()]), selected: optional(boolean()) } as const;

export const CART_BODY_SCHEMAS = {
  CartItemsPutInput: strictObject(change),
  CartItemsBatchInput: strictObject({ items: array(strictObject({ listingId: string(), ...change })).check(minLength(1), maxLength(100)) }),
  CartMergeInput: strictObject({}),
} as const;

export const CART_QUERY_SCHEMAS = { CartCurrentReadInput: strictObject({}) } as const;

export const CART_OUTPUT_SCHEMAS = {
  CartCurrentReadOutput: strictObject(cart),
  CartItemsPutOutput: strictObject(cart),
  CartItemsBatchOutput: strictObject({
    ...cart,
    results: array(strictObject({
      requestedListing: string(),
      listing: string(),
      outcome: literal(['succeeded', 'failed', 'skipped']),
      reason: nullableText,
      lineVersion: union([version, nullSchema()]),
    })),
  }),
  CartMergeOutput: strictObject(cart),
} as const;
