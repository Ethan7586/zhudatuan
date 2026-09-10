import * as z from 'zod/mini';

const storefrontMemberFields = {
  membership_id: z.string().check(z.minLength(1)),
  display_name: z.string().check(z.minLength(1)),
  mobile_masked: z.string().check(
    z.minLength(1),
    z.refine((value) => value.includes('*'), { error: 'MASKED_MOBILE_REQUIRED' }),
  ),
  identity_level: z.literal('L6'),
  identity_kind: z.literal('consumer'),
  membership_status: z.enum(['invited', 'active', 'suspended', 'left']),
  mobile_bound: z.boolean(),
  wechat_bound: z.boolean(),
  joined_at: z.nullable(z.string().check(z.minLength(1))),
} as const;

export const StorefrontMemberSchema = z.strictObject(storefrontMemberFields);

export const StorefrontMemberPageSchema = z.strictObject({
  items: z.array(StorefrontMemberSchema),
  count: z.int().check(z.nonnegative()),
  nextCursor: z.optional(z.string().check(z.minLength(1))),
});

export const StorefrontMemberInviterSchema = z.strictObject({
  display_name: z.string().check(z.minLength(1)),
  mobile_masked: z.string().check(z.minLength(1)),
  bound_at: z.string().check(z.minLength(1)),
  expires_at: z.nullable(z.string().check(z.minLength(1))),
  relationship_status: z.enum(['active', 'expired']),
});

export const StorefrontMemberDetailSchema = z.strictObject({
  ...storefrontMemberFields,
  inviter: z.nullable(StorefrontMemberInviterSchema),
  invited_count: z.int().check(z.nonnegative()),
  order_count: z.int().check(z.nonnegative()),
  latest_order_at: z.nullable(z.string().check(z.minLength(1))),
});

export const StorefrontMemberInviteeSchema = z.strictObject({
  membership_id: z.string().check(z.minLength(1)),
  display_name: z.string().check(z.minLength(1)),
  mobile_masked: z.string().check(z.minLength(1)),
  membership_status: z.enum(['invited', 'active', 'suspended', 'left']),
  bound_at: z.string().check(z.minLength(1)),
  expires_at: z.nullable(z.string().check(z.minLength(1))),
  relationship_status: z.enum(['active', 'expired']),
});

export const StorefrontMemberInviteePageSchema = z.strictObject({
  items: z.array(StorefrontMemberInviteeSchema),
  count: z.int().check(z.nonnegative()),
  nextCursor: z.optional(z.string().check(z.minLength(1))),
});

export const StorefrontMemberOrderSchema = z.strictObject({
  id: z.string().check(z.minLength(1)),
  order_number: z.string().check(z.minLength(1)),
  total_minor: z.string().check(z.regex(/^\d+$/)),
  currency: z.string().check(z.length(3)),
  payment_state: z.enum(['unpaid', 'authorizing', 'paid', 'partially_refunded', 'refunded', 'failed']),
  fulfillment_state: z.enum(['unallocated', 'allocated', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
  aftersale_state: z.enum(['none', 'requested', 'processing', 'resolved', 'rejected']),
  created_at: z.string().check(z.minLength(1)),
});

export const StorefrontMemberOrderPageSchema = z.strictObject({
  items: z.array(StorefrontMemberOrderSchema),
  count: z.int().check(z.nonnegative()),
  nextCursor: z.optional(z.string().check(z.minLength(1))),
});

export type StorefrontMember = z.infer<typeof StorefrontMemberSchema>;
export type StorefrontMemberPage = z.infer<typeof StorefrontMemberPageSchema>;
export type StorefrontMemberDetail = z.infer<typeof StorefrontMemberDetailSchema>;
export type StorefrontMemberInvitee = z.infer<typeof StorefrontMemberInviteeSchema>;
export type StorefrontMemberInviteePage = z.infer<typeof StorefrontMemberInviteePageSchema>;
export type StorefrontMemberOrder = z.infer<typeof StorefrontMemberOrderSchema>;
export type StorefrontMemberOrderPage = z.infer<typeof StorefrontMemberOrderPageSchema>;
