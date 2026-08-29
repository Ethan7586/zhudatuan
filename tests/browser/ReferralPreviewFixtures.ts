const scopeId = 'mall:console';
const now = '2026-08-29T08:00:00.000Z';

export const referralPreviewSetting = Object.freeze({
  id: 'referral-setting:preview',
  scope_id: scopeId,
  enabled: true,
  recruit_enabled: true,
  review_required: true,
  reward_enabled: true,
  binding_mode: 'permanent',
  binding_days: null,
  settle_trigger: 'on_received',
  settle_delay_days: 7,
  withdraw_min_minor: 5000,
  withdraw_monthly_max: 3,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: now,
  version: 4,
  persisted: true,
});

export const referralPreviewProducts = Object.freeze([
  product('coffee', 'COFFEE-01', '精品咖啡礼盒', 1200, 300, 2),
  product('fruit', 'FRUIT-08', '时令鲜果尊享卡', 1000, 200, 3),
  product('cake', 'CAKE-06', '生日蛋糕礼券', 800, 200, 1),
]);

export const referralPreviewMembers = Object.freeze([
  {
    id: 'referral-member:preview-lin', scope_id: scopeId, member_id: 'member:preview-lin', display_name: '林小雅',
    inviter_member_id: 'referral-member:preview-parent', inviter_profile_id: 'member:preview-parent', inviter_display_name: '王志明',
    state: 'pending', approved_by: null, approved_at: null, created_at: '2026-08-29T09:00:00.000Z',
    updated_at: '2026-08-29T09:00:00.000Z', version: 0,
  },
  {
    id: 'referral-member:preview-chen', scope_id: scopeId, member_id: 'member:preview-chen', display_name: '陈嘉怡',
    inviter_member_id: null, inviter_profile_id: null, inviter_display_name: null,
    state: 'pending', approved_by: null, approved_at: null, created_at: '2026-08-29T11:20:00.000Z',
    updated_at: '2026-08-29T11:20:00.000Z', version: 0,
  },
]);

export const referralPreviewBindings = Object.freeze([
  {
    id: 'referral-binding:preview-1', scope_id: scopeId, customer_member_id: 'member:customer-1', customer_display_name: '周女士',
    referral_member_id: 'referral-member:preview-a', referral_profile_id: 'member:preview-a', referral_display_name: '张敏',
    bound_at: '2026-08-18T17:30:00.000Z', expires_at: null, created_at: '2026-08-18T17:30:00.000Z',
    updated_at: '2026-08-18T17:30:00.000Z', version: 0,
  },
  {
    id: 'referral-binding:preview-2', scope_id: scopeId, customer_member_id: 'member:customer-2', customer_display_name: '李先生',
    referral_member_id: 'referral-member:preview-b', referral_profile_id: 'member:preview-b', referral_display_name: '王志明',
    bound_at: '2026-08-21T10:10:00.000Z', expires_at: null, created_at: '2026-08-21T10:10:00.000Z',
    updated_at: '2026-08-21T10:10:00.000Z', version: 0,
  },
]);

export const referralPreviewCommissions = Object.freeze([
  commission({
    id: 'referral-commission:preview-direct', beneficiary: '张敏', beneficiaryId: 'member:preview-a', kind: 'commission',
    amountMinor: 12000, rateBps: 1200, claimedMinor: 2000, withdrawableMinor: 10000, state: 'settled',
    orderLineId: 'line:preview-1', skuId: 'sku:coffee', settledAt: now,
  }),
  commission({
    id: 'referral-commission:preview-pending', beneficiary: '王志明', beneficiaryId: 'member:preview-b', kind: 'commission',
    amountMinor: 3600, rateBps: 1200, claimedMinor: 0, withdrawableMinor: 0, state: 'pending',
    orderLineId: 'line:preview-2', skuId: 'sku:fruit', settledAt: null,
  }),
  commission({
    id: 'referral-commission:preview-inviter', beneficiary: '上级邀请人', beneficiaryId: 'member:preview-parent', kind: 'reward',
    amountMinor: 3000, rateBps: 300, claimedMinor: 0, withdrawableMinor: 3000, state: 'settled',
    orderLineId: 'line:preview-1', skuId: 'sku:coffee', settledAt: now,
  }),
]);

function product(id: string, code: string, title: string, commissionBps: number, rewardBps: number, version: number) {
  return Object.freeze({
    id: `referral-product:${id}`, scope_id: scopeId, sku_id: `sku:${id}`, code, product_id: `product:${id}`,
    listing_id: `listing:${id}`, title, listing_status: 'published', commission_bps: commissionBps,
    reward_bps: rewardBps, enabled: true, created_at: '2026-08-01T00:00:00.000Z', updated_at: now, version,
  });
}

function commission(input: Readonly<{
  id: string; beneficiary: string; beneficiaryId: string; kind: 'commission' | 'reward'; amountMinor: number;
  rateBps: number; claimedMinor: number; withdrawableMinor: number; state: 'pending' | 'settled';
  orderLineId: string; skuId: string; settledAt: string | null;
}>) {
  return Object.freeze({
    id: input.id, scope_id: scopeId, order_id: 'order:202608290001', order_line_id: input.orderLineId,
    sku_id: input.skuId, beneficiary_member_id: input.beneficiaryId, beneficiary_display_name: input.beneficiary,
    kind: input.kind, currency: 'CNY', base_minor: 10000, rate_bps: input.rateBps, amount_minor: input.amountMinor,
    reversed_base_minor: 0, reversed_minor: 0, claimed_minor: input.claimedMinor, recovery_minor: 0,
    withdrawable_minor: input.withdrawableMinor, state: input.state, origin_event_id: `event:${input.id}`,
    setting_version: 4, product_version: 2, settle_trigger: 'on_received', settle_delay_days: 7,
    eligible_at: input.state === 'settled' ? now : '2026-09-05T08:00:00.000Z',
    journal_id: input.state === 'settled' ? `journal:${input.id}` : null, reversal_journal_id: null,
    reversal_event_id: null, settling_at: null, settled_at: input.settledAt, reversed_at: null,
    created_at: '2026-08-29T08:00:00.000Z', updated_at: now, version: 2,
  });
}
