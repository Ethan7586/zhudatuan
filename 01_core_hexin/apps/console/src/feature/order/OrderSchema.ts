import * as z from 'zod/mini';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

export const OrderFilterSchema = z.object({ order: z.string().check(z.trim(), z.maxLength(255)) });

export const OrderListFilterSchema = z.object({
  order: z.string().check(z.trim(), z.maxLength(255)),
  placed: z.enum(['', 'today', '7days', '30days']),
  lifecycle: z.enum(['', 'created', 'active', 'completed', 'cancelled', 'closed']),
  payment: z.enum(['', 'unpaid', 'authorizing', 'paid', 'partially_refunded', 'refunded', 'failed']),
  fulfillment: z.enum(['', 'unallocated', 'allocated', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
  mall: z.string().check(z.trim(), z.maxLength(255)),
});

export const OrderViewSchema = z.enum(['all', 'unpaid', 'unshipped', 'active', 'completed', 'aftersale', 'exception']);
export const OrderDetailTabSchema = z.enum(['overview', 'products', 'payment', 'aftersale', 'operations']);

const PreviewMilestoneSchema = z.object({
  key: z.enum(['placed', 'paid', 'reserved', 'unshipped', 'shipping', 'completed']),
  label: z.string().check(z.minLength(1)),
  state: z.enum(['complete', 'current', 'pending', 'warning']),
  at: z.optional(z.string().check(z.minLength(1))),
});

const PreviewOperationSchema = z.object({
  id: z.string().check(z.minLength(1)),
  label: z.string().check(z.minLength(1)),
  status: z.enum(['succeeded', 'pending', 'failed']),
  at: z.string().check(z.minLength(1)),
});

const OrderPreviewSchema = z
  .object({
    source: z.enum(['local-preview']),
    memberName: z.string().check(z.minLength(1)),
    enterpriseName: z.string().check(z.minLength(1)),
    mallName: z.string().check(z.minLength(1)),
    paidMinor: DatabaseIntegerSchema,
    paymentMethod: z.string().check(z.minLength(1)),
    benefitMinor: DatabaseIntegerSchema,
    wechatMinor: DatabaseIntegerSchema,
    supplierName: z.string().check(z.minLength(1)),
    fulfillmentId: z.string().check(z.minLength(1)),
    slaMinutes: z.optional(DatabaseIntegerSchema),
    addressSummary: z.string().check(z.minLength(1)),
    summary: z.string().check(z.minLength(1)),
    milestones: z.array(PreviewMilestoneSchema),
    operation: z.optional(PreviewOperationSchema),
    exception: z.boolean(),
  })
  .check(z.refine((preview) => preview.benefitMinor + preview.wechatMinor === preview.paidMinor, { message: 'ORDER_PREVIEW_PAYMENT_SPLIT_MISMATCH' }));

export const OrderSchema = z.object({
  id: z.string().check(z.minLength(1)),
  order_number: z.string().check(z.minLength(1)),
  scope_id: z.optional(z.string().check(z.minLength(1))),
  member_id: z.optional(z.string().check(z.minLength(1))),
  mall_id: z.optional(z.string().check(z.minLength(1))),
  total_minor: DatabaseIntegerSchema,
  currency: z.string().check(z.minLength(3), z.maxLength(3)),
  payment_state: z.enum(['unpaid', 'authorizing', 'paid', 'partially_refunded', 'refunded', 'failed']),
  fulfillment_state: z.enum(['unallocated', 'allocated', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
  aftersale_state: z.enum(['none', 'requested', 'processing', 'resolved', 'rejected']),
  lifecycle_state: z.enum(['created', 'active', 'completed', 'cancelled', 'closed']),
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
        provider: z.optional(z.nullable(z.string())),
        partner: z.optional(z.nullable(z.string())),
      })
    )
  ),
  inventory_reservations: z.optional(
    z.array(
      z.object({
        id: z.string().check(z.minLength(1)),
        stockItem: z.string().check(z.minLength(1)),
        quantity: DatabaseIntegerSchema,
        state: z.string().check(z.minLength(1)),
        expiresAt: z.nullable(z.string()),
      })
    )
  ),
  aftersales: z.optional(
    z.array(
      z.object({
        id: z.string().check(z.minLength(1)),
        lineId: z.nullable(z.string()),
        kind: z.enum(['cancel', 'return', 'refund', 'exchange', 'claim']),
        state: z.enum(['requested', 'approved', 'rejected', 'processing', 'completed', 'cancelled']),
        quantity: z.nullable(DatabaseIntegerSchema),
        amountMinor: z.nullable(DatabaseIntegerSchema),
        reason: z.string(),
        requestedAt: z.string().check(z.minLength(1)),
        updatedAt: z.string().check(z.minLength(1)),
      })
    )
  ),
  preview: z.optional(OrderPreviewSchema),
});

export const OrderPageSchema = z
  .object({
    items: z.array(OrderSchema).check(z.maxLength(50)),
    count: z.int().check(z.nonnegative()),
    nextCursor: z.optional(z.string().check(z.minLength(1))),
    preview: z.optional(
      z.object({
        source: z.enum(['local-preview']),
        total: z.int().check(z.nonnegative()),
        updatedAt: z.string().check(z.minLength(1)),
        page: z.int().check(z.positive()),
        previousCursor: z.optional(z.string().check(z.minLength(1))),
        counts: z.object({
          all: z.int().check(z.nonnegative()),
          unpaid: z.int().check(z.nonnegative()),
          unshipped: z.int().check(z.nonnegative()),
          active: z.int().check(z.nonnegative()),
          completed: z.int().check(z.nonnegative()),
          aftersale: z.int().check(z.nonnegative()),
          exception: z.int().check(z.nonnegative()),
        }),
      })
    ),
  })
  .check(
    z.refine((page) => page.count === page.items.length, { message: 'ORDER_PAGE_COUNT_MISMATCH' }),
    z.refine((page) => page.preview === undefined || page.preview.total >= page.count, { message: 'ORDER_PREVIEW_TOTAL_INVALID' })
  );

export type OrderFilter = z.infer<typeof OrderFilterSchema>;
export type OrderListFilter = z.infer<typeof OrderListFilterSchema>;
export type OrderView = z.infer<typeof OrderViewSchema>;
export type OrderDetailTab = z.infer<typeof OrderDetailTabSchema>;
export type OrderRecord = z.infer<typeof OrderSchema>;
export type OrderLine = NonNullable<OrderRecord['lines']>[number];
export type OrderInventoryReservation = NonNullable<OrderRecord['inventory_reservations']>[number];
export type OrderAftersale = NonNullable<OrderRecord['aftersales']>[number];
export type OrderPage = z.infer<typeof OrderPageSchema>;
