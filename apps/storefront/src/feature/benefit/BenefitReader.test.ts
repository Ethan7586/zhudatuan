import { describe, expect, it } from 'vitest';
import type { BenefitAccount } from './model/BenefitAccount';
import { benefitBalances } from './public/BenefitReader';

describe('benefit balances', () => {
  it('keeps welfare and meal balances separate and ignores inactive accounts', () => {
    const account = (kind: BenefitAccount['kind'], availableMinor: number, status: BenefitAccount['status'] = 'active'): BenefitAccount => ({
      id: `${kind}:${status}`,
      kind,
      currency: 'CNY',
      status,
      balanceMinor: availableMinor,
      frozenMinor: 0,
      availableMinor,
      lots: [],
    });
    expect(benefitBalances([account('welfare', 500_000), account('meal', 100_000), account('allowance', 20_000), account('meal', 90_000, 'frozen')])).toEqual({ welfareMinor: 520_000, mealMinor: 100_000 });
  });
});
