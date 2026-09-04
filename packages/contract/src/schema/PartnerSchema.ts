import { array, literal, null as nullSchema, number, optional, strictObject, string, union } from 'zod/mini';
import { id, isoUtc, pageOutput, pageQuery, version } from './Primitives';

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

const contactInput = strictObject({
  kind: optional(literal(['primary', 'billing', 'operations'])),
  name: string(),
  phone: optional(string()),
  email: optional(string()),
});
const agreementInput = strictObject({
  contractRef: string(),
  contractHash: string(),
  capabilities: array(string()),
  effectiveAt: isoUtc,
  expiresAt: isoUtc,
});
const contact = strictObject({
  id: id<'customercontact'>(),
  kind: literal(['primary', 'billing', 'operations']),
  nameMasked: string(),
  phoneMasked: union([string(), nullSchema()]),
  emailMasked: union([string(), nullSchema()]),
  configured: literal([true]),
  version,
});
const agreement = strictObject({
  id: id<'customeragreement'>(),
  contractRef: string(),
  contractHash: string(),
  capabilities: array(string()),
  status: literal(['draft', 'active', 'expired', 'terminated']),
  effectiveAt: isoUtc,
  expiresAt: isoUtc,
  version,
});
const customer = strictObject({
  id: id<'partnercustomer'>(),
  scopeId: string(),
  identifierMasked: string(),
  name: string(),
  kind: literal(['enterprise', 'institution', 'government']),
  status: literal(['draft', 'active', 'disabled']),
  version,
  contacts: array(contact),
  agreement: union([agreement, nullSchema()]),
  createdAt: isoUtc,
  updatedAt: isoUtc,
});
const customerOption = strictObject({
  id: id<'partnercustomer'>(),
  name: string(),
  kind: literal(['enterprise', 'institution', 'government']),
  agreementExpiresAt: isoUtc,
  version,
});

export const PARTNER_QUERY_SCHEMAS = {
  PartnerPartnersReadInput: strictObject({ ...pageQuery, kind: optional(literal(['supplier', 'brand', 'store'])) }),
  PartnerCustomersListInput: strictObject({ ...pageQuery, q: optional(string()), kind: optional(literal(['enterprise', 'institution', 'government'])), status: optional(literal(['draft', 'active', 'disabled'])) }),
  PartnerCustomersGetInput: strictObject({}),
  PartnerCustomeroptionsListInput: strictObject({ q: optional(string()), limit: pageQuery.limit }),
} as const;
export const PARTNER_BODY_SCHEMAS = {
  PartnerPartnersManageInput: strictObject({ kind: literal(['supplier', 'brand']), name: string(), status: optional(literal(['pending', 'active', 'suspended', 'terminated'])) }),
  PartnerCustomersCreateInput: strictObject({ identifier: string(), name: string(), kind: literal(['enterprise', 'institution', 'government']), contact: contactInput, agreement: optional(agreementInput) }),
  PartnerCustomersUpdateInput: strictObject({ identifier: optional(string()), name: optional(string()), kind: optional(literal(['enterprise', 'institution', 'government'])), contact: optional(contactInput), agreement: optional(agreementInput) }),
  PartnerCustomersEnableInput: strictObject({ reason: string() }),
  PartnerCustomersDisableInput: strictObject({ reason: string() }),
} as const;
export const PARTNER_OUTPUT_SCHEMAS = {
  PartnerPartnersReadOutput: pageOutput(partner),
  PartnerPartnersManageOutput: partner,
  PartnerCustomersCreateOutput: customer,
  PartnerCustomersUpdateOutput: customer,
  PartnerCustomersEnableOutput: customer,
  PartnerCustomersDisableOutput: customer,
  PartnerCustomersGetOutput: customer,
  PartnerCustomersListOutput: pageOutput(customer),
  PartnerCustomeroptionsListOutput: strictObject({ items: array(customerOption), count: number() }),
} as const;
