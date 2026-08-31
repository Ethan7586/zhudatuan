import * as z from 'zod/mini';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

export const ProductFilterSchema = z.object({
  q: z.string().check(z.trim(), z.maxLength(200)),
  category: z.string().check(z.trim(), z.maxLength(200)),
  supplier: z.string().check(z.trim(), z.maxLength(200)),
  mall: z.string().check(z.trim(), z.maxLength(200)),
  status: z.string().check(z.trim(), z.maxLength(40)),
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
});

export const ListingPageSchema = z.object({
  items: z.array(ListingSchema),
  count: z.int().check(z.nonnegative()),
  nextCursor: z.optional(z.string().check(z.minLength(1))),
});

export const PoolSchema = z.object({
  id: z.string().check(z.minLength(1)),
  kind: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
  status: z.string().check(z.minLength(1)),
  version: DatabaseIntegerSchema,
  item_count: DatabaseIntegerSchema,
});

export const PoolPageSchema = z.object({
  items: z.array(PoolSchema),
  count: z.int().check(z.nonnegative()),
  nextCursor: z.optional(z.string().check(z.minLength(1))),
});

export type ProductFilter = z.infer<typeof ProductFilterSchema>;
export type Listing = z.infer<typeof ListingSchema>;
export type ListingPage = z.infer<typeof ListingPageSchema>;
export type Pool = z.infer<typeof PoolSchema>;
export type PoolPage = z.infer<typeof PoolPageSchema>;
