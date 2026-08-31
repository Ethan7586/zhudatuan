import { array, literal, null as nullSchema, number, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const section = <T>(data: T) => strictObject({ state: literal(['complete', 'unavailable', 'failed']), version: string(), asOf: isoUtc, data: union([data as never, nullSchema()]) });
const binding = strictObject({ application: string(), mall: string(), pool: string(), release: string(), version: string(), tenant: string() });
const identity = strictObject({ state: literal(['anonymous', 'member']), member: union([strictObject({ id: string(), displayName: string() }), nullSchema()]), membership: nullableText });
const navigation = strictObject({ id: string(), title: string(), icon: string(), route: string(), order: number() });
const benefit = strictObject({ accounts: number(), availableMinor: number(), currency: nullableText, version: number() });
const orders = strictObject({ total: number(), awaitingPayment: number(), fulfilling: number(), aftersale: number(), version: number() });
const price = strictObject({ sku: string(), amountMinor: number(), compareMinor: union([number(), nullSchema()]), currency: string(), version: string() });
const availability = strictObject({ sku: string(), available: number(), state: literal(['available', 'unavailable']), version: string() });
const catalogCategory = strictObject({ id: string(), code: string(), name: string() });
const catalogItem = strictObject({
  id: string(),
  sku: string(),
  product: string(),
  title: string(),
  subtitle: nullableText,
  coverUrl: nullableText,
  kind: string(),
  brandId: nullableText,
  supplierId: nullableText,
  attributes: record(string(), ContractJsonValueSchema),
  specifications: record(string(), ContractJsonValueSchema),
  category: catalogCategory,
  version: string(),
  updatedAt: isoUtc,
  price: union([price, nullSchema()]),
  availability: union([availability, nullSchema()]),
});

export const STOREFRONT_QUERY_SCHEMAS = {
  StorefrontBootstrapReadInput: strictObject({}),
  StorefrontCatalogReadInput: strictObject({
    cursor: optional(string()),
    limit: optional(union([number(), string()])),
    productId: optional(string()),
    listingIds: optional(string()),
    categoryId: optional(string()),
    account: optional(string()),
    exclusive: optional(union([literal([true, false]), string()])),
    q: optional(string()),
  }),
} as const;

export const STOREFRONT_OUTPUT_SCHEMAS = {
  StorefrontBootstrapReadOutput: strictObject({
    state: literal(['complete', 'partial']),
    host: string(),
    binding,
    identity: section(identity),
    navigation: section(array(navigation)),
    benefit: section(benefit),
    orders: section(orders),
    experience: section(record(string(), ContractJsonValueSchema)),
  }),
  StorefrontCatalogReadOutput: strictObject({ items: array(catalogItem), nextCursor: nullableText, version: string(), asOf: isoUtc }),
} as const;
