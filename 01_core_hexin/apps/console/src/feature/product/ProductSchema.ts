import * as z from 'zod/mini';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

export const ProductFilterSchema = z.object({
  q: z.string().check(z.trim(), z.maxLength(200)),
  category: z.string().check(z.trim(), z.maxLength(200)),
  supplier: z.string().check(z.trim(), z.maxLength(200)),
  mall: z.string().check(z.trim(), z.maxLength(200)),
  status: z.string().check(z.trim(), z.maxLength(40)),
});

const ProductPreviewMallSchema = z.object({
  id: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
  status: z.string().check(z.minLength(1)),
  priceCents: z.optional(z.nullable(DatabaseIntegerSchema)),
});

const ProductPreviewChangeSchema = z.object({
  id: z.string().check(z.minLength(1)),
  at: z.string().check(z.minLength(1)),
  title: z.string().check(z.minLength(1)),
  actor: z.string().check(z.minLength(1)),
  operationId: z.string().check(z.minLength(1)),
  outcome: z.string().check(z.minLength(1)),
});

const ProductPreviewBlockerSchema = z.object({
  code: z.string().check(z.minLength(1)),
  title: z.string().check(z.minLength(1)),
  description: z.string().check(z.minLength(1)),
  actionLabel: z.string().check(z.minLength(1)),
});

const ProductListingPreviewSchema = z.object({
  kind: z.string().check(z.minLength(1)),
  spu: z.string().check(z.minLength(1)),
  barcode: z.string().check(z.minLength(1)),
  categoryId: z.string().check(z.minLength(1)),
  categoryName: z.string().check(z.minLength(1)),
  supplier: z.object({ id: z.string().check(z.minLength(1)), name: z.string().check(z.minLength(1)) }),
  skuCount: z.int().check(z.nonnegative()),
  skuTotal: z.int().check(z.nonnegative()),
  mallCount: z.int().check(z.nonnegative()),
  mallTotal: z.int().check(z.nonnegative()),
  priceCents: z.nullable(DatabaseIntegerSchema),
  inventory: z.nullable(DatabaseIntegerSchema),
  lastSyncedAt: z.string().check(z.minLength(1)),
  operationId: z.string().check(z.minLength(1)),
  tone: z.string().check(z.minLength(1)),
  blocker: z.optional(z.nullable(ProductPreviewBlockerSchema)),
  malls: z.array(ProductPreviewMallSchema),
  changes: z.array(ProductPreviewChangeSchema),
});

export const ListingSchema = z.object({
  id: z.string().check(z.minLength(1)),
  sku_id: z.string().check(z.minLength(1)),
  product_id: z.string().check(z.minLength(1)),
  title: z.string().check(z.minLength(1)),
  status: z.string().check(z.minLength(1)),
  version: DatabaseIntegerSchema,
  code: z.optional(z.nullable(z.string())),
  pool_id: z.optional(z.nullable(z.string())),
  product_type: z.optional(z.nullable(z.string())),
  subtitle: z.optional(z.nullable(z.string())),
  cover_url: z.optional(z.nullable(z.string())),
  effective_at: z.optional(z.nullable(z.string())),
  expires_at: z.optional(z.nullable(z.string())),
  cursor_sort: z.optional(z.string()),
  preview: z.optional(ProductListingPreviewSchema),
});

const ProductPreviewFacetSchema = z.object({
  value: z.string().check(z.minLength(1)),
  label: z.string().check(z.minLength(1)),
  count: z.int().check(z.nonnegative()),
});

const ProductPagePreviewSchema = z.object({
  kind: z.string().check(z.minLength(1)),
  totalCount: z.int().check(z.nonnegative()),
  asOf: z.string().check(z.minLength(1)),
  facets: z.object({
    categories: z.array(ProductPreviewFacetSchema),
    suppliers: z.array(ProductPreviewFacetSchema),
    malls: z.array(ProductPreviewFacetSchema),
    statuses: z.array(ProductPreviewFacetSchema),
  }),
});

export const ListingPageSchema = z.object({
  items: z.array(ListingSchema),
  count: z.int().check(z.nonnegative()),
  nextCursor: z.optional(z.string().check(z.minLength(1))),
  preview: z.optional(ProductPagePreviewSchema),
});

export type ProductFilter = z.infer<typeof ProductFilterSchema>;
export type Listing = z.infer<typeof ListingSchema>;
export type ListingPage = z.infer<typeof ListingPageSchema>;
export type ProductListingPreview = z.infer<typeof ProductListingPreviewSchema>;
export type ProductPagePreview = z.infer<typeof ProductPagePreviewSchema>;
