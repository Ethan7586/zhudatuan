import { Money } from '@shop/kernel';

export class CheckoutPolicy {
  assertVersions(expected: Readonly<Record<string, number>>, actual: Readonly<Record<string, number>>): void {
    for (const [key, version] of Object.entries(expected)) if (actual[key] !== version) throw new Error(`CHECKOUT_VERSION_CONFLICT:${key}`);
  }

  promotionDiscount(subtotal: Money, campaigns: readonly CampaignRule[]): Readonly<{ amount: Money; evidence: readonly CampaignEvidence[] }> {
    const candidates = campaigns.flatMap((campaign) => {
      if (campaign.minimumSubtotal.minor > subtotal.minor || campaign.remainingBudget.minor <= 0) return [];
      const proportional = subtotal.multiplyRatio(campaign.basisPoints, 10_000);
      const amount = Money.of(Math.min(subtotal.minor, campaign.remainingBudget.minor, campaign.maximum?.minor ?? Number.MAX_SAFE_INTEGER, Math.max(0, campaign.fixed.add(proportional).minor)), subtotal.currency.code);
      return amount.minor === 0 ? [] : [{ ...campaign, amount }];
    });
    const stackable = candidates.filter(({ stackable }) => stackable);
    const exclusive = candidates
      .filter(({ stackable }) => !stackable)
      .sort((left, right) => right.amount.minor - left.amount.minor || left.id.localeCompare(right.id))
      .slice(0, 1);
    const selected = [...exclusive, ...uniqueGroups(stackable)].sort((left, right) => left.id.localeCompare(right.id));
    const amount = Money.of(
      Math.min(
        subtotal.minor,
        selected.reduce((sum, item) => sum + item.amount.minor, 0)
      ),
      subtotal.currency.code
    );
    return Object.freeze({ amount, evidence: Object.freeze(selected.map(({ id, version, amount: discount }) => Object.freeze({ id, version, discount: discount.minor }))) });
  }

  allocateTenders(total: Money, vouchers: readonly ValueChoice[], benefits: readonly ValueChoice[]): Readonly<{ tenders: readonly TenderAllocation[]; personal: Money }> {
    let remaining = total;
    const tenders: TenderAllocation[] = [];
    for (const value of [...vouchers].sort(byId)) {
      const amount = Money.of(Math.min(remaining.minor, value.amount.minor), total.currency.code);
      if (amount.minor > 0) tenders.push({ kind: 'voucher', reference: value.id, amount });
      remaining = remaining.subtract(amount);
    }
    for (const value of [...benefits].sort(byId)) {
      const amount = Money.of(Math.min(remaining.minor, value.amount.minor), total.currency.code);
      if (amount.minor > 0) tenders.push({ kind: 'benefit', reference: value.id, amount });
      remaining = remaining.subtract(amount);
    }
    if (remaining.minor > 0) tenders.push({ kind: 'wechat', reference: null, amount: remaining });
    return Object.freeze({ tenders: Object.freeze(tenders), personal: remaining });
  }
}

export interface CampaignRule {
  readonly id: string;
  readonly version: number;
  readonly fixed: Money;
  readonly basisPoints: number;
  readonly minimumSubtotal: Money;
  readonly maximum: Money | null;
  readonly remainingBudget: Money;
  readonly stackable: boolean;
  readonly group: string;
}

export interface CampaignEvidence {
  readonly id: string;
  readonly version: number;
  readonly discount: number;
}
export interface ValueChoice {
  readonly id: string;
  readonly amount: Money;
}
export interface TenderAllocation {
  readonly kind: 'voucher' | 'benefit' | 'wechat';
  readonly reference: string | null;
  readonly amount: Money;
}

function uniqueGroups(values: readonly (CampaignRule & { readonly amount: Money })[]): readonly (CampaignRule & { readonly amount: Money })[] {
  const result = new Map<string, CampaignRule & { readonly amount: Money }>();
  for (const value of values) {
    const prior = result.get(value.group);
    if (!prior || value.amount.minor > prior.amount.minor || (value.amount.minor === prior.amount.minor && value.id < prior.id)) result.set(value.group, value);
  }
  return [...result.values()];
}

function byId(left: ValueChoice, right: ValueChoice): number {
  return left.id.localeCompare(right.id);
}
