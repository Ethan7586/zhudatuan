import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertLocalBenefitLedger, LOCAL_BENEFIT_GRANT } from './LocalBenefits';

describe('local benefit ledger', () => {
  for (const [scenario, balance] of [
    ['fresh baseline', LOCAL_BENEFIT_GRANT],
    ['partially consumed baseline', LOCAL_BENEFIT_GRANT - 8_900],
    ['fully consumed baseline', 0],
  ] as const)
    it(`accepts a balanced ${scenario}`, () => {
      assert.doesNotThrow(() => assertLocalBenefitLedger({ accounts: 2, lots: 2, grants: LOCAL_BENEFIT_GRANT, remaining: balance, balance }));
    });

  it('rejects a rewritten lot that no longer agrees with the finance ledger', () => {
    assert.throws(() => assertLocalBenefitLedger({ accounts: 2, lots: 2, grants: LOCAL_BENEFIT_GRANT, remaining: LOCAL_BENEFIT_GRANT, balance: LOCAL_BENEFIT_GRANT - 8_900 }), /LOCAL_BENEFIT_LEDGER_UNBALANCED/);
  });

  for (const baseline of [
    { accounts: 1, lots: 2, grants: LOCAL_BENEFIT_GRANT },
    { accounts: 2, lots: 1, grants: LOCAL_BENEFIT_GRANT },
    { accounts: 2, lots: 2, grants: LOCAL_BENEFIT_GRANT * 2 },
  ])
    it('rejects an invalid immutable grant baseline', () => {
      assert.throws(() => assertLocalBenefitLedger({ ...baseline, remaining: LOCAL_BENEFIT_GRANT, balance: LOCAL_BENEFIT_GRANT }), /LOCAL_BENEFIT_BASELINE_INCONSISTENT/);
    });
});
