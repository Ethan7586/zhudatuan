import * as z from 'zod/mini';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

export const OrderFilterSchema = z.object({ order: z.string().check(z.trim(), z.maxLength(255)) });

export const OrderListFilterSchema = z.object({
  order: z.string().check(z.trim(), z.maxLength(255)),
});

export const OrderViewSchema = z.enum(['all', 'aftersale']);
export const OrderDetailTabSchema = z.enum(['overview', 'products', 'payment', 'aftersale', 'operations']);

export const OrderSchema = z.object({
  id: z.string().check(z.minLength(1)),
  order_number: z.string().check(z.minLength(1)),
  scope_id: z.optional(z.string().check(z.minLength(1))),
  member_id: z.optional(z.string().check(z.minLength(1))),
  mall_id: z.optional(z.string().check(z.minLength(1))),
  total_minor: DatabaseIntegerSchema,
  currency: z.string().check(z.minLength(3), z.maxLength(3)),
  payment_state: z.enum(['unpaid', 'authorizing', 'paid', 'partially_refunded', 'refunded', 'failed']),
  fulfillment_state: z.enum(['unallocated', 'allocated', 'processing', 'shipped', 'delivered', 'received', 'cancelled', 'returned']),
  aftersale_state: z.enum(['none', 'applied', 'reviewing', 'approved', 'returning', 'received', 'refunding', 'resolved', 'rejected']),
  lifecycle_state: z.enum(['created', 'awaitingpayment', 'paid', 'fulfilling', 'shipped', 'received', 'completed', 'cancelled']),
  created_at: z.string().check(z.minLength(1)),
  updated_at: z.string().check(z.minLength(1)),
  version: DatabaseIntegerSchema,
  lines: z.optional(
    z.array(
      z.object({
        id: z.string().check(z.minLength(1)),
        sku: z.string().check(z.minLength(1)),
        listing: z.string().check(z.minLength(1)),
        title: z.string().check(z.minLength(1)),
        quantity: DatabaseIntegerSchema,
        unitMinor: DatabaseIntegerSchema,
        totalMinor: DatabaseIntegerSchema,
        discountMinor: DatabaseIntegerSchema,
        payableMinor: DatabaseIntegerSchema,
        productType: z.string().check(z.minLength(1)),
        category: z.string().check(z.minLength(1)),
        provider: z.optional(z.nullable(z.string())),
        partner: z.optional(z.nullable(z.string())),
      })
    )
  ),
});

export const OrderPageSchema = z
  .object({
    items: z.array(OrderSchema).check(z.maxLength(50)),
    count: z.int().check(z.nonnegative()),
    nextCursor: z.optional(z.string().check(z.minLength(1))),
  })
  .check(z.refine((page) => page.count === page.items.length, { message: 'ORDER_PAGE_COUNT_MISMATCH' }));

export type OrderFilter = z.infer<typeof OrderFilterSchema>;
export type OrderListFilter = z.infer<typeof OrderListFilterSchema>;
export type OrderView = z.infer<typeof OrderViewSchema>;
export type OrderDetailTab = z.infer<typeof OrderDetailTabSchema>;
export type OrderRecord = z.infer<typeof OrderSchema>;
export type OrderLine = NonNullable<OrderRecord['lines']>[number];
export type OrderPage = z.infer<typeof OrderPageSchema>;
