import { boolean, literal, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const store = strictObject({
  id: string(),
  scope: string(),
  name: string(),
  status: literal(['pending', 'active', 'suspended', 'terminated']),
  version,
  mall: union([string(), nullSchema()]),
  regionCode: string(),
  serviceRadiusMeters: union([number(), nullSchema()]),
  addressConfigured: boolean(),
});
const stored = strictObject({ ...store.shape, createdAt: isoUtc, updatedAt: isoUtc });

export const ORGANIZATION_QUERY_SCHEMAS = { OrganizationStoresReadInput: strictObject(pageQuery) } as const;
export const ORGANIZATION_BODY_SCHEMAS = {
  OrganizationStoresManageInput: strictObject({
    name: string(),
    status: literal(['pending', 'active', 'suspended', 'terminated']),
    regionCode: string(),
    mall: optional(union([string(), nullSchema()])),
    serviceRadiusMeters: optional(union([number(), nullSchema()])),
    address: optional(union([string(), nullSchema()])),
  }),
} as const;
export const ORGANIZATION_OUTPUT_SCHEMAS = {
  OrganizationStoresReadOutput: pageOutput(stored),
  OrganizationStoresManageOutput: store,
} as const;
