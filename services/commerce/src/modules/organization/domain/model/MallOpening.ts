import { DomainError } from '../../../../platform/error/DomainError';

export type MallSubjectType = 'enterprise' | 'individual' | 'organization' | 'personal';
export type MallStoreType = 'general' | 'specialty' | 'franchise' | 'government';
export type MallBusinessMode = 'selfoperated' | 'marketplace' | 'hybrid';
export type MallConnectionMode = 'later' | 'authorize' | 'register';
export type MallPaymentPlan = 'later' | 'wechat' | 'multi' | 'offline';
export type MallDeliveryMode = 'express' | 'local' | 'pickup' | 'digital' | 'mixed';
export type MallInvoiceMode = 'later' | 'electronic' | 'paper' | 'both';
export type MallCertificateMode = 'managed' | 'self' | 'later';

export interface MallOpeningValue {
  readonly state: 'complete' | 'actionrequired';
  readonly subject: Readonly<{
    type: MallSubjectType;
    companyName: string | null;
    creditCode: string | null;
    legalRepresentative: string | null;
    contactName: string | null;
    contactMobile: string | null;
    licenseObjectRef: string | null;
  }>;
  readonly business: Readonly<{
    storeType: MallStoreType;
    primaryCategory: string | null;
    mode: MallBusinessMode;
    region: string | null;
    address: string | null;
    servicePhone: string | null;
  }>;
  readonly certificateMode: MallCertificateMode;
  readonly certificateObjectRef: string | null;
  readonly channels: Readonly<{
    miniProgramMode: MallConnectionMode;
    miniProgramAppId: string | null;
    miniProgramOriginalId: string | null;
    officialAccountMode: MallConnectionMode;
    officialAccountAppId: string | null;
    videoChannelId: string | null;
  }>;
  readonly payment: Readonly<{ plan: MallPaymentPlan; wechatMerchantId: string | null }>;
  readonly fulfillment: Readonly<{
    deliveryMode: MallDeliveryMode;
    warehouseRegion: string | null;
    returnContact: string | null;
    returnAddress: string | null;
  }>;
  readonly invoiceMode: MallInvoiceMode;
  readonly notificationContact: string | null;
}

export class MallOpening {
  private readonly value: MallOpeningValue;

