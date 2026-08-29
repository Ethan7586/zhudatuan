import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

const TimestampSchema = z.string().min(1);
const NullableTimestampSchema = TimestampSchema.nullable();
const MemberStateSchema = z.enum(['pending', 'active', 'disqualified']);
const CommissionStateSchema = z.enum(['pending', 'settling', 'settled', 'reversed']);

export const ReferralSettingSchema = z
  .object({
    id: z.string().min(1),
    scope_id: z.string().min(1),
    enabled: z.boolean(),
    recruit_enabled: z.boolean(),
    review_required: z.boolean(),
    reward_enabled: z.boolean(),
    binding_mode: z.enum(['permanent', 'days']),
    binding_days: z.nullable(DatabaseIntegerSchema),
    settle_trigger: z.enum(['on_paid', 'on_received']),
    settle_delay_days: DatabaseIntegerSchema,
    withdraw_min_minor: DatabaseIntegerSchema,
    withdraw_monthly_max: z.nullable(DatabaseIntegerSchema),
    created_at: TimestampSchema.optional(),
    updated_at: TimestampSchema.optional(),
    version: DatabaseIntegerSchema,
    persisted: z.boolean().optional(),
  })
  .strict();

export const ReferralProductSchema = z
  .object({
    id: z.string().min(1),
    scope_id: z.string().min(1),
    sku_id: z.string().min(1),
    code: z.string().min(1),
    product_id: z.string().min(1),
    listing_id: z.string().min(1),
    title: z.string().min(1),
    listing_status: z.string().min(1),
    commission_bps: DatabaseIntegerSchema,
    reward_bps: DatabaseIntegerSchema,
    enabled: z.boolean(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
    version: DatabaseIntegerSchema,
  })
  .strict();

export const ReferralMemberSchema = z
  .object({
    id: z.string().min(1),
    scope_id: z.string().min(1),
    member_id: z.string().min(1),
    display_name: z.string().min(1),
    inviter_member_id: z.string().min(1).nullable(),
    inviter_profile_id: z.string().min(1).nullable(),
    inviter_display_name: z.string().min(1).nullable(),
    state: MemberStateSchema,
    approved_by: z.string().min(1).nullable(),
    approved_at: NullableTimestampSchema,
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
    version: DatabaseIntegerSchema,
  })
  .strict();

export const ReferralBindingSchema = z
  .object({
    id: z.string().min(1),
    scope_id: z.string().min(1),
    customer_member_id: z.string().min(1),
    customer_display_name: z.string().min(1),
    referral_member_id: z.string().min(1),
    referral_profile_id: z.string().min(1),
    referral_display_name: z.string().min(1),
    bound_at: TimestampSchema,
    expires_at: NullableTimestampSchema,
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
    version: DatabaseIntegerSchema,
  })
  .strict();

export const ReferralCommissionSchema = z
  .object({
    id: z.string().min(1),
    scope_id: z.string().min(1),
    order_id: z.string().min(1),
    order_line_id: z.string().min(1),
    sku_id: z.string().min(1),
    beneficiary_member_id: z.string().min(1),
    beneficiary_display_name: z.string().min(1),
    kind: z.enum(['commission', 'reward']),
    currency: z.string().length(3),
    base_minor: DatabaseIntegerSchema,
    rate_bps: DatabaseIntegerSchema,
    amount_minor: DatabaseIntegerSchema,
    reversed_base_minor: DatabaseIntegerSchema,
    reversed_minor: DatabaseIntegerSchema,
    claimed_minor: DatabaseIntegerSchema,
    recovery_minor: DatabaseIntegerSchema,
    withdrawable_minor: DatabaseIntegerSchema,
    state: CommissionStateSchema,
    origin_event_id: z.string().min(1),
    setting_version: DatabaseIntegerSchema,
    product_version: DatabaseIntegerSchema,
    settle_trigger: z.enum(['on_paid', 'on_received']),
    settle_delay_days: DatabaseIntegerSchema,
    eligible_at: NullableTimestampSchema,
    journal_id: z.string().min(1).nullable(),
    reversal_journal_id: z.string().min(1).nullable(),
    reversal_event_id: z.string().min(1).nullable(),
    settling_at: NullableTimestampSchema,
    settled_at: NullableTimestampSchema,
    reversed_at: NullableTimestampSchema,
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
    version: DatabaseIntegerSchema,
  })
  .strict();

export const ReferralProductPageSchema = pageEnvelope(ReferralProductSchema).strict();
export const ReferralMemberPageSchema = pageEnvelope(ReferralMemberSchema).strict();
export const ReferralBindingPageSchema = pageEnvelope(ReferralBindingSchema).strict();
export const ReferralCommissionPageSchema = pageEnvelope(ReferralCommissionSchema).strict();

export const ReferralMemberDecisionReceiptSchema = z
  .object({
    id: z.string().min(1),
    scope_id: z.string().min(1),
    member_id: z.string().min(1),
    inviter_member_id: z.string().min(1).nullable(),
    state: z.enum(['active', 'disqualified']),
    approved_by: z.string().min(1),
    approved_at: TimestampSchema,
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
    version: DatabaseIntegerSchema,
  })
  .strict();

export const referralViews = ['settings', 'products', 'review', 'bindings', 'withdrawals', 'promotion'] as const;
export type ReferralView = (typeof referralViews)[number];

export interface ReferralRecord {
  readonly id: string;
  readonly primary: string;
  readonly secondary: string;
  readonly state: string;
  readonly detail: string;
  readonly rate: string;
  readonly amountMinor: number | null;
  readonly withdrawableMinor: number | null;
  readonly currency: string;
  readonly occurredAt: string | null;
  readonly version: number;
}

export interface ReferralRecordPage {
  readonly items: readonly ReferralRecord[];
  readonly count: number;
  readonly nextCursor?: string;
}
