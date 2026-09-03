/**
 * 主打团企业福利商城 - 认证与权限 Mock 服务 (auth.ts)
 * 职责：模拟统一登录认证段、会员关系查询、Step-Up 二次验证、跨域票据交换及安全审计
 * 技术服务方：雍彻科技
 */

import { Membership } from '../types';
import { resolveBuildTimeOrigin } from './originPolicy';

const CANONICAL_ADMIN_ORIGIN = 'https://console.zhudatuan.com';
const CANONICAL_STOREFRONT_ORIGIN = 'https://zhudatuan.com';
const CANONICAL_H5_ORIGIN = 'https://h5.zhudatuan.com';

function resolveCredentialTargetOrigin(configuredOrigin: string | undefined, canonicalOrigin: string, targetLabel: string,
  allowLocalDevelopment: boolean, stagingOrigin?: string): string {
  return resolveBuildTimeOrigin({
    configuredOrigin,
    canonicalOrigin,
    stagingOrigin,
    allowLocalDevelopment,
    invalidMessage: `${targetLabel}登录目标配置无效，已停止提交账号凭证`,
    deniedMessage: `${targetLabel}登录目标不在允许清单，已停止提交账号凭证`,
  });
}

export function resolveAdminLoginOrigin(configuredOrigin?: string, allowLocalDevelopment = false, stagingOrigin?: string): string {
  return resolveCredentialTargetOrigin(configuredOrigin, CANONICAL_ADMIN_ORIGIN, '后台', allowLocalDevelopment, stagingOrigin);
}

export function resolveStorefrontLoginOrigin(configuredOrigin?: string, allowLocalDevelopment = false, stagingOrigin?: string): string {
  return resolveCredentialTargetOrigin(
    configuredOrigin,
    CANONICAL_STOREFRONT_ORIGIN,
    '商城',
    allowLocalDevelopment,
    stagingOrigin,
  );
}

export function resolveH5LoginOrigin(configuredOrigin?: string, allowLocalDevelopment = false, stagingOrigin?: string): string {
  return resolveCredentialTargetOrigin(configuredOrigin, CANONICAL_H5_ORIGIN, 'H5 商城', allowLocalDevelopment, stagingOrigin);
}

export function buildCredentialLoginAction(targetOrigin: string): string {
  const action = new URL('/api/v1/auth/login', targetOrigin);
  action.searchParams.set('redirect', '/');
  return action.toString();
}

/**
 * Credential discovery currently returns one authoritative authorization.
 * Multiple usable memberships require a server-bound selection token; until
 * that contract exists the UI may display them, but it must not choose one in
 * the browser and silently create a session for another membership.
 */
export function requiresAuthoritativeMembershipSelection(memberships: Membership[]): boolean {
  return memberships.filter((membership) => membership.status === 'active' || membership.status === 'invited').length > 1;
}

/** Public-test fixtures mirror the real Membership IDs seeded in Supabase. */
export const TEST_ACCOUNT_MEMBERSHIPS: Record<string, Membership[]> = {
  业主测试员: [
    {
      id: 'membership-test-storefront',
      target: 'storefront',
      status: 'active',
      enterpriseName: '示范企业',
      storeName: '主打团企业福利商城',
      roleName: '测试员工',
      dataScope: '个人福利账户',
      accountTypeLabel: '福利账户',
    },
  ],
  福宝: [
    {
      id: 'membership-test-fubao-admin',
      target: 'admin',
      status: 'active',
      enterpriseName: '示范企业',
      storeName: '主打团运营后台',
      roleName: '商城管理员',
      dataScope: '主打团企业福利商城',
      subjectScope: '商城',
      keyPermissions: ['product.publish', 'order.ship'],
      authorizedBy: '测试租户管理员',
      expireAt: '2027-12-31',
      requiresStepUp: true,
    },
  ],
  经理1: [
    {
      id: 'membership-test-manager-admin',
      target: 'admin',
      status: 'active',
      enterpriseName: '示范企业',
      storeName: '主打团运营后台',
      roleName: '企业运营经理',
      dataScope: '示范企业 / 主打团企业福利商城',
      subjectScope: '企业',
      keyPermissions: ['order.refund', 'finance.reconcile'],
      authorizedBy: '测试租户管理员',
      expireAt: '2027-12-31',
      requiresStepUp: true,
    },
  ],
  onewr: [
    {
      id: 'membership-test-owner-admin',
      target: 'admin',
      status: 'active',
      enterpriseName: '主打团福利平台',
      storeName: '主打团运营后台',
      roleName: '平台业主',
      dataScope: '全租户',
      subjectScope: '租户',
      keyPermissions: ['tenant.manage', 'role.grant', 'order.refund'],
      authorizedBy: '系统初始化',
      expireAt: '2027-12-31',
      requiresStepUp: true,
    },
  ],
  李厚亿: [],
};
if (import.meta.env.DEV) TEST_ACCOUNT_MEMBERSHIPS.李厚亿 = TEST_ACCOUNT_MEMBERSHIPS.onewr;

