import type { MallCreateDraft, MallParent, MallUpdateDraft } from './Mall';
import type { MallOpeningDraft } from './MallDraftType';

export function mallCreateDraft(draft: MallOpeningDraft, parents: readonly MallParent[]): MallCreateDraft {
  const parent = parents.find((candidate) => candidate.id === draft.parentId);
  if (!parent) throw new Error('MALL_PARENT_REQUIRED');
  return Object.freeze({ parentId: parent.id, parentVersion: parent.version, name: draft.name.trim(), code: draft.code.trim().toUpperCase(), publicSlug: draft.publicSlug.trim().toLowerCase(), ...mallProfile(draft) });
}
export function mallUpdateDraft(draft: MallOpeningDraft): MallUpdateDraft {
  return Object.freeze({ name: draft.name.trim(), ...mallProfile(draft), status: draft.status });
}
function mallProfile(draft: MallOpeningDraft): Omit<MallUpdateDraft, 'name' | 'status'> {
  return Object.freeze({
    brandName: draft.brandName.trim(),
    domain: draft.domainMode === 'custom' ? Object.freeze({ mode: 'custom', customDomain: draft.customDomain.trim().toLowerCase().replace(/\.$/, '') }) : Object.freeze({ mode: 'platform' }),
    ownerMembershipId: draft.ownerMembershipId.trim(),
    timezone: draft.timezone,
    currency: draft.currency.toUpperCase(),
    theme: Object.freeze({
      preset: draft.themePreset,
      primaryColor: draft.primaryColor.toUpperCase(),
      accentColor: draft.accentColor.toUpperCase(),
      logoObjectRef: nullable(draft.logoObjectRef),
      faviconObjectRef: nullable(draft.faviconObjectRef),
    }),
    opening: Object.freeze({
      subject: Object.freeze({
        type: draft.subjectType,
        companyName: draft.companyName.trim(),
        creditCode: nullable(draft.creditCode)?.toUpperCase() ?? null,
        legalRepresentative: nullable(draft.legalRepresentative),
        contactName: draft.contactName.trim(),
        contactMobile: mainlandPhone(draft.contactMobile),
        licenseObjectRef: nullable(draft.licenseObjectRef),
      }),
      business: Object.freeze({
        storeType: draft.storeType,
        primaryCategory: draft.primaryCategory.trim(),
        mode: draft.businessMode,
        region: draft.businessRegion.trim(),
        address: draft.businessAddress.trim(),
        servicePhone: nullablePhone(draft.servicePhone),
      }),
      certificateMode: draft.certificateMode,
      certificateObjectRef: nullable(draft.certificateObjectRef),
      channels: Object.freeze({
        miniProgramMode: draft.miniProgramMode,
        miniProgramAppId: nullable(draft.miniProgramAppId),
        miniProgramOriginalId: nullable(draft.miniProgramOriginalId),
        officialAccountMode: draft.officialAccountMode,
        officialAccountAppId: nullable(draft.officialAccountAppId),
        videoChannelId: nullable(draft.videoChannelId),
      }),
      payment: Object.freeze({ plan: draft.paymentPlan, wechatMerchantId: nullable(draft.wechatMerchantId) }),
      fulfillment: Object.freeze({ deliveryMode: draft.deliveryMode, warehouseRegion: nullable(draft.warehouseRegion), returnContact: nullable(draft.returnContact), returnAddress: nullable(draft.returnAddress) }),
      invoiceMode: draft.invoiceMode,
      notificationContact: notification(draft.notificationContact),
    }),
  });
}
function nullable(value: string): string | null {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}
function mainlandPhone(value: string): string {
  const normalized = value.trim();
  return /^1[3-9][0-9]{9}$/.test(normalized) ? `+86${normalized}` : normalized;
}
function nullablePhone(value: string): string | null {
  const normalized = nullable(value);
  return normalized === null ? null : mainlandPhone(normalized);
}
function notification(value: string): string {
  return phone(value) ? mainlandPhone(value) : value.trim().toLowerCase();
}
function phone(value: string): boolean {
  return /^1[3-9][0-9]{9}$/.test(value.trim()) || /^\+[1-9][0-9]{7,14}$/.test(value.trim());
}
