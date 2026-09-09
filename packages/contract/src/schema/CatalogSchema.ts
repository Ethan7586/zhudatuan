import { array, boolean, literal, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { catalogListingsBatchInput, catalogListingsBatchOutput } from './CatalogBatchSchema';
import { importCreated, importInput, importRead } from './ImportSchema';
import { ContractJsonValueSchema } from './JsonSchema';
import { ImageAssetInputSchema, ImageAssetUploadInputSchema, ImageAssetUploadOutputSchema } from './ObjectSchema';
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
  scopeName: text,
  pool: nullableText,
  poolName: nullableText,
  sku: text,
  skuCode: text,
  title: text,
  status: literal(['draft', 'published', 'unpublished', 'retired']),
  effectiveAt: nullableText,
  expiresAt: nullableText,
  createdAt: isoUtc,
  updatedAt: isoUtc,
  version: integer,
});
const stock = strictObject({
  sku: text,
  skuCode: text,
  scope: text,
  scopeName: text,
  location: text,
  locationName: text,
  onhand: integer,
  safety: integer,
  status: literal(['active', 'blocked', 'retired']),
  version: integer,
});
const price = strictObject({
  sku: text,
  skuCode: text,
  scope: text,
  scopeName: text,
  currency: text,
  amountMinor: integer,
  compareMinor: union([integer, nullSchema()]),
  bookStatus: literal(['draft', 'active', 'retired']),
  effectiveAt: text,
  expiresAt: nullableText,
  bookVersion: integer,
  priceVersion: entityVersion,
});

const pool = strictObject({ id: text, scope_id: text, kind: literal(['global', 'channel', 'private', 'markup']), name: text, status: literal(['draft', 'active', 'disabled']), version: entityVersion });
const poolRead = strictObject({ id: text, kind: string(), name: text, status: string(), version: entityVersion, item_count: unsigned });
const category = strictObject({
  id: text,
  parent_id: nullableText,
  parent_name: nullableText,
  code: text,
  name: text,
  status: literal(['active', 'disabled']),
  sort_order: unsigned,
  product_count: unsigned,
});
const poolBinding = strictObject({ mall_id: text, pool_id: text, listing_kind: literal(['selected', 'combined']), status: literal(['active', 'disabled']), effective_at: nullableText, expires_at: nullableText, created_at: isoUtc });
const listingPrice = strictObject({ listing_id: text, sku_id: text, scope_id: text, amount_minor: unsigned, currency: literal('CNY'), version: entityVersion, effective_at: isoUtc, updated_at: isoUtc });
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
  scope_id: text,
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
  category_id: text,
  category_name: text,
  source: text,
  source_partner_id: nullableText,
  source_partner_name: nullableText,
  pool_name: nullableText,
  sku_count: unsigned,
  sku_total: unsigned,
  mall_count: unsigned,
  mall_total: unsigned,
  price_amount_minor: union([unsigned, nullSchema()]),
  price_currency: nullableText,
  price_version: union([unsigned, nullSchema()]),
  saleable_stock: union([unsigned, nullSchema()]),
  qualification_eligible: union([boolean(), nullSchema()]),
  data_gaps: array(text),
});
const sourceRead = strictObject({
  id: text,
  scope_id: text,
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
  category_id: nullableText,
  category_name: nullableText,
  source: text,
  source_partner_id: nullableText,
  source_partner_name: nullableText,
  pool_name: nullableText,
  sku_count: unsigned,
  sku_total: unsigned,
  mall_count: unsigned,
  mall_total: unsigned,
  price_amount_minor: union([unsigned, nullSchema()]),
  price_currency: nullableText,
  price_version: union([unsigned, nullSchema()]),
  saleable_stock: union([unsigned, nullSchema()]),
  qualification_eligible: union([boolean(), nullSchema()]),
  data_gaps: array(text),
});
const facet = strictObject({ value: text, label: nullableText, count: unsigned });
const detailSection = literal(['core', 'pricing', 'inventory', 'qualification']);
const dependency = strictObject({ state: literal(['ready', 'unavailable', 'notrequested']), watermark: nullableText, code: nullableText });
const productMedia = strictObject({ id: text, kind: literal(['image', 'video', 'document']), url: text, alt: nullableText, sort: unsigned });
const productChannel = strictObject({ provider: text, externalId: text, status: literal(['pending', 'mapped', 'rejected', 'retired']), sourceVersion: text, observedAt: isoUtc });
const productPool = strictObject({ id: text, name: text, kind: literal(['global', 'channel', 'private', 'markup']), status: literal(['draft', 'active', 'disabled']), listingCount: unsigned });
const productTimeline = strictObject({
  id: text,
  kind: literal(['productcreated', 'productupdated', 'listingcreated', 'listingupdated', 'sourceobserved']),
  title: text,
  occurredAt: isoUtc,
  reference: nullableText,
  referenceLabel: nullableText,
});
const productQualification = strictObject({ listing: text, listingTitle: text, eligible: boolean(), policyVersion: unsigned });

