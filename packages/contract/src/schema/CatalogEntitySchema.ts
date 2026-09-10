import { array, boolean, literal, null as nullSchema, number, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { isoUtc, unsigned, version as entityVersion } from './Primitives';

export const text = string();
export const nullableText = union([text, nullSchema()]);
export const integer = union([number(), string()]);

export const specification = strictObject({ name: text, value: text });
export const sku = strictObject({
  id: text,
  code: text,
  status: literal(['draft', 'active', 'archived']),
  specifications: array(specification),
  version: integer,
});
export const listing = strictObject({
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
export const stock = strictObject({
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
export const price = strictObject({
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

export const pool = strictObject({ id: text, scope_id: text, kind: literal(['global', 'channel', 'private', 'markup']), name: text, status: literal(['draft', 'active', 'disabled']), version: entityVersion });
export const poolRead = strictObject({ id: text, kind: string(), name: text, status: string(), version: entityVersion, item_count: unsigned });
export const category = strictObject({
  id: text,
  parent_id: nullableText,
  parent_name: nullableText,
  code: text,
  name: text,
  status: literal(['active', 'disabled']),
  sort_order: unsigned,
  product_count: unsigned,
});
export const poolBinding = strictObject({ mall_id: text, pool_id: text, listing_kind: literal(['selected', 'combined']), status: literal(['active', 'disabled']), effective_at: nullableText, expires_at: nullableText, created_at: isoUtc });
export const listingPrice = strictObject({ listing_id: text, sku_id: text, scope_id: text, amount_minor: unsigned, currency: literal('CNY'), version: entityVersion, effective_at: isoUtc, updated_at: isoUtc });
export const product = strictObject({
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
export const listingRecord = strictObject({
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
export const listingRead = strictObject({
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
export const sourceRead = strictObject({
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
export const facet = strictObject({ value: text, label: nullableText, count: unsigned });
export const detailSection = literal(['core', 'pricing', 'inventory', 'qualification']);
export const dependency = strictObject({ state: literal(['ready', 'unavailable', 'notrequested']), watermark: nullableText, code: nullableText });
export const productMedia = strictObject({ id: text, kind: literal(['image', 'video', 'document']), url: text, alt: nullableText, sort: unsigned });
export const productChannel = strictObject({ provider: text, externalId: text, status: literal(['pending', 'mapped', 'rejected', 'retired']), sourceVersion: text, observedAt: isoUtc });
export const productPool = strictObject({ id: text, name: text, kind: literal(['global', 'channel', 'private', 'markup']), status: literal(['draft', 'active', 'disabled']), listingCount: unsigned });
export const productTimeline = strictObject({
  id: text,
  kind: literal(['productcreated', 'productupdated', 'listingcreated', 'listingupdated', 'sourceobserved']),
  title: text,
  occurredAt: isoUtc,
  reference: nullableText,
  referenceLabel: nullableText,
});
export const productQualification = strictObject({ listing: text, listingTitle: text, eligible: boolean(), policyVersion: unsigned });
