import { literal, optional, strictObject, string } from 'zod/mini';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const partner = strictObject({ id: string(), scope_id: string(), kind: string(), name: string(), status: string(), version, created_at: isoUtc, updated_at: isoUtc });

export const PARTNER_QUERY_SCHEMAS = { PartnerPartnersReadInput: strictObject(pageQuery) } as const;
export const PARTNER_BODY_SCHEMAS = {
  PartnerPartnersManageInput: strictObject({ kind: string(), name: string(), status: optional(literal(['active', 'suspended'])) }),
} as const;
export const PARTNER_OUTPUT_SCHEMAS = {
  PartnerPartnersReadOutput: pageOutput(partner),
  PartnerPartnersManageOutput: partner,
} as const;