  constructor(input: MallOpeningValue) {
    const state = oneOf(input.state, ['complete', 'actionrequired'] as const, 'openingState');
    const subject = Object.freeze({
      type: oneOf(input.subject.type, ['enterprise', 'individual', 'organization', 'personal'] as const, 'subjectType'),
      companyName: optional(input.subject.companyName, 'companyName', 160),
      creditCode: optional(input.subject.creditCode, 'creditCode', 32),
      legalRepresentative: optional(input.subject.legalRepresentative, 'legalRepresentative', 80),
      contactName: optional(input.subject.contactName, 'contactName', 80),
      contactMobile: optionalPhone(input.subject.contactMobile, 'contactMobile'),
      licenseObjectRef: asset(input.subject.licenseObjectRef, 'licenseObjectRef'),
    });
    if (state === 'complete' && (!subject.companyName || !subject.contactName || !subject.contactMobile)) invalid('subject');
    if (state === 'complete' && subject.type !== 'personal') {
      if (!subject.creditCode || !/^[0-9A-HJ-NPQRTUWXY]{15,18}$/.test(subject.creditCode)) invalid('creditCode');
      if (!subject.legalRepresentative) invalid('legalRepresentative');
    }
    const business = Object.freeze({
      storeType: oneOf(input.business.storeType, ['general', 'specialty', 'franchise', 'government'] as const, 'storeType'),
      primaryCategory: optional(input.business.primaryCategory, 'primaryCategory', 120),
      mode: oneOf(input.business.mode, ['selfoperated', 'marketplace', 'hybrid'] as const, 'businessMode'),
      region: optional(input.business.region, 'businessRegion', 120),
      address: optional(input.business.address, 'businessAddress', 240),
      servicePhone: optionalPhone(input.business.servicePhone, 'servicePhone'),
    });
    if (state === 'complete' && (!business.primaryCategory || !business.region || !business.address)) invalid('business');
    const certificateMode = oneOf(input.certificateMode, ['managed', 'self', 'later'] as const, 'certificateMode');
    const certificateObjectRef = asset(input.certificateObjectRef, 'certificateObjectRef');
    if (state === 'complete' && certificateMode === 'self' && !certificateObjectRef) invalid('certificateObjectRef');
    const channels = Object.freeze({
      miniProgramMode: oneOf(input.channels.miniProgramMode, ['later', 'authorize', 'register'] as const, 'miniProgramMode'),
      miniProgramAppId: optional(input.channels.miniProgramAppId, 'miniProgramAppId', 128),
      miniProgramOriginalId: optional(input.channels.miniProgramOriginalId, 'miniProgramOriginalId', 128),
      officialAccountMode: oneOf(input.channels.officialAccountMode, ['later', 'authorize', 'register'] as const, 'officialAccountMode'),
      officialAccountAppId: optional(input.channels.officialAccountAppId, 'officialAccountAppId', 128),
      videoChannelId: optional(input.channels.videoChannelId, 'videoChannelId', 128),
    });
    if (state === 'complete' && channels.miniProgramMode === 'authorize' && (!channels.miniProgramAppId || !channels.miniProgramOriginalId)) invalid('miniProgramAppId');
    if (state === 'complete' && channels.officialAccountMode === 'authorize' && !channels.officialAccountAppId) invalid('officialAccountAppId');
    const payment = Object.freeze({
      plan: oneOf(input.payment.plan, ['later', 'wechat', 'multi', 'offline'] as const, 'paymentPlan'),
      wechatMerchantId: optional(input.payment.wechatMerchantId, 'wechatMerchantId', 64),
    });
    if (state === 'complete' && (payment.plan === 'wechat' || payment.plan === 'multi') && !payment.wechatMerchantId) invalid('wechatMerchantId');
    const deliveryMode = oneOf(input.fulfillment.deliveryMode, ['express', 'local', 'pickup', 'digital', 'mixed'] as const, 'deliveryMode');
    const fulfillment = Object.freeze({
      deliveryMode,
      warehouseRegion: optional(input.fulfillment.warehouseRegion, 'warehouseRegion', 120),
      returnContact: optional(input.fulfillment.returnContact, 'returnContact', 120),
      returnAddress: optional(input.fulfillment.returnAddress, 'returnAddress', 240),
    });
    if (state === 'complete' && deliveryMode !== 'digital' && (!fulfillment.warehouseRegion || !fulfillment.returnContact || !fulfillment.returnAddress)) invalid('fulfillment');
    const invoiceMode = oneOf(input.invoiceMode, ['later', 'electronic', 'paper', 'both'] as const, 'invoiceMode');
    const notificationContact = input.notificationContact === null ? null : contact(input.notificationContact, 'notificationContact');
    if (state === 'complete' && !notificationContact) invalid('notificationContact');
    this.value = Object.freeze({ state, subject, business, certificateMode, certificateObjectRef, channels, payment, fulfillment, invoiceMode, notificationContact });
    Object.freeze(this);
  }

  view(): MallOpeningValue {
    return this.value;
  }
}

function optional(value: string | null, field: string, maximum: number): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) invalid(field);
  return normalized;
}

function asset(value: string | null, field: string): string | null {
  const normalized = optional(value, field, 512);
  if (normalized !== null && !/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(normalized)) invalid(field);
  return normalized;
}

function phone(value: string, field: string): string {
  const normalized = value.trim();
  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) invalid(field);
  return normalized;
}

function optionalPhone(value: string | null, field: string): string | null {
  if (value === null) return null;
  return phone(value, field);
}

function contact(value: string, field: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) invalid(field);
  return normalized;
}

function oneOf<const T extends readonly string[]>(value: string, choices: T, field: string): T[number] {
  if (!choices.includes(value)) invalid(field);
  return value as T[number];
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
