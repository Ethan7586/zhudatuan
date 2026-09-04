import { boolean, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { importCreated, importInput, importRead } from './ImportSchema';
import { isoUtc, pageOutput, pageQuery, version } from './Primitives';

const member = strictObject({
  id: string(),
  display_name: string(),
  status: string(),
  membership_id: string(),
  organization_id: string(),
  employee_no: union([string(), nullSchema()]),
  membership_status: string(),
  access_version: version,
  joined_at: isoUtc,
  login_identity_bound: boolean(),
  registration_reset_allowed: boolean(),
  registration_reset_block_reason: union([literal(['self', 'protected', 'inactive', 'unbound']), nullSchema()]),
});
const address = strictObject({
  id: string(),
  recipient_masked: string(),
  mobile_masked: string(),
  address_masked: string(),
  region_code: string(),
  is_default: boolean(),
  status: literal(['active', 'deleted']),
  version,
});
const favorite = strictObject({
  listingId: string(),
  createdAt: isoUtc,
  version,
  available: boolean(),
  unavailableReason: union([string(), nullSchema()]),
});
export const MEMBER_QUERY_SCHEMAS = {
  MemberMembersReadInput: strictObject(pageQuery),
  MemberProfileReadInput: strictObject({}),
  MemberAddressesReadInput: strictObject(pageQuery),
  MemberFavoritesReadInput: strictObject(pageQuery),
  MemberImportsReadInput: strictObject({}),
} as const;
export const MEMBER_BODY_SCHEMAS = {
  MemberAddressesManageInput: union([
    strictObject({ status: literal('deleted') }),
    strictObject({ status: optional(literal('active')), recipient: string(), mobile: string(), address: string(), region: string(), is_default: optional(boolean()) }),
  ]),
  MemberFavoritesPutInput: strictObject({ favorite: boolean() }),
  MemberImportsCreateInput: importInput,
} as const;
export const MEMBER_OUTPUT_SCHEMAS = {
  MemberMembersReadOutput: pageOutput(member),
  MemberProfileReadOutput: strictObject({
    id: string(),
    display_name: string(),
    status: string(),
    mobile_bound: boolean(),
    membership_id: string(),
    organization_id: string(),
    employee_no: union([string(), nullSchema()]),
    joined_at: isoUtc,
    access_version: version,
    locale: string(),
    timezone: string(),
    marketing_allowed: boolean(),
    preference_version: version,
  }),
  MemberAddressesReadOutput: pageOutput(address),
  MemberAddressesManageOutput: union([address, strictObject({ id: string(), status: literal('deleted'), version })]),
  MemberFavoritesReadOutput: pageOutput(favorite),
  MemberFavoritesPutOutput: strictObject({ listingId: string(), favorite: boolean(), createdAt: union([isoUtc, nullSchema()]), version }),
  MemberImportsCreateOutput: importCreated,
  MemberImportsReadOutput: importRead,
} as const;
