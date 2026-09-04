import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import type { MallDomain, MallPatch, MallTheme } from '../../domain/model/Mall';
import type { MallOpeningValue } from '../../domain/model/MallOpening';

export interface CreateMallCommand {
  readonly parentId: string;
  readonly name: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly brandName: string;
  readonly domain: MallDomain;
  readonly ownerMembershipId: string;
  readonly timezone: string;
  readonly currency: string;
  readonly theme: MallTheme;
  readonly opening: MallOpeningValue;
}

export function createMallCommand(input: Readonly<{ body?: unknown }>): CreateMallCommand {
  const body = bodyRecord(input);
  return Object.freeze({
    parentId: textField(body, 'parentId'),
    name: textField(body, 'name', 120),
    code: textField(body, 'code', 32),
    publicSlug: textField(body, 'publicSlug', 48),
    brandName: textField(body, 'brandName', 120),
    domain: domainValue(body.domain),
    ownerMembershipId: textField(body, 'ownerMembershipId', 160),
    timezone: textField(body, 'timezone', 64),
    currency: textField(body, 'currency', 3),
    theme: themeValue(body.theme),
    opening: openingValue(body.opening),
  });
}

export function updateMallCommand(input: Readonly<{ body?: unknown }>): MallPatch {
  const body = bodyRecord(input);
  const patch: MallPatch = Object.freeze({
    ...(body.name === undefined ? {} : { name: textField(body, 'name', 120) }),
    ...(body.brandName === undefined ? {} : { brandName: textField(body, 'brandName', 120) }),
    ...(body.domain === undefined ? {} : { domain: domainValue(body.domain) }),
    ...(body.ownerMembershipId === undefined ? {} : { ownerMembershipId: textField(body, 'ownerMembershipId', 160) }),
    ...(body.timezone === undefined ? {} : { timezone: textField(body, 'timezone', 64) }),
    ...(body.currency === undefined ? {} : { currency: textField(body, 'currency', 3) }),
    ...(body.theme === undefined ? {} : { theme: themeValue(body.theme) }),
    ...(body.opening === undefined ? {} : { opening: openingValue(body.opening) }),
    ...(body.status === undefined ? {} : { status: statusValue(body.status) }),
  });
  if (Object.keys(patch).length === 0) throw new DomainError('VALIDATION_FAILED', { field: 'body' });
  return patch;
}

function domainValue(value: unknown): MallDomain {
  const record = object(value, 'domain');
  if (record.mode === 'platform') return Object.freeze({ mode: 'platform' });
  if (record.mode === 'custom') return Object.freeze({ mode: 'custom', customDomain: valueText(record.customDomain, 'customDomain', 253) });
  throw new DomainError('VALIDATION_FAILED', { field: 'domain' });
}

function themeValue(value: unknown): MallTheme {
  const record = object(value, 'theme');
  return Object.freeze({
    preset: enumValue(record.preset, 'preset', ['shop', 'market', 'governance'] as const),
    primaryColor: valueText(record.primaryColor, 'primaryColor', 7),
    accentColor: valueText(record.accentColor, 'accentColor', 7),
    logoObjectRef: nullableAsset(record.logoObjectRef, 'logoObjectRef'),
    faviconObjectRef: nullableAsset(record.faviconObjectRef, 'faviconObjectRef'),
  });
}

