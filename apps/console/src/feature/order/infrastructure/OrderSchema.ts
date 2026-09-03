import * as z from 'zod/mini';
import { DatabaseIntegerSchema } from '../../../shared/schema/DatabaseInteger';

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
  address: z.nullable(
    z.object({
      recipientMasked: z.string(),
      mobileMasked: z.string(),
      addressMasked: z.string(),
      regionCode: z.string(),
    })
  ),
  payment: z.object({
    paymentId: z.nullable(z.string()),
    capturedMinor: DatabaseIntegerSchema,
    refundedMinor: DatabaseIntegerSchema,
    refundableMinor: DatabaseIntegerSchema,
    updatedAt: z.nullable(z.string()),
    tenders: z.array(
      z.object({
        sequence: DatabaseIntegerSchema,
        kind: z.enum(['wechat', 'benefit', 'voucher']),
        referenceMasked: z.nullable(z.string()),
        amountMinor: DatabaseIntegerSchema,
        state: z.enum(['planned', 'held', 'captured', 'released']),
      })
    ),
  }),
  fulfillments: z.array(
    z.object({
      id: z.string(),
      provider: z.nullable(z.string()),
      partner: z.nullable(z.string()),
      kind: z.enum(['shipment', 'delivery', 'pickup', 'service', 'digital']),
      state: z.enum(['pending', 'submitted', 'accepted', 'processing', 'ready', 'completed', 'cancelled', 'failed']),
      externalReferenceMasked: z.nullable(z.string()),
      createdAt: z.string(),
      updatedAt: z.string(),
      milestones: z.array(z.object({ id: z.string(), kind: z.string(), state: z.string(), trackingMasked: z.nullable(z.string()), occurredAt: z.string() })),
    })
  ),
  refunds: z.array(
    z.object({
      id: z.string(),
      aftersaleId: z.nullable(z.string()),
      provider: z.string(),
      providerReferenceMasked: z.string(),
      amountMinor: DatabaseIntegerSchema,
      currency: z.string(),
      state: z.enum(['requested', 'submitted', 'processing', 'succeeded', 'failed', 'cancelled']),
      reason: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      tenders: z.array(
        z.object({
          sequence: DatabaseIntegerSchema,
          kind: z.enum(['wechat', 'benefit', 'voucher']),
          referenceMasked: z.nullable(z.string()),
          amountMinor: DatabaseIntegerSchema,
          state: z.enum(['planned', 'processing', 'succeeded', 'failed']),
        })
      ),
    })
  ),
  timeline: z.array(
    z.object({
      id: z.string(),
      action: z.string(),
      resourceType: z.string(),
      resourceMasked: z.nullable(z.string()),
      actorMasked: z.string(),
      occurredAt: z.string(),
      traceMasked: z.string(),
    })
  ),
  receivedAt: z.nullable(z.string()),
  created_at: z.string().check(z.minLength(1)),
  updated_at: z.string().check(z.minLength(1)),
  version: DatabaseIntegerSchema,
  lines: z.array(
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
    ),
});

export const OrderPageSchema = z
  .object({
    items: z.array(OrderSchema).check(z.maxLength(50)),
    count: z.int().check(z.nonnegative()),
    nextCursor: z.optional(z.string().check(z.minLength(1))),
  })
  .check(z.refine((page) => page.count === page.items.length, { message: 'ORDER_PAGE_COUNT_MISMATCH' }));
