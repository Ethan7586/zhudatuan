import * as z from 'zod/mini';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';

const state = z.enum(['applied', 'reviewing', 'approved', 'returning', 'received', 'refunding', 'resolved', 'rejected']);
const nullableText = z.nullable(z.string());
const line = z.object({
  lineId: z.string(),
  skuId: z.string(),
  listingId: z.string(),
  title: z.string(),
  productType: z.string(),
  provider: nullableText,
  purchasedQuantity: DatabaseIntegerSchema,
  fulfilledQuantity: DatabaseIntegerSchema,
  claimedQuantity: DatabaseIntegerSchema,
  requestedQuantity: DatabaseIntegerSchema,
  maximumQuantity: DatabaseIntegerSchema,
  unitMinor: DatabaseIntegerSchema,
  refundMinor: DatabaseIntegerSchema,
  available: z.boolean(),
  unavailableReason: nullableText,
});

export const AfterSaleSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  state,
  reasonCode: z.string(),
  description: z.string(),
  currency: z.string(),
  expectedRefundMinor: DatabaseIntegerSchema,
  expectedRefund: z.object({ totalMinor: DatabaseIntegerSchema, currency: z.string(), tenders: z.array(z.object({ kind: z.string(), reference: nullableText, amountMinor: DatabaseIntegerSchema })) }),
  requiresReturn: z.boolean(),
  unavailableReason: nullableText,
  requestedBy: nullableText,
  createdAt: z.string(),
  updatedAt: z.string(),
  version: DatabaseIntegerSchema,
  lines: z.array(line),
  attachments: z.array(z.object({ objectId: z.string(), name: z.string(), mediaType: z.string(), sizeBytes: DatabaseIntegerSchema, contentHash: z.string() })),
  timeline: z.array(z.object({ sequence: DatabaseIntegerSchema, kind: z.string(), previousState: z.nullable(state), state, evidence: z.unknown(), occurredAt: z.string() })),
});

export const AfterSalePageSchema = z
  .object({
    items: z.array(AfterSaleSchema).check(z.maxLength(50)),
    count: z.int().check(z.nonnegative()),
    nextCursor: z.optional(z.string().check(z.minLength(1))),
    availableLines: z.array(z.unknown()),
  })
  .check(z.refine((page) => page.count === page.items.length, { message: 'AFTERSALE_PAGE_COUNT_MISMATCH' }));

export type AfterSaleRecord = z.infer<typeof AfterSaleSchema>;