export const CATALOG_QUERY_SCHEMAS = {
  CatalogPoolsReadInput: strictObject(pageQuery),
  CatalogCategoriesReadInput: strictObject({ ...pageQuery, q: optional(string()) }),
  CatalogProductDetailReadInput: strictObject({ section: detailSection }),
  CatalogListingsReadInput: strictObject({
    ...pageQuery,
    q: optional(string()),
    category: optional(string()),
    product: optional(string()),
    pool: optional(string()),
    supplier: optional(string()),
    mall: optional(string()),
    status: optional(string()),
  }),
  CatalogFacetsReadInput: strictObject({ q: optional(string()) }),
  CatalogImportsReadInput: strictObject({}),
} as const;

export const CATALOG_BODY_SCHEMAS = {
  CatalogPoolsAttachInput: strictObject({}),
  CatalogPoolsDetachInput: strictObject({}),
  CatalogPoolsAllocateInput: strictObject({ scope: string(), kind: optional(literal(['channel', 'markup'])), name: string() }),
  CatalogCategoriesCreateInput: strictObject({ name: string(), parent: optional(union([string(), nullSchema()])), sort: optional(unsigned) }),
  CatalogProductsCreateInput: strictObject({
    owner: optional(union([string(), nullSchema()])),
    brand: optional(union([string(), nullSchema()])),
    category: string(),
    title: string(),
    type: optional(literal(['physical', 'virtual', 'service', 'voucher'])),
    attributes: optional(ContractJsonValueSchema),
    image: optional(ImageAssetInputSchema),
  }),
  CatalogProductsUpdateInput: strictObject({
    title: optional(string()),
    category: optional(string()),
    attributes: optional(ContractJsonValueSchema),
    image: optional(union([ImageAssetInputSchema, nullSchema()])),
    status: optional(literal(['draft', 'review', 'active', 'archived'])),
  }),
  CatalogMediauploadsCreateInput: ImageAssetUploadInputSchema,
  CatalogProductsArchiveInput: strictObject({}),
  CatalogListingsPublishInput: strictObject({}),
  CatalogListingsUnpublishInput: strictObject({}),
  CatalogListingsPriceSetInput: strictObject({ amountMinor: unsigned, currency: optional(literal('CNY')) }),
  CatalogListingsPoolSetInput: strictObject({ pool: nullableText }),
  CatalogListingsBatchInput: catalogListingsBatchInput,
  CatalogImportsCreateInput: importInput,
} as const;

export const CATALOG_OUTPUT_SCHEMAS = {
  CatalogPoolsReadOutput: pageOutput(poolRead),
  CatalogCategoriesReadOutput: pageOutput(category),
  CatalogCategoriesCreateOutput: category,
  CatalogPoolsAttachOutput: poolBinding,
  CatalogPoolsDetachOutput: poolBinding,
  CatalogPoolsAllocateOutput: pool,
  CatalogProductDetailReadOutput: strictObject({
    section: detailSection,
    id: text,
    title: text,
    description: nullableText,
    product_type: literal(['physical', 'virtual', 'service', 'voucher']),
    status: literal(['draft', 'review', 'active', 'archived']),
    version: integer,
    category_id: text,
    category_name: text,
    brand_id: nullableText,
    brand_name: nullableText,
    owner_partner_id: nullableText,
    owner_partner_name: nullableText,
    cover_url: nullableText,
    subtitle: nullableText,
    createdAt: isoUtc,
    updatedAt: isoUtc,
    skus: array(sku),
    listings: array(listing),
    media: array(productMedia),
    channels: array(productChannel),
    pools: array(productPool),
    timeline: array(productTimeline),
    inventory: array(stock),
    prices: array(price),
    qualifications: array(productQualification),
    dependencies: strictObject({ catalog: dependency, inventory: dependency, pricing: dependency, qualification: dependency }),
    gaps: array(strictObject({ dependency: literal(['inventory', 'pricing', 'qualification']), code: text })),
  }),
  CatalogProductsCreateOutput: product,
  CatalogProductsUpdateOutput: product,
  CatalogMediauploadsCreateOutput: ImageAssetUploadOutputSchema,
  CatalogProductsArchiveOutput: product,
  CatalogListingsReadOutput: pageOutput(union([listingRead, sourceRead])),
  CatalogFacetsReadOutput: strictObject({ categories: array(facet), suppliers: array(facet), malls: array(facet), statuses: array(facet) }),
  CatalogListingsPublishOutput: listingRecord,
  CatalogListingsUnpublishOutput: listingRecord,
  CatalogListingsPriceSetOutput: listingPrice,
  CatalogListingsPoolSetOutput: listingRecord,
  CatalogListingsBatchOutput: catalogListingsBatchOutput,
  CatalogImportsCreateOutput: importCreated,
  CatalogImportsReadOutput: importRead,
} as const;
