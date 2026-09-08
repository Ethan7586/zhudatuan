import { DomainError } from '../../../../platform/error/DomainError';
import { CouponRule, type CouponRuleSnapshot } from './CouponRule';
import { PromotionRule, type PromotionSnapshot } from './Promotion';

export type CampaignKind = 'discount' | 'coupon' | 'lottery' | 'affiliate';
export type CampaignState = 'draft' | 'scheduled' | 'active' | 'disabled' | 'completed';
export type MarketingChannel = 'web' | 'miniapp' | 'store';
export interface CampaignRule {
  readonly audience: Readonly<{ memberTags: readonly string[]; qualificationStates: readonly string[] }>;
  readonly products: Readonly<{ productIds: readonly string[]; categoryIds: readonly string[]; listingIds: readonly string[] }>;
  readonly channels: readonly MarketingChannel[];
  readonly promotion: PromotionSnapshot;
  readonly coupon: CouponRuleSnapshot | null;
}
export interface CampaignSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly kind: CampaignKind;
  readonly name: string;
  readonly state: CampaignState;
  readonly budgetMinor: number;
  readonly spentMinor: number;
  readonly budgetVersion: number;
  readonly currency: 'CNY';
  readonly rule: CampaignRule;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly version: number;
  readonly publishedAt: string | null;
  readonly disabledAt: string | null;
  readonly disableReason: string | null;
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
export type CampaignDraft = Omit<CampaignSnapshot, 'state' | 'spentMinor' | 'budgetVersion' | 'version' | 'publishedAt' | 'disabledAt' | 'disableReason' | 'createdAt' | 'updatedAt'>;
export type CampaignRevision = Pick<CampaignSnapshot, 'kind' | 'name' | 'budgetMinor' | 'currency' | 'rule' | 'effectiveAt' | 'expiresAt' | 'updatedBy'>;

