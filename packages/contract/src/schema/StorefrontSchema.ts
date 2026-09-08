import { array, boolean, lazy, literal, null as nullSchema, number, optional, record, strictObject, string, union, type ZodMiniType } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc } from './Primitives';
import { STOREFRONT_ENTRY_URL_PATTERN, STOREFRONT_HANDLE_PATTERN } from '../StorefrontEntry';
import { regex } from 'zod/mini';

const nullableText = union([string(), nullSchema()]);
const handle = string().check(regex(STOREFRONT_HANDLE_PATTERN));
const publicUrl = string().check(regex(STOREFRONT_ENTRY_URL_PATTERN));
const section = <TOutput>(data: ZodMiniType<TOutput>) =>
  strictObject({ state: literal(['complete', 'unavailable', 'failed']), version: string(), asOf: isoUtc, data: union([data, nullSchema()]) });
const binding = strictObject({ application: string(), mall: string(), pool: string(), release: string(), version: string(), tenant: string() });
const identity = strictObject({
  state: literal(['anonymous', 'member']),
  member: union([strictObject({ id: string(), displayName: string() }), nullSchema()]),
  membership: nullableText,
  csrf: optional(string()),
});
interface StorefrontNavigationNode {
  readonly key: string;
  readonly title: string;
  readonly parent: string | null;
  readonly order: number;
  readonly operation: string;
  readonly experience: Readonly<{
    icon: string;
    routeKey: string;
    route: string;
    component: string;
    placement: 'primary' | 'secondary' | 'contextual';
    disabled: boolean;
    disabledReason: string | null;
    breadcrumbs: readonly Readonly<{ key: string; title: string }>[];
  }>;
  readonly children: readonly StorefrontNavigationNode[];
}
const navigation: ZodMiniType<StorefrontNavigationNode> = lazy(() =>
  strictObject({
    key: string(),
    title: string(),
    parent: nullableText,
    order: number(),
    operation: string(),
    experience: strictObject({ icon: string(), routeKey: string(), route: string(), component: string(), placement: literal(['primary', 'secondary', 'contextual']), disabled: boolean(), disabledReason: nullableText, breadcrumbs: array(strictObject({ key: string(), title: string() })) }),
    children: array(navigation),
  })
) as ZodMiniType<StorefrontNavigationNode>;
const benefit = strictObject({ accounts: number(), availableMinor: number(), currency: nullableText, version: number() });
const orders = strictObject({ total: number(), awaitingPayment: number(), fulfilling: number(), aftersale: number(), version: number() });
const price = strictObject({ sku: string(), amountMinor: number(), compareMinor: union([number(), nullSchema()]), currency: string(), version: string() });
const availability = strictObject({ sku: string(), available: number(), state: literal(['available', 'unavailable']), version: string() });
const qualification = strictObject({ eligible: boolean(), policyVersion: number() });
const saleabilityReason = literal(['qualification_unavailable', 'qualification_failed', 'price_unavailable', 'inventory_unavailable', 'out_of_stock']);
const saleability = strictObject({ state: literal(['saleable', 'blocked']), reasons: array(saleabilityReason) });
const catalogCategoryFacet = strictObject({ id: string(), code: string(), name: string(), count: number() });
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
  qualification: union([qualification, nullSchema()]),
  saleability,
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
    entry: strictObject({ handle, url: publicUrl }),
    binding,
    subject: strictObject({ principal: string(), membership: nullableText, member: nullableText }),
    scope: strictObject({ id: string(), kind: literal('mall'), tenant: string() }),
    capabilities: strictObject({ version: number(), values: array(string()) }),
    navigationVersion: string(),
    identity: section(identity),
    navigation: section(array(navigation)),
    benefit: section(benefit),
    orders: section(orders),
    experience: section(record(string(), ContractJsonValueSchema)),
  }),
  StorefrontCatalogReadOutput: strictObject({ items: array(catalogItem), categories: array(catalogCategoryFacet), nextCursor: nullableText, version: string(), asOf: isoUtc }),
} as const;
