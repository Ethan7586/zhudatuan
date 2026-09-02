import type { CanonicalInvitation } from '../services/canonicalRegistration';

export interface RegistrationPresentation {
  readonly title: string;
  readonly description: string;
  readonly resolvedNotice: string;
  readonly submitLabel: string;
  readonly footer: string;
  readonly successNotice: string;
}

const PENDING_PRESENTATION: RegistrationPresentation = Object.freeze({
  title: '验证邀请并注册',
  description: '验证企业邀请码后，系统会显示本次开通的身份范围。',
  resolvedNotice: '',
  submitLabel: '创建账号',
  footer: '密码、邀请码和验证码不会写入浏览器长期存储。具体身份范围以已验证的企业邀请为准。',
  successNotice: '',
});

const ADMIN_PRESENTATION: RegistrationPresentation = Object.freeze({
  title: '注册普通管理员',
  description: '普通管理员邀请：注册后同时开通商城与运营后台；后台初始为 0 业务权限，等待 Owner 或高级管理员授权。',
  resolvedNotice: '普通管理员邀请已验证。注册后将同时开通商城与运营后台，后台初始为 0 业务权限，等待授权。',
  submitLabel: '创建普通管理员账号',
  footer: '密码、邀请码和验证码不会写入浏览器长期存储。该邀请会同时开通商城与后台；后台初始为 0 业务权限，须等待 Owner 或高级管理员授权。',
  successNotice: '普通管理员账号已创建，商城与后台身份已同时开通。后台当前为 0 业务权限，请等待 Owner 或高级管理员授权后登录。',
});

const SENIOR_ADMIN_PRESENTATION: RegistrationPresentation = Object.freeze({
  title: '注册高级管理员',
  description: '高级管理员邀请：注册后同时开通商城与运营后台；在当前商户范围拥有全部业务功能，但不能管理 Owner 或任命同级管理员。',
  resolvedNotice: '高级管理员邀请已验证。注册后将同时开通商城与运营后台，并获得当前商户范围内的全部业务功能。',
  submitLabel: '创建高级管理员账号',
  footer: '密码、邀请码和验证码不会写入浏览器长期存储。高级管理员不具备 Owner 转让、撤销或同级任命能力。',
  successNotice: '高级管理员账号已创建，商城与后台身份已同时开通。请使用手机号与刚才设置的密码登录。',
});

const STOREFRONT_PRESENTATION: RegistrationPresentation = Object.freeze({
  title: '注册普通员工',
  description: '手机号验证后建立普通员工会员，仅开通消费商城身份。',
  resolvedNotice: '普通员工邀请已验证。请核对本次注册适用的服务协议与隐私政策。',
  submitLabel: '创建普通员工会员账号',
  footer: '密码、邀请码和验证码不会写入浏览器长期存储。普通员工邀请只开通消费商城，不开通运营后台。',
  successNotice: '普通员工商城账号已创建。请使用手机号与刚才设置的密码登录。',
});

export function registrationPresentation(
  target?: CanonicalInvitation['target'],
  governanceLevel?: CanonicalInvitation['governanceLevel'],
): RegistrationPresentation {
  if (target === 'console' && governanceLevel === 'senior_administrator') return SENIOR_ADMIN_PRESENTATION;
  if (target === 'console') return ADMIN_PRESENTATION;
  if (target === 'storefront') return STOREFRONT_PRESENTATION;
  return PENDING_PRESENTATION;
}