function openingValue(value: unknown): MallOpeningValue {
  const opening = object(value, 'opening');
  const subject = object(opening.subject, 'subject');
  const business = object(opening.business, 'business');
  const channels = object(opening.channels, 'channels');
  const payment = object(opening.payment, 'payment');
  const fulfillment = object(opening.fulfillment, 'fulfillment');
  return Object.freeze({
    state: 'complete',
    subject: Object.freeze({
      type: enumValue(subject.type, 'subjectType', ['enterprise', 'individual', 'organization', 'personal'] as const),
      companyName: valueText(subject.companyName, 'companyName', 160),
      creditCode: nullableText(subject.creditCode, 'creditCode', 32),
      legalRepresentative: nullableText(subject.legalRepresentative, 'legalRepresentative', 80),
      contactName: valueText(subject.contactName, 'contactName', 80),
      contactMobile: valueText(subject.contactMobile, 'contactMobile', 16),
      licenseObjectRef: nullableAsset(subject.licenseObjectRef, 'licenseObjectRef'),
    }),
    business: Object.freeze({
      storeType: enumValue(business.storeType, 'storeType', ['general', 'specialty', 'franchise', 'government'] as const),
      primaryCategory: valueText(business.primaryCategory, 'primaryCategory', 120),
      mode: enumValue(business.mode, 'businessMode', ['selfoperated', 'marketplace', 'hybrid'] as const),
      region: valueText(business.region, 'businessRegion', 120),
      address: valueText(business.address, 'businessAddress', 240),
      servicePhone: nullableText(business.servicePhone, 'servicePhone', 32),
    }),
    certificateMode: enumValue(opening.certificateMode, 'certificateMode', ['managed', 'self', 'later'] as const),
    certificateObjectRef: nullableAsset(opening.certificateObjectRef, 'certificateObjectRef'),
    channels: Object.freeze({
      miniProgramMode: enumValue(channels.miniProgramMode, 'miniProgramMode', ['later', 'authorize', 'register'] as const),
      miniProgramAppId: nullableText(channels.miniProgramAppId, 'miniProgramAppId', 128),
      miniProgramOriginalId: nullableText(channels.miniProgramOriginalId, 'miniProgramOriginalId', 128),
      officialAccountMode: enumValue(channels.officialAccountMode, 'officialAccountMode', ['later', 'authorize', 'register'] as const),
      officialAccountAppId: nullableText(channels.officialAccountAppId, 'officialAccountAppId', 128),
      videoChannelId: nullableText(channels.videoChannelId, 'videoChannelId', 128),
    }),
    payment: Object.freeze({
      plan: enumValue(payment.plan, 'paymentPlan', ['later', 'wechat', 'multi', 'offline'] as const),
      wechatMerchantId: nullableText(payment.wechatMerchantId, 'wechatMerchantId', 64),
    }),
    fulfillment: Object.freeze({
      deliveryMode: enumValue(fulfillment.deliveryMode, 'deliveryMode', ['express', 'local', 'pickup', 'digital', 'mixed'] as const),
      warehouseRegion: nullableText(fulfillment.warehouseRegion, 'warehouseRegion', 120),
      returnContact: nullableText(fulfillment.returnContact, 'returnContact', 120),
      returnAddress: nullableText(fulfillment.returnAddress, 'returnAddress', 240),
    }),
    invoiceMode: enumValue(opening.invoiceMode, 'invoiceMode', ['later', 'electronic', 'paper', 'both'] as const),
    notificationContact: valueText(opening.notificationContact, 'notificationContact', 240),
  });
}

function nullableAsset(value: unknown, field: string): string | null {
  if (value === null) return null;
  return valueText(value, field, 512);
}

function nullableText(value: unknown, field: string, maximum: number): string | null {
  if (value === null) return null;
  return valueText(value, field, maximum);
}

function enumValue<const T extends readonly string[]>(value: unknown, field: string, values: T): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) throw new DomainError('VALIDATION_FAILED', { field });
  return value as T[number];
}

function statusValue(value: unknown): 'draft' | 'active' | 'disabled' {
  if (value !== 'draft' && value !== 'active' && value !== 'disabled') throw new DomainError('VALIDATION_FAILED', { field: 'status' });
  return value;
}

function object(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED', { field });
  return value as Readonly<Record<string, unknown>>;
}

function valueText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maximum) throw new DomainError('VALIDATION_FAILED', { field });
  return value.trim();
}
