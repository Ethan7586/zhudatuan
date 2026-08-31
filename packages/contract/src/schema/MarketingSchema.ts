import { null as nullSchema, strictObject, string, union } from 'zod/mini';
import { currency, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const campaign = strictObject({
  id: string(),
  kind: string(),
  name: string(),
  state: string(),
  budget_minor: unsigned,
  spent_minor: unsigned,
  currency,
  effective_at: isoUtc,
  expires_at: union([isoUtc, nullSchema()]),
  version,
  updated_at: isoUtc,
});
export const MARKETING_QUERY_SCHEMAS = { MarketingCampaignsReadInput: strictObject(pageQuery) } as const;
export const MARKETING_OUTPUT_SCHEMAS = { MarketingCampaignsReadOutput: pageOutput(campaign) } as const;
