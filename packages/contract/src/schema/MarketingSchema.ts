import { array, boolean, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { basisPoints, currency, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const audience = strictObject({ memberTags: array(string()), qualificationStates: array(string()) });
const products = strictObject({ productIds: array(string()), categoryIds: array(string()), listingIds: array(string()) });
const promotion = strictObject({
  priority: unsigned,
  fixedMinor: unsigned,
  basisPoints,
  minimumSubtotal: unsigned,
  maximumMinor: union([unsigned, nullSchema()]),
  stackable: boolean(),
  exclusiveGroup: string(),
});
const coupon = strictObject({
  perMemberLimit: unsigned,
  totalLimit: unsigned,
  claimStartsAt: isoUtc,
  claimEndsAt: isoUtc,
});
const rule = strictObject({
  audience,
  products,
  channels: array(literal(['web', 'miniapp', 'store'])),
  promotion,
  coupon: union([coupon, nullSchema()]),
});
const campaign = strictObject({
  id: string(),
  scope_id: string(),
  kind: literal(['discount', 'coupon', 'lottery', 'affiliate']),
  name: string(),
  state: literal(['draft', 'scheduled', 'active', 'disabled', 'completed']),
  budget_minor: unsigned,
  spent_minor: unsigned,
  available_minor: unsigned,
  currency,
  rule,
  effective_at: isoUtc,
  expires_at: union([isoUtc, nullSchema()]),
  version,
  budget_version: version,
  published_at: union([isoUtc, nullSchema()]),
  disabled_at: union([isoUtc, nullSchema()]),
  disable_reason: union([string(), nullSchema()]),
  created_by: string(),
  updated_by: string(),
  created_at: isoUtc,
  updated_at: isoUtc,
});
const campaignInput = {
  kind: literal(['discount', 'coupon', 'lottery', 'affiliate']),
  name: string(),
  budgetMinor: unsigned,
  currency,
  rule,
  effectiveAt: isoUtc,
  expiresAt: optional(union([isoUtc, nullSchema()])),
} as const;

export const MARKETING_QUERY_SCHEMAS = { MarketingCampaignsReadInput: strictObject(pageQuery) } as const;
export const MARKETING_BODY_SCHEMAS = {
  MarketingCampaignsCreateInput: strictObject(campaignInput),
  MarketingCampaignsReviseInput: strictObject(campaignInput),
  MarketingCampaignsPublishInput: strictObject({}),
  MarketingCampaignsDisableInput: strictObject({ reason: string() }),
} as const;
export const MARKETING_OUTPUT_SCHEMAS = {
  MarketingCampaignsReadOutput: pageOutput(campaign),
  MarketingCampaignsCreateOutput: campaign,
  MarketingCampaignsReviseOutput: campaign,
  MarketingCampaignsPublishOutput: campaign,
  MarketingCampaignsDisableOutput: campaign,
} as const;
