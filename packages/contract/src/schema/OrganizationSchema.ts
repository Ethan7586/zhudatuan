import { boolean, discriminatedUnion, literal, maxLength, minLength, null as nullSchema, number, optional, regex, strictObject, string, union } from 'zod/mini';
import { currency, isoUtc, pageOutput, pageQuery, version } from './Primitives';

const color = string().check(regex(/^#[0-9A-F]{6}$/));
const code = string().check(regex(/^[A-Z][A-Z0-9_]{1,31}$/));
const handle = string().check(regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/));
const hostname = string().check(regex(/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/));
const limited = (maximum: number, minimum = 1) => string().check(minLength(minimum), maxLength(maximum));
const objectReference = string().check(maxLength(512), regex(/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$/));
const asset = union([objectReference, nullSchema()]);
const text = string().check(minLength(1), maxLength(240));
const nullableText = union([text, nullSchema()]);
const phone = string().check(regex(/^\+[1-9][0-9]{7,14}$/));
const nullablePhone = union([phone, nullSchema()]);
const notification = union([phone, string().check(maxLength(240), regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))]);
const theme = strictObject({
  preset: literal(['shop', 'market', 'governance']),
  primaryColor: color,
  accentColor: color,
  logoObjectRef: asset,
  faviconObjectRef: asset,
});
const domain = discriminatedUnion('mode', [strictObject({ mode: literal('platform') }), strictObject({ mode: literal('custom'), customDomain: hostname })]);
const openingInput = strictObject({
  subject: strictObject({
    type: literal(['enterprise', 'individual', 'organization', 'personal']),
    companyName: limited(160, 2),
    creditCode: union([string().check(regex(/^[0-9A-HJ-NPQRTUWXY]{15,18}$/)), nullSchema()]),
    legalRepresentative: union([limited(80, 2), nullSchema()]),
    contactName: limited(80, 2),
    contactMobile: phone,
    licenseObjectRef: asset,
  }),
  business: strictObject({
    storeType: literal(['general', 'specialty', 'franchise', 'government']),
    primaryCategory: limited(120),
    mode: literal(['selfoperated', 'marketplace', 'hybrid']),
    region: limited(120),
    address: text,
    servicePhone: nullablePhone,
  }),
  certificateMode: literal(['managed', 'self', 'later']),
  certificateObjectRef: asset,
  channels: strictObject({
    miniProgramMode: literal(['later', 'authorize', 'register']),
    miniProgramAppId: union([limited(128), nullSchema()]),
    miniProgramOriginalId: union([limited(128), nullSchema()]),
    officialAccountMode: literal(['later', 'authorize', 'register']),
    officialAccountAppId: union([limited(128), nullSchema()]),
    videoChannelId: union([limited(128), nullSchema()]),
  }),
  payment: strictObject({ plan: literal(['later', 'wechat', 'multi', 'offline']), wechatMerchantId: union([limited(64), nullSchema()]) }),
  fulfillment: strictObject({
    deliveryMode: literal(['express', 'local', 'pickup', 'digital', 'mixed']),
    warehouseRegion: union([limited(120), nullSchema()]),
    returnContact: union([limited(120), nullSchema()]),
    returnAddress: nullableText,
  }),
  invoiceMode: literal(['later', 'electronic', 'paper', 'both']),
  notificationContact: notification,
});
const openingOutput = strictObject({
  ...openingInput.shape,
  state: literal(['complete', 'actionrequired']),
  subject: strictObject({
    ...openingInput.shape.subject.shape,
    companyName: nullableText,
    contactName: nullableText,
    contactMobile: nullablePhone,
  }),
  business: strictObject({
    ...openingInput.shape.business.shape,
    primaryCategory: nullableText,
    region: nullableText,
    address: nullableText,
  }),
  notificationContact: nullableText,
});
const mall = strictObject({
  id: string(),
  parentId: string(),
  name: limited(120, 2),
  code,
  publicSlug: handle,
  brandName: limited(120, 2),
  domain,
  ownerMembershipId: limited(160, 3),
  timezone: limited(64),
  currency,
  theme,
  opening: openingOutput,
  status: literal(['draft', 'active', 'disabled']),
  version,
  createdAt: isoUtc,
  updatedAt: isoUtc,
});

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

export const ORGANIZATION_QUERY_SCHEMAS = {
  OrganizationStoresReadInput: strictObject(pageQuery),
  OrganizationMallsReadInput: strictObject({}),
} as const;
export const ORGANIZATION_BODY_SCHEMAS = {
  OrganizationMallsCreateInput: strictObject({
    parentId: string(),
    name: limited(120, 2),
    code,
    publicSlug: handle,
    brandName: limited(120, 2),
    domain,
    ownerMembershipId: limited(160, 3),
    timezone: limited(64),
    currency,
    theme,
    opening: openingInput,
  }),
  OrganizationMallsUpdateInput: strictObject({
    name: optional(string()),
    brandName: optional(string()),
    domain: optional(domain),
    ownerMembershipId: optional(string()),
    timezone: optional(string()),
    currency: optional(currency),
    theme: optional(theme),
    opening: optional(openingInput),
    status: optional(literal(['draft', 'active', 'disabled'])),
  }),
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
  OrganizationMallsCreateOutput: mall,
  OrganizationMallsReadOutput: mall,
  OrganizationMallsUpdateOutput: mall,
  OrganizationStoresReadOutput: pageOutput(stored),
  OrganizationStoresManageOutput: store,
} as const;
