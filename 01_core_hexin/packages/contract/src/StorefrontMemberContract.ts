import * as z from 'zod/mini';

const storefrontMemberFields = {
  membership_id: z.string().check(z.minLength(1)),
  display_name: z.string().check(z.minLength(1)),
  mobile_masked: z.string().check(
    z.minLength(1),
    z.refine((value) => value.includes('*'), { error: 'MASKED_MOBILE_REQUIRED' }),
  ),
  identity_level: z.enum(['L6', 'L7', 'L8', 'L9', 'L10', 'L11']),
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

export const StorefrontMemberParentSchema = z.strictObject({
  kind: z.enum(['mall', 'member']),
  display_name: z.string().check(z.minLength(1)),
  identity_level: z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10']),
});

export const StorefrontMemberDetailSchema = z.strictObject({
  ...storefrontMemberFields,
  parent: StorefrontMemberParentSchema,
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
  identity_level: z.enum(['L7', 'L8', 'L9', 'L10', 'L11']),
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

export const StorefrontMemberTagColorSchema = z.enum(['blue', 'purple', 'green', 'orange', 'pink', 'gray']);
export const StorefrontMemberFieldTypeSchema = z.enum(['text', 'number', 'date', 'select', 'multiselect', 'switch', 'remark']);

export const StorefrontMemberCustomTagSchema = z.strictObject({
  id: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
  color: StorefrontMemberTagColorSchema,
  sort_order: z.int().check(z.nonnegative()),
  enabled: z.boolean(),
});

export const StorefrontMemberCustomFieldSchema = z.strictObject({
  id: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
  type: StorefrontMemberFieldTypeSchema,
  options: z.array(z.string().check(z.minLength(1))),
  sort_order: z.int().check(z.nonnegative()),
  enabled: z.boolean(),
});

export const StorefrontMemberProfileConfigSchema = z.strictObject({
  tags: z.array(StorefrontMemberCustomTagSchema),
  fields: z.array(StorefrontMemberCustomFieldSchema),
});

export const StorefrontMemberSystemTagSchema = z.strictObject({
  code: z.string().check(z.minLength(1)),
  name: z.string().check(z.minLength(1)),
});

export const StorefrontMemberCustomFieldValueSchema = z.strictObject({
  field_id: z.string().check(z.minLength(1)),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
});

export const StorefrontMemberCustomProfileUpdateSchema = z.strictObject({
  custom_tag_ids: z.array(z.string().check(z.minLength(1))),
  custom_field_values: z.array(StorefrontMemberCustomFieldValueSchema),
});

export const StorefrontMemberCustomProfileSchema = z.strictObject({
  system_tags: z.array(StorefrontMemberSystemTagSchema),
  ...StorefrontMemberCustomProfileUpdateSchema.shape,
});

export type StorefrontMember = z.infer<typeof StorefrontMemberSchema>;
export type StorefrontMemberPage = z.infer<typeof StorefrontMemberPageSchema>;
export type StorefrontMemberDetail = z.infer<typeof StorefrontMemberDetailSchema>;
export type StorefrontMemberInvitee = z.infer<typeof StorefrontMemberInviteeSchema>;
export type StorefrontMemberInviteePage = z.infer<typeof StorefrontMemberInviteePageSchema>;
export type StorefrontMemberOrder = z.infer<typeof StorefrontMemberOrderSchema>;
export type StorefrontMemberOrderPage = z.infer<typeof StorefrontMemberOrderPageSchema>;
export type StorefrontMemberTagColor = z.infer<typeof StorefrontMemberTagColorSchema>;
export type StorefrontMemberFieldType = z.infer<typeof StorefrontMemberFieldTypeSchema>;
export type StorefrontMemberCustomTag = z.infer<typeof StorefrontMemberCustomTagSchema>;
export type StorefrontMemberCustomField = z.infer<typeof StorefrontMemberCustomFieldSchema>;
export type StorefrontMemberProfileConfig = z.infer<typeof StorefrontMemberProfileConfigSchema>;
export type StorefrontMemberSystemTag = z.infer<typeof StorefrontMemberSystemTagSchema>;
export type StorefrontMemberCustomFieldValue = z.infer<typeof StorefrontMemberCustomFieldValueSchema>;
export type StorefrontMemberCustomProfileUpdate = z.infer<typeof StorefrontMemberCustomProfileUpdateSchema>;
export type StorefrontMemberCustomProfile = z.infer<typeof StorefrontMemberCustomProfileSchema>;