export class Campaign {
  private constructor(private readonly value: CampaignSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static draft(input: CampaignDraft, at: Date): Campaign {
    const now = at.toISOString();
    return new Campaign(
      freeze({
        ...input,
        state: 'draft',
        spentMinor: 0,
        budgetVersion: 1,
        version: 1,
        publishedAt: null,
        disabledAt: null,
        disableReason: null,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  static restore(value: CampaignSnapshot): Campaign {
    return new Campaign(freeze(value));
  }

  revise(expectedVersion: number, revision: CampaignRevision, at: Date): Campaign {
    this.expect(expectedVersion);
    if (this.value.state !== 'draft' || revision.budgetMinor < this.value.spentMinor) invalid('state');
    return new Campaign(
      freeze({
        ...this.value,
        ...revision,
        effectiveAt: iso(revision.effectiveAt),
        expiresAt: revision.expiresAt === null ? null : iso(revision.expiresAt),
        version: this.value.version + 1,
        updatedAt: at.toISOString(),
      })
    );
  }

  publish(expectedVersion: number, actor: string, at: Date): Campaign {
    this.expect(expectedVersion);
    if (this.value.state !== 'draft' || actor === this.value.createdBy || (this.value.expiresAt !== null && Date.parse(this.value.expiresAt) <= at.getTime())) invalid('publication');
    return new Campaign(
      freeze({
        ...this.value,
        state: Date.parse(this.value.effectiveAt) > at.getTime() ? 'scheduled' : 'active',
        publishedAt: at.toISOString(),
        updatedBy: actor,
        updatedAt: at.toISOString(),
        version: this.value.version + 1,
      })
    );
  }

  disable(expectedVersion: number, actor: string, reason: string, at: Date): Campaign {
    this.expect(expectedVersion);
    if (!['draft', 'scheduled', 'active'].includes(this.value.state) || reason.trim().length < 4 || reason.trim().length > 500) invalid('disableReason');
    return new Campaign(
      freeze({
        ...this.value,
        state: 'disabled',
        disabledAt: at.toISOString(),
        disableReason: reason.trim(),
        updatedBy: actor,
        updatedAt: at.toISOString(),
        version: this.value.version + 1,
      })
    );
  }

  complete(at: Date): Campaign {
    if (!['scheduled', 'active'].includes(this.value.state) || this.value.expiresAt === null || Date.parse(this.value.expiresAt) > at.getTime()) return this;
    return new Campaign(freeze({ ...this.value, state: 'completed', updatedAt: at.toISOString(), version: this.value.version + 1 }));
  }

  snapshot(): CampaignSnapshot {
    return this.value;
  }

  private expect(expectedVersion: number): void {
    if (expectedVersion !== this.value.version) throw new DomainError('VERSION_CONFLICT');
  }
}

function validate(value: CampaignSnapshot): void {
  if (!/^campaign:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !value.scope) invalid('campaign');
  if (!['discount', 'coupon', 'lottery', 'affiliate'].includes(value.kind)) invalid('kind');
  if (value.name.trim().length < 2 || value.name.trim().length > 80) invalid('name');
  if (!['draft', 'scheduled', 'active', 'disabled', 'completed'].includes(value.state)) invalid('state');
  if (value.currency !== 'CNY' || !Number.isSafeInteger(value.budgetMinor) || value.budgetMinor < 1 || !Number.isSafeInteger(value.spentMinor) || value.spentMinor < 0 || value.spentMinor > value.budgetMinor) invalid('budget');
  if (!Number.isSafeInteger(value.version) || value.version < 1 || !Number.isSafeInteger(value.budgetVersion) || value.budgetVersion < 1) invalid('version');
  const effective = Date.parse(value.effectiveAt);
  const expires = value.expiresAt === null ? null : Date.parse(value.expiresAt);
  if (Number.isNaN(effective) || (expires !== null && (Number.isNaN(expires) || expires <= effective))) invalid('period');
  if (!value.createdBy || !value.updatedBy || Number.isNaN(Date.parse(value.createdAt)) || Number.isNaN(Date.parse(value.updatedAt))) invalid('audit');
  if ((value.state === 'scheduled' || value.state === 'active') && value.publishedAt === null) invalid('publishedAt');
  if (value.state === 'disabled' && (value.disabledAt === null || value.disableReason === null)) invalid('disabledAt');
  const channels = unique(value.rule.channels, ['web', 'miniapp', 'store']);
  if (channels.length === 0) invalid('channels');
  unique(value.rule.audience.memberTags);
  unique(value.rule.audience.qualificationStates);
  unique(value.rule.products.productIds);
  unique(value.rule.products.categoryIds);
  unique(value.rule.products.listingIds);
  PromotionRule.create(value.rule.promotion);
  if (value.kind === 'coupon' && value.rule.coupon === null) invalid('coupon');
  if (value.rule.coupon !== null) CouponRule.create(value.rule.coupon);
}

function freeze(value: CampaignSnapshot): CampaignSnapshot {
  const rule = value.rule;
  return Object.freeze({
    ...value,
    effectiveAt: iso(value.effectiveAt),
    expiresAt: value.expiresAt === null ? null : iso(value.expiresAt),
    rule: Object.freeze({
      audience: Object.freeze({ memberTags: Object.freeze([...rule.audience.memberTags]), qualificationStates: Object.freeze([...rule.audience.qualificationStates]) }),
      products: Object.freeze({ productIds: Object.freeze([...rule.products.productIds]), categoryIds: Object.freeze([...rule.products.categoryIds]), listingIds: Object.freeze([...rule.products.listingIds]) }),
      channels: Object.freeze([...rule.channels]),
      promotion: PromotionRule.create(rule.promotion).snapshot(),
      coupon: rule.coupon === null ? null : CouponRule.create(rule.coupon).snapshot(),
    }),
  });
}
function unique(values: readonly string[], allowed?: readonly string[]): readonly string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0) || new Set(values).size !== values.length || (allowed && values.some((value) => !allowed.includes(value)))) invalid('rule');
  return values;
}
function iso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid('period');
  return parsed.toISOString();
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field: `campaign.${field}` });
}
