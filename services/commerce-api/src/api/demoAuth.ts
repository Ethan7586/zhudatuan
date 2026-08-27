import { resolveMembershipRuntimeByIds, type MembershipRuntime } from './membershipContext';
import type { SessionTarget } from './session';
import type { WorkerEnv } from './types';

/**
 * Local-only fixture. It intentionally contains no roles or permissions:
 * those are always resolved from the same Member → Membership → Role → Scope
 * records used by real authentication. Production never loads this module.
 */
export interface DemoAccount {
  username: string;
  password: string;
  employeeNo: string;
  mallCode: string;
  memberId: string;
  storefrontMembershipId?: string;
  adminMembershipId?: string;
}

export function isDemoAuthEnabled(env: WorkerEnv): boolean {
  return (env.APP_ENV === 'development' && env.AUTH_MODE === 'development') || (env.APP_ENV === 'test' && env.AUTH_MODE === 'test');
}

const DEFAULT_DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    username: '业主测试员',
    password: '123456',
    employeeNo: 'SW_TEST_STORE',
    mallCode: 'SMART_WING_DEMO',
    memberId: 'member-test-storefront',
    storefrontMembershipId: 'membership-test-storefront',
  },
  {
    username: '福宝',
    password: '123456',
    employeeNo: 'SW_TEST_FUBAO',
    mallCode: 'SMART_WING_DEMO',
    memberId: 'member-test-fubao',
    adminMembershipId: 'membership-test-fubao-admin',
  },
  {
    username: '经理1',
    password: '123456',
    employeeNo: 'SW_TEST_MANAGER',
    mallCode: 'SMART_WING_DEMO',
    memberId: 'member-test-manager',
    adminMembershipId: 'membership-test-manager-admin',
  },
  {
    username: 'onewr',
    password: '123456',
    employeeNo: 'SW_TEST_OWNER',
    mallCode: 'SMART_WING_DEMO',
    memberId: 'member-test-owner',
    adminMembershipId: 'membership-test-owner-admin',
  },
  {
    username: '李厚亿',
    password: '123456',
    employeeNo: 'SW_TEST_OWNER',
    mallCode: 'SMART_WING_DEMO',
    memberId: 'member-test-owner',
    adminMembershipId: 'membership-test-owner-admin',
  },
  ...(['02', '03', '04', '05'] as const).map((suffix) => ({
    username: `员工测试${suffix}`,
    password: '123456',
    employeeNo: `SW_SIM_E${suffix}`,
    mallCode: 'SMART_WING_DEMO',
    memberId: `member-sim-employee-${suffix}`,
    storefrontMembershipId: `membership-sim-employee-${suffix}`,
  })),
  {
    username: '管理员测试04',
    password: '123456',
    employeeNo: 'SW_SIM_A04',
    mallCode: 'SMART_WING_DEMO',
    memberId: 'member-sim-admin-04',
    adminMembershipId: 'membership-sim-admin-04',
  },
  {
    username: '管理员测试05',
    password: '123456',
    employeeNo: 'SW_SIM_A05',
    mallCode: 'SMART_WING_DEMO',
    memberId: 'member-sim-admin-05',
    adminMembershipId: 'membership-sim-admin-05',
  },
  ...buildRoleTestAccounts('buyer', 'storefront'),
  ...buildRoleTestAccounts('seller', 'admin'),
  ...buildRoleTestAccounts('ops', 'admin'),
  ...buildRoleTestAccounts('cs', 'admin'),
  ...buildRoleTestAccounts('admin', 'admin'),
];

function buildRoleTestAccounts(prefix: string, target: SessionTarget): DemoAccount[] {
  return Array.from({ length: 5 }, (_, index) => {
    const suffix = String(index + 1).padStart(3, '0');
    const username = `${prefix}${suffix}`;
    const membershipId = `membership-test-${prefix}-${suffix}`;
    return {
      username,
      password: '123456',
      employeeNo: username,
      mallCode: 'SMART_WING_DEMO',
      memberId: `member-test-${prefix}-${suffix}`,
      ...(target === 'storefront' ? { storefrontMembershipId: membershipId } : { adminMembershipId: membershipId }),
    };
  });
}

export function getDemoAccounts(env: WorkerEnv): readonly DemoAccount[] {
  return isDemoAuthEnabled(env) ? DEFAULT_DEMO_ACCOUNTS : [];
}

export async function verifyDemoPassword(supplied: string, expected: string): Promise<boolean> {
  const [suppliedHash, expectedHash] = await Promise.all([crypto.subtle.digest('SHA-256', new TextEncoder().encode(supplied)), crypto.subtle.digest('SHA-256', new TextEncoder().encode(expected))]);
  const left = new Uint8Array(suppliedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function resolveDemoMembership(env: WorkerEnv, account: DemoAccount, target: SessionTarget): Promise<MembershipRuntime | null> {
  const membershipId = target === 'admin' ? account.adminMembershipId : account.storefrontMembershipId;
  if (!membershipId) return null;
  return resolveMembershipRuntimeByIds(env, account.memberId, membershipId, target);
}
