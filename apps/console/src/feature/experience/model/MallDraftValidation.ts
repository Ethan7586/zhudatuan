import type { MallParent } from './Mall';
import type { MallOpeningDraft } from './MallDraftType';

export type MallContentSection = 'subject' | 'channel' | 'delivery';

export function validateMallStep(draft: MallOpeningDraft, step: number, parents: readonly MallParent[], requireParent = true): string | undefined {
  if (step === 3) return [0, 1, 2].map((candidate) => validateMallStep(draft, candidate, parents, requireParent)).find((value) => value !== undefined);
  if (step === 0) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(draft.primaryColor) || !/^#[0-9A-Fa-f]{6}$/.test(draft.accentColor)) return '品牌颜色须使用六位十六进制色值，例如 #1F5EFF。';
    if ([draft.logoObjectRef, draft.faviconObjectRef].some((value) => value !== '' && !objectReference(value))) return '视觉资产须填写安全文件库返回的对象引用。';
  }
  if (step === 1) {
    if (requireParent && !parents.some((parent) => parent.id === draft.parentId)) return '请选择有权限管理的上级组织。';
    if (draft.name.trim().length < 2 || draft.name.trim().length > 120) return '商城名称须为 2 至 120 个字符。';
    if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(draft.code)) return '商城代码须以字母开头，只能包含大写字母、数字和下划线。';
    if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(draft.publicSlug)) return '公开路径须为 3 至 48 个小写字母、数字或连字符，且不能以连字符结尾。';
    if (draft.brandName.trim().length < 2 || draft.ownerMembershipId.trim().length < 3) return '请填写品牌名称和商城负责人。';
    if (draft.domainMode === 'custom' && !/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(draft.customDomain.trim())) return '请输入完整的自有域名，例如 shop.example.com。';
  }
  if (step === 2) {
    return firstInvalidMallContentSection(draft)?.message;
  }
  return undefined;
}

export function validateMallContentSection(draft: MallOpeningDraft, section: MallContentSection): string | undefined {
  if (section === 'subject') {
    if (draft.companyName.trim().length < 2 || draft.contactName.trim().length < 2 || !phone(draft.contactMobile)) return '请完整填写经营主体、联系人和有效手机号。';
    if (draft.subjectType !== 'personal' && (!/^[0-9A-HJ-NPQRTUWXY]{15,18}$/i.test(draft.creditCode.trim()) || draft.legalRepresentative.trim().length < 2)) return '非个人主体须填写有效统一社会信用代码和法定代表人。';
    if (!draft.primaryCategory.trim() || !draft.businessRegion.trim() || !draft.businessAddress.trim()) return '请完整填写主营类目、经营地区和经营地址。';
    if (draft.servicePhone && !phone(draft.servicePhone)) return '客服电话须使用有效手机号或带国家区号的国际格式。';
  }
  if (section === 'channel') {
    if (draft.certificateMode === 'self' && !objectReference(draft.certificateObjectRef)) return '自行提供证书时须选择安全文件库中的证书对象。';
    if (draft.miniProgramMode === 'authorize' && (!draft.miniProgramAppId.trim() || !draft.miniProgramOriginalId.trim())) return '授权已有小程序时须填写 AppID 和原始 ID。';
    if (draft.officialAccountMode === 'authorize' && !draft.officialAccountAppId.trim()) return '授权已有公众号时须填写 AppID。';
  }
  if (section === 'delivery') {
    if ((draft.paymentPlan === 'wechat' || draft.paymentPlan === 'multi') && !draft.wechatMerchantId.trim()) return '选择微信收款时须填写微信支付商户号。';
    if (draft.deliveryMode !== 'digital' && (!draft.warehouseRegion.trim() || !draft.returnContact.trim() || !draft.returnAddress.trim())) return '实物履约须填写发货地区、退货联系人和退货地址。';
    if (!notification(draft.notificationContact)) return '经营通知接收人须为有效手机号或邮箱。';
  }
  return undefined;
}

export function firstInvalidMallContentSection(draft: MallOpeningDraft): Readonly<{ section: MallContentSection; message: string }> | undefined {
  for (const section of ['subject', 'channel', 'delivery'] as const) {
    const message = validateMallContentSection(draft, section);
    if (message) return Object.freeze({ section, message });
  }
  return undefined;
}
function objectReference(value: string): boolean {
  return /^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.trim());
}
function phone(value: string): boolean {
  return /^1[3-9][0-9]{9}$/.test(value.trim()) || /^\+[1-9][0-9]{7,14}$/.test(value.trim());
}
function notification(value: string): boolean {
  return phone(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
