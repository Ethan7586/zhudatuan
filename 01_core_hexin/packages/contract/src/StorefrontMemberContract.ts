import * as z from 'zod/mini';

export const StorefrontMemberSchema = z.strictObject({
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
});

export const StorefrontMemberPageSchema = z.strictObject({
  items: z.array(StorefrontMemberSchema),
  count: z.int().check(z.nonnegative()),
  nextCursor: z.optional(z.string().check(z.minLength(1))),
});

export type StorefrontMember = z.infer<typeof StorefrontMemberSchema>;
export type StorefrontMemberPage = z.infer<typeof StorefrontMemberPageSchema>;
