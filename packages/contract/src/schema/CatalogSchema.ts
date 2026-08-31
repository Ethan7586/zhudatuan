import { array, literal, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { importCreated, importInput, importRead } from './ImportSchema';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, pageOutput, pageQuery, unsigned, version as entityVersion } from './Primitives';

const text = string();
const nullableText = union([text, nullSchema()]);
const integer = union([number(), string()]);

const specification = strictObject({ name: text, value: text });
const sku = strictObject({
  id: text,
  code: text,
  status: literal(['draft', 'active', 'archived']),
  specifications: array(specification),
  version: integer,
});
const listing = strictObject({
  id: text,
  scope: text,
  pool: nullableText,
  sku: text,
  title: text,
  status: literal(['draft', 'published', 'unpublished', 'retired']),
  effectiveAt: nullableText,
  expiresAt: nullableText,
  version: integer,
});
const stock = strictObject({
  sku: text,
  scope: text,
  location: text,
  onhand: integer,
  safety: integer,
  status: literal(['active', 'blocked', 'retired']),
  version: integer,
});
const price = strictObject({
  sku: text,
  scope: text,
  currency: text,
  amountMinor: integer,
  compareMinor: union([integer, nullSchema()]),
  bookStatus: literal(['draft', 'active', 'retired']),
  effectiveAt: text,
  expiresAt: nullableText,
  bookVersion: integer,
});

const pool = strictObject({ id: text, scope_id: text, kind: literal(['global', 'channel', 'private', 'markup']), name: text, status: literal(['draft', 'active', 'disabled']), version: entityVersion });
const poolRead = strictObject({ id: text, kind: string(), name: text, status: string(), version: entityVersion, item_count: unsigned });
const poolBinding = strictObject({ mall_id: text, pool_id: text, listing_kind: literal(['selected', 'combined']), status: literal(['active', 'disabled']), effective_at: nullableText, expires_at: nullableText, created_at: isoUtc });
const product = strictObject({
  id: text,
  scope_id: text,
  owner_partner_id: nullableText,
  brand_id: nullableText,
  category_id: text,
  title: text,
  product_type: literal(['physical', 'virtual', 'service', 'voucher']),
  attributes: ContractJsonValueSchema,
  status: literal(['draft', 'review', 'active', 'archived']),
  version: entityVersion,
  created_at: isoUtc,
  updated_at: isoUtc,
});
const listingRecord = strictObject({
  id: text,
  scope_id: text,
  pool_id: nullableText,
  sku_id: text,
  title: text,
  status: literal(['draft', 'published', 'unpublished', 'retired']),
  effective_at: nullableText,
  expires_at: nullableText,
  version: entityVersion,
  created_at: isoUtc,
  updated_at: isoUtc,
});
const listingRead = strictObject({
  id: text,
  pool_id: nullableText,
  sku_id: text,
  title: text,
  status: string(),
  effective_at: nullableText,
  expires_at: nullableText,
  version: integer,
  cursor_sort: isoUtc,
  code: text,
  product_id: text,
  product_type: string(),
  cover_url: nullableText,
  subtitle: nullableText,
});
const sourceRead = strictObject({
  id: text,
  sku_id: nullableText,
  title: text,
  status: string(),
  version: text,
  cursor_sort: isoUtc,
  code: nullableText,
  product_id: nullableText,
  product_type: nullableText,
  cover_url: nullableText,
  subtitle: nullableText,
});

export const CATALOG_QUERY_SCHEMAS = {
  CatalogPoolsReadInput: strictObject(pageQuery),
  CatalogProductDetailReadInput: strictObject({}),
  CatalogListingsReadInput: strictObject({ ...pageQuery, q: optional(string()), category: optional(string()), product: optional(string()), pool: optional(string()) }),
  CatalogImportsReadInput: strictObject({}),
} as const;

export const CATALOG_BODY_SCHEMAS = {
  CatalogPoolsAttachInput: strictObject({}),
  CatalogPoolsDetachInput: strictObject({}),
  CatalogPoolsAllocateInput: strictObject({ scope: string(), kind: optional(literal(['channel', 'markup'])), name: string() }),
  CatalogProductsCreateInput: strictObject({
    owner: optional(union([string(), nullSchema()])),
    brand: optional(union([string(), nullSchema()])),
    category: string(),
    title: string(),
    type: optional(literal(['physical', 'virtual', 'service', 'voucher'])),
    attributes: optional(ContractJsonValueSchema),
  }),
  CatalogProductsUpdateInput: strictObject({ title: optional(string()), category: optional(string()), attributes: optional(ContractJsonValueSchema), status: optional(literal(['draft', 'review', 'active', 'archived'])) }),
  CatalogProductsArchiveInput: strictObject({}),
  CatalogListingsPublishInput: strictObject({}),
  CatalogListingsUnpublishInput: strictObject({}),
  CatalogListingsBatchInput: strictObject({ ids: array(string()), action: literal(['publish', 'unpublish']) }),
  CatalogImportsCreateInput: importInput,
} as const;

export const CATALOG_OUTPUT_SCHEMAS = {
  CatalogPoolsReadOutput: pageOutput(poolRead),
  CatalogPoolsAttachOutput: poolBinding,
  CatalogPoolsDetachOutput: poolBinding,
  CatalogPoolsAllocateOutput: pool,
  CatalogProductDetailReadOutput: strictObject({
    id: text,
    title: text,
    product_type: literal(['physical', 'virtual', 'service', 'voucher']),
    status: literal(['draft', 'review', 'active', 'archived']),
    version: integer,
    category_id: text,
    brand_id: nullableText,
    owner_partner_id: nullableText,
    cover_url: nullableText,
    subtitle: nullableText,
    skus: array(sku),
    listings: array(listing),
    inventory: array(stock),
    prices: array(price),
  }),
  CatalogProductsCreateOutput: product,
  CatalogProductsUpdateOutput: product,
  CatalogProductsArchiveOutput: product,
  CatalogListingsReadOutput: pageOutput(union([listingRead, sourceRead])),
  CatalogListingsPublishOutput: listingRecord,
  CatalogListingsUnpublishOutput: listingRecord,
  CatalogListingsBatchOutput: strictObject({ items: array(strictObject({ id: string(), status: literal(['published', 'unpublished']), version: entityVersion })), count: unsigned }),
  CatalogImportsCreateOutput: importCreated,
  CatalogImportsReadOutput: importRead,
} as const;
