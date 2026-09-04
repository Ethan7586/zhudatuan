import { literal, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const qualification = strictObject({
  valid: number(),
  pending: number(),
  rejected: number(),
  expired: number(),
  nearest_expiry: union([isoUtc, nullSchema()]),
});
const partner = strictObject({
  id: string(),
  scope_id: string(),
  kind: literal(['supplier', 'brand', 'store']),
  name: string(),
  status: literal(['pending', 'active', 'suspended', 'terminated']),
  version,
  qualification,
  created_at: isoUtc,
  updated_at: isoUtc,
});

export const PARTNER_QUERY_SCHEMAS = { PartnerPartnersReadInput: strictObject({ ...pageQuery, kind: optional(literal(['supplier', 'brand', 'store'])) }) } as const;
export const PARTNER_BODY_SCHEMAS = {
  PartnerPartnersManageInput: strictObject({ kind: literal(['supplier', 'brand']), name: string(), status: optional(literal(['pending', 'active', 'suspended', 'terminated'])) }),
} as const;
export const PARTNER_OUTPUT_SCHEMAS = {
  PartnerPartnersReadOutput: pageOutput(partner),
  PartnerPartnersManageOutput: partner,
} as const;
