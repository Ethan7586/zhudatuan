import type { StorefrontSession } from '../../../shared/api/Session';
import { readBenefits } from '../application/ReadBenefits';

export { readBenefits as readBenefitAccounts };

export interface BenefitBalances {
  readonly welfareMinor: number;
  readonly mealMinor: number;
}

export async function readBenefitBalances(session: StorefrontSession, signal?: AbortSignal): Promise<BenefitBalances> {
  return benefitBalances(await readBenefits(session, signal));
}

export function benefitBalances(accounts: Awaited<ReturnType<typeof readBenefits>>): BenefitBalances {
  return accounts
    .filter(({ status }) => status === 'active')
    .reduce<BenefitBalances>(
      (balances, account) => (account.kind === 'meal' ? { ...balances, mealMinor: balances.mealMinor + account.availableMinor } : { ...balances, welfareMinor: balances.welfareMinor + account.availableMinor }),
      Object.freeze({ welfareMinor: 0, mealMinor: 0 })
    );
}
