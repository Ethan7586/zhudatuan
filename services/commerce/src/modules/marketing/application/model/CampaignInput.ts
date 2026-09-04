import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CampaignKind, CampaignRevision, CampaignRule, MarketingChannel } from '../../domain/model/Campaign';

export function campaignRevision(value: Readonly<Record<string, unknown>>, actor: string): CampaignRevision {
  return Object.freeze({
    kind: kind(value.kind),
    name: text(value.name, 'name'),
    budgetMinor: integer(value.budgetMinor, 'budgetMinor'),
    currency: currency(value.currency),
    rule: rule(value.rule),
    effectiveAt: text(value.effectiveAt, 'effectiveAt'),
    expiresAt: value.expiresAt === undefined || value.expiresAt === null ? null : text(value.expiresAt, 'expiresAt'),
    updatedBy: actor,
  });
}

function rule(value: unknown): CampaignRule {
  const source = object(value, 'rule');
  const audience = object(source.audience, 'rule.audience');
  const products = object(source.products, 'rule.products');
  const promotion = object(source.promotion, 'rule.promotion');
  const coupon = source.coupon === null ? null : object(source.coupon, 'rule.coupon');
  return Object.freeze({
    audience: Object.freeze({ memberTags: strings(audience.memberTags, 'memberTags'), qualificationStates: strings(audience.qualificationStates, 'qualificationStates') }),
    products: Object.freeze({ productIds: strings(products.productIds, 'productIds'), categoryIds: strings(products.categoryIds, 'categoryIds'), listingIds: strings(products.listingIds, 'listingIds') }),
    channels: strings(source.channels, 'channels').map(channel),
    promotion: Object.freeze({
      priority: integer(promotion.priority, 'priority'),
      fixedMinor: integer(promotion.fixedMinor, 'fixedMinor'),
      basisPoints: integer(promotion.basisPoints, 'basisPoints'),
      minimumSubtotal: integer(promotion.minimumSubtotal, 'minimumSubtotal'),
      maximumMinor: promotion.maximumMinor === null ? null : integer(promotion.maximumMinor, 'maximumMinor'),
      stackable: boolean(promotion.stackable, 'stackable'),
      exclusiveGroup: text(promotion.exclusiveGroup, 'exclusiveGroup'),
    }),
    coupon:
      coupon === null
        ? null
        : Object.freeze({
            perMemberLimit: integer(coupon.perMemberLimit, 'perMemberLimit'),
            totalLimit: integer(coupon.totalLimit, 'totalLimit'),
            claimStartsAt: text(coupon.claimStartsAt, 'claimStartsAt'),
            claimEndsAt: text(coupon.claimEndsAt, 'claimEndsAt'),
          }),
  });
}
function kind(value: unknown): CampaignKind {
  if (value === 'discount' || value === 'coupon' || value === 'lottery' || value === 'affiliate') return value;
  return invalid('kind');
}
function currency(value: unknown): 'CNY' {
  if (value !== 'CNY') return invalid('currency');
  return value;
}
function channel(value: string): MarketingChannel {
  if (value === 'web' || value === 'miniapp' || value === 'store') return value;
  return invalid('channel');
}
function object(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid(field);
  return value as Readonly<Record<string, unknown>>;
}
function strings(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return invalid(field);
  return Object.freeze([...value]);
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) return invalid(field);
  return value.trim();
}
function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) return invalid(field);
  return Number(value);
}
function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') return invalid(field);
  return value;
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
