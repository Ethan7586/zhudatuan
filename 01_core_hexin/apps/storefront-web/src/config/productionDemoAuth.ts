import type { MembershipRuntime } from '../../../../services/commerce-api/src/api/membershipContext';
import type { SessionTarget } from '../../../../services/commerce-api/src/api/session';
import type { WorkerEnv } from '../../../../services/commerce-api/src/api/types';

export interface DemoAccount {
  username: string;
  password: string;
  employeeNo: string;
  mallCode: string;
  memberId: string;
  storefrontMembershipId?: string;
  adminMembershipId?: string;
}

/** Production Storefront builds cannot enable or even bundle fixture credentials. */
export function isDemoAuthEnabled(_env: WorkerEnv): false {
  return false;
}

export function getDemoAccounts(_env: WorkerEnv): readonly DemoAccount[] {
  return [];
}

export async function verifyDemoPassword(_supplied: string, _expected: string): Promise<false> {
  return false;
}

export async function resolveDemoMembership(_env: WorkerEnv, _account: DemoAccount, _target: SessionTarget): Promise<MembershipRuntime | null> {
  return null;
}
