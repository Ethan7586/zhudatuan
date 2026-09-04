import { DomainError } from '../../../../foundation/domain/DomainError';
import type { Campaign, CampaignSnapshot, MarketingChannel } from '../model/Campaign';

export interface CampaignContext {
  readonly channel: MarketingChannel;
  readonly memberTags: readonly string[];
  readonly qualificationStates: readonly string[];
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly listingIds: readonly string[];
  readonly at: Date;
}

export class CampaignPolicy {
  assertPublishable(campaign: Campaign, at: Date): void {
    const value = campaign.snapshot();
    if (value.expiresAt !== null && Date.parse(value.expiresAt) <= at.getTime()) invalid('expiresAt');
    if (value.budgetMinor <= value.spentMinor) invalid('budgetMinor');
    if (value.kind === 'coupon' && value.rule.coupon === null) invalid('coupon');
  }

  eligible(campaign: CampaignSnapshot, context: CampaignContext): boolean {
    if (!['active', 'scheduled'].includes(campaign.state)) return false;
    const now = context.at.getTime();
    if (now < Date.parse(campaign.effectiveAt) || (campaign.expiresAt !== null && now >= Date.parse(campaign.expiresAt))) return false;
    if (!campaign.rule.channels.includes(context.channel)) return false;
    if (!matches(campaign.rule.audience.memberTags, context.memberTags)) return false;
    if (!matches(campaign.rule.audience.qualificationStates, context.qualificationStates)) return false;
    const products = campaign.rule.products;
    return intersects(products.productIds, context.productIds) && intersects(products.categoryIds, context.categoryIds) && intersects(products.listingIds, context.listingIds);
  }
}

function matches(required: readonly string[], actual: readonly string[]): boolean {
  return required.length === 0 || required.every((value) => actual.includes(value));
}
function intersects(required: readonly string[], actual: readonly string[]): boolean {
  return required.length === 0 || required.some((value) => actual.includes(value));
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field: `campaign.${field}` });
}
