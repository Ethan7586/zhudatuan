import { describe, expect, it } from 'vitest';
import { Budget } from './model/Budget';
import { Campaign, type CampaignDraft, type CampaignRule } from './model/Campaign';
import { CouponRule } from './model/CouponRule';
import { PromotionRule } from './model/Promotion';
import { CampaignPolicy } from './policy/CampaignPolicy';
import { PromotionStacking } from './policy/PromotionStacking';

const now = new Date('2026-09-05T08:00:00.000Z');

describe('Marketing domain', () => {
  it('publishes with maker-checker separation and preserves the exact rule version', () => {
    const draft = campaign();
    expect(() => draft.publish(1, 'principal:maker', now)).toThrow();
    const published = draft.publish(1, 'principal:checker', now).snapshot();
    expect(published).toMatchObject({ state: 'active', version: 2, budgetVersion: 1, publishedAt: now.toISOString(), updatedBy: 'principal:checker' });
    expect(() => draft.publish(2, 'principal:checker', now)).toThrow('VERSION_CONFLICT');
  });

  it('uses one policy for scope-adjacent audience, product, channel and effective-period eligibility', () => {
    const active = campaign().publish(1, 'principal:checker', now).snapshot();
    const policy = new CampaignPolicy();
    expect(policy.eligible(active, context())).toBe(true);
    expect(policy.eligible(active, { ...context(), channel: 'store' })).toBe(false);
    expect(policy.eligible(active, { ...context(), memberTags: [] })).toBe(false);
    expect(policy.eligible(active, { ...context(), productIds: ['product:two'] })).toBe(false);
    expect(policy.eligible(active, { ...context(), at: new Date('2026-10-01T00:00:00.000Z') })).toBe(false);
  });

  it('selects the highest-priority winner per group and applies only explicitly stackable groups', () => {
    const selected = new PromotionStacking().select([candidate('campaign:late', 20, 'season', true, 500), candidate('campaign:first', 10, 'season', true, 300), candidate('campaign:member', 30, 'member', true, 200)]);
    expect(selected.map(({ id }) => id)).toEqual(['campaign:first', 'campaign:member']);
    expect(new PromotionStacking().select([candidate('campaign:exclusive', 1, 'exclusive', false, 100), ...selected]).map(({ id }) => id)).toEqual(['campaign:exclusive']);
  });

  it('bounds discounts by subtotal, campaign availability and maximum adjustment', () => {
    const promotion = PromotionRule.create({ ...rule().promotion, fixedMinor: 100, basisPoints: 1000, maximumMinor: 500 });
    expect(promotion.discount(10_000, 300)).toBe(300);
    expect(promotion.discount(10_000, 2_000)).toBe(500);
    expect(promotion.discount(500, 2_000)).toBe(0);
  });

  it('reserves and replenishes integer budget atomically by concurrent version', () => {
    const budget = Budget.restore({ campaign: 'campaign:one', limitMinor: 1_000, spentMinor: 200, version: 3 });
    expect(budget.reserve(300).snapshot()).toEqual({ campaign: 'campaign:one', limitMinor: 1_000, spentMinor: 500, version: 4 });
    expect(budget.replenish(100).snapshot()).toEqual({ campaign: 'campaign:one', limitMinor: 1_000, spentMinor: 100, version: 4 });
    expect(() => budget.reserve(801)).toThrow('MARKETING_BUDGET_CONFLICT');
  });

  it('keeps coupon claims and campaign disablement as separate lifecycle decisions', () => {
    const coupon = CouponRule.create({ perMemberLimit: 1, totalLimit: 100, claimStartsAt: '2026-09-01T00:00:00.000Z', claimEndsAt: '2026-09-30T00:00:00.000Z' });
    expect(coupon.claimable(0, 99, now)).toBe(true);
    expect(coupon.claimable(1, 99, now)).toBe(false);
    const disabled = campaign().publish(1, 'principal:checker', now).disable(2, 'principal:operator', '活动预算策略调整', now).snapshot();
    expect(disabled).toMatchObject({ state: 'disabled', version: 3, disableReason: '活动预算策略调整' });
  });
});

function campaign(): Campaign {
  const input: CampaignDraft = {
    id: 'campaign:one',
    scope: 'mall:one',
    kind: 'discount',
    name: '新客立减',
    budgetMinor: 10_000,
    currency: 'CNY',
    rule: rule(),
    effectiveAt: '2026-09-01T00:00:00.000Z',
    expiresAt: '2026-09-30T00:00:00.000Z',
    createdBy: 'principal:maker',
    updatedBy: 'principal:maker',
  };
  return Campaign.draft(input, new Date('2026-08-31T00:00:00.000Z'));
}

function rule(): CampaignRule {
  return {
    audience: { memberTags: ['new'], qualificationStates: ['approved'] },
    products: { productIds: ['product:one'], categoryIds: [], listingIds: [] },
    channels: ['web'],
    promotion: { priority: 10, fixedMinor: 200, basisPoints: 0, minimumSubtotal: 1_000, maximumMinor: 500, stackable: true, exclusiveGroup: 'welcome' },
    coupon: null,
  };
}

function context() {
  return { channel: 'web' as const, memberTags: ['new'], qualificationStates: ['approved'], productIds: ['product:one'], categoryIds: [], listingIds: [], at: now };
}

function candidate(id: string, priority: number, group: string, stackable: boolean, discountMinor: number) {
  return { value: id, id, priority, group, stackable, discountMinor };
}