const ROLE_TEST_MEMBERSHIP_DEFINITIONS: ReadonlyArray<{
  prefix: string;
  target: Membership['target'];
  roleName: string;
  dataScope: string;
  subjectScope?: Membership['subjectScope'];
  keyPermissions: string[];
  requiresStepUp: boolean;
}> = [
  { prefix: 'buyer', target: 'storefront', roleName: '测试买家', dataScope: '个人福利账户', keyPermissions: ['catalog.read', 'order.create', 'order.read'], requiresStepUp: false },
  { prefix: 'seller', target: 'admin', roleName: '测试商家', dataScope: '央企供应链', subjectScope: '供应商', keyPermissions: ['catalog.read', 'product.publish', 'order.read', 'order.ship'], requiresStepUp: false },
  { prefix: 'ops', target: 'admin', roleName: '测试运营', dataScope: '主打团企业福利商城', subjectScope: '商城', keyPermissions: ['catalog.read', 'product.publish', 'order.read', 'order.ship', 'audit.read'], requiresStepUp: false },
  { prefix: 'cs', target: 'admin', roleName: '测试客服', dataScope: '主打团企业福利商城', subjectScope: '商城', keyPermissions: ['catalog.read', 'order.read', 'member.read'], requiresStepUp: false },
  {
    prefix: 'admin',
    target: 'admin',
    roleName: '测试企业管理员',
    dataScope: '示范企业 / 主打团企业福利商城',
    subjectScope: '企业',
    keyPermissions: ['member.invite', 'member.disable', 'finance.reconcile', 'audit.read'],
    requiresStepUp: false,
  },
];

if (import.meta.env.DEV) {
  for (const definition of ROLE_TEST_MEMBERSHIP_DEFINITIONS) {
    for (let index = 1; index <= 5; index += 1) {
      const suffix = String(index).padStart(3, '0');
      TEST_ACCOUNT_MEMBERSHIPS[`${definition.prefix}${suffix}`] = [
        {
          id: `membership-test-${definition.prefix}-${suffix}`,
          target: definition.target,
          status: 'active',
          enterpriseName: '示范企业',
          storeName: definition.target === 'storefront' ? '主打团企业福利商城' : '主打团运营后台',
          roleName: definition.roleName,
          dataScope: definition.dataScope,
          accountTypeLabel: definition.target === 'storefront' ? '福利账户' : undefined,
          subjectScope: definition.subjectScope,
          keyPermissions: definition.keyPermissions,
          authorizedBy: '测试租户管理员',
          expireAt: '2027-12-31',
          requiresStepUp: definition.requiresStepUp,
        },
      ];
    }
  }
}

export async function changeInitialPassword(username: string, password: string, newPassword: string): Promise<void> {
  const response = await fetch('/api/v1/auth/password/initial-change', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password, newPassword }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || '初始密码修改失败');
}

export interface RegistrationOtpResult {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  debugCode?: string;
}

export async function requestRegistrationOtp(mobile: string): Promise<RegistrationOtpResult> {
  const response = await fetch('/api/v1/auth/registration/otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mobile }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || '验证码发送失败');
  return payload as RegistrationOtpResult;
}

export async function registerMember(input: { mobile: string; challengeId: string; code: string; password: string; displayName: string; inviteCode: string }): Promise<{ registered: true; employeeNo: string }> {
  const response = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || '注册失败');
  return payload;
}

export async function registerUsernameMember(input: {
  username: string;
  password: string;
  displayName: string;
  inviteCode: string;
  acceptedTerms: true;
}): Promise<{ registered: true; username: string; employeeNo: string; phoneBound: false }> {
  const response = await fetch('/api/v1/auth/register/username', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || '注册失败');
  return payload;
}

/**
 * 4. 接受邀请 API
 */
export async function acceptInvitation(_preAuthToken?: string, _membershipId?: string): Promise<never> {
  throw new Error('邀请接受服务尚未接通；浏览器不会模拟授权成功');
}

/**
 * 5. Step-Up 动态二次验证 (TOTP 6位)
 */
export async function verifyStepUp(_preAuthToken?: string, _membershipId?: string, _totpCode?: string): Promise<never> {
  throw new Error('正式二次验证服务尚未接通；系统不会接受固定口令或签发浏览器票据');
}
