export const CHECKOUT_LOCK_ORDER = Object.freeze(['idempotency', 'quote', 'qualification', 'price', 'inventory', 'voucher', 'benefit', 'order', 'outbox'] as const);

export class CheckoutPolicy {
  assertVersions(expected: Readonly<Record<string, number>>, actual: Readonly<Record<string, number>>): void {
    for (const [key, version] of Object.entries(expected)) if (actual[key] !== version) throw new Error(`CHECKOUT_VERSION_CONFLICT:${key}`);
  }

  promotionDiscount(subtotal: number, campaigns: readonly CampaignRule[]): Readonly<{ amount: number; evidence: readonly CampaignEvidence[] }> {
    const candidates = campaigns.flatMap((campaign) => {
      if (campaign.minimumSubtotal > subtotal || campaign.remainingBudget <= 0) return [];
      const proportional = Math.floor(subtotal * campaign.basisPoints / 10_000);
      const amount = Math.min(subtotal, campaign.remainingBudget, campaign.maximumMinor ?? Number.MAX_SAFE_INTEGER,
        Math.max(0, campaign.fixedMinor + proportional));
      return amount === 0 ? [] : [{ ...campaign, amount }];
    });
    const stackable = candidates.filter(({ stackable }) => stackable);
    const exclusive = candidates.filter(({ stackable }) => !stackable).sort((left, right) => right.amount - left.amount || left.id.localeCompare(right.id)).slice(0, 1);
    const selected = [...exclusive, ...uniqueGroups(stackable)].sort((left, right) => left.id.localeCompare(right.id));
    const amount = Math.min(subtotal, selected.reduce((sum, item) => sum + item.amount, 0));
    return Object.freeze({ amount, evidence: Object.freeze(selected.map(({ id, version, amount: discount }) => Object.freeze({ id, version, discount }))) });
  }

  allocateTenders(total: number, vouchers: readonly ValueChoice[], benefits: readonly ValueChoice[]): Readonly<{ tenders: readonly TenderAllocation[]; personal: number }> {
    let remaining = total;
    const tenders: TenderAllocation[] = [];
    for (const value of [...vouchers].sort(byId)) {
      const amount = Math.min(remaining, value.amount);
      if (amount > 0) tenders.push({ kind: 'voucher', reference: value.id, amount });
      remaining -= amount;
    }
    for (const value of [...benefits].sort(byId)) {
      const amount = Math.min(remaining, value.amount);
      if (amount > 0) tenders.push({ kind: 'benefit', reference: value.id, amount });
      remaining -= amount;
    }
    if (remaining > 0) tenders.push({ kind: 'wechat', reference: null, amount: remaining });
    return Object.freeze({ tenders: Object.freeze(tenders), personal: remaining });
  }
}

export interface CampaignRule {
  readonly id: string;
  readonly version: number;
  readonly fixedMinor: number;
  readonly basisPoints: number;
  readonly minimumSubtotal: number;
  readonly maximumMinor: number | null;
  readonly remainingBudget: number;
  readonly stackable: boolean;
  readonly group: string;
}

export interface CampaignEvidence { readonly id: string; readonly version: number; readonly discount: number }
export interface ValueChoice { readonly id: string; readonly amount: number }
export interface TenderAllocation { readonly kind: 'voucher' | 'benefit' | 'wechat'; readonly reference: string | null; readonly amount: number }

function uniqueGroups(values: readonly (CampaignRule & { readonly amount: number })[]): readonly (CampaignRule & { readonly amount: number })[] {
  const result = new Map<string, CampaignRule & { readonly amount: number }>();
  for (const value of values) {
    const prior = result.get(value.group);
    if (!prior || value.amount > prior.amount || value.amount === prior.amount && value.id < prior.id) result.set(value.group, value);
  }
  return [...result.values()];
}

function byId(left: ValueChoice, right: ValueChoice): number { return left.id.localeCompare(right.id); }
