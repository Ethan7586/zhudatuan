import { describe, expect, it } from 'vitest';
import { VoucherPolicy, type VoucherState } from './VoucherPolicy';

describe('VoucherPolicy', () => {
  const policy = new VoucherPolicy();

  it.each([
    ['created', 'active'], ['created', 'expired'], ['created', 'void'],
    ['active', 'bound'], ['active', 'reserved'], ['active', 'disabled'], ['active', 'redeemed'], ['active', 'expired'], ['active', 'void'],
    ['bound', 'active'], ['bound', 'reserved'], ['bound', 'disabled'], ['bound', 'redeemed'], ['bound', 'expired'], ['bound', 'void'],
    ['reserved', 'active'], ['reserved', 'bound'], ['reserved', 'redeemed'], ['reserved', 'expired'],
    ['disabled', 'active'], ['disabled', 'bound'], ['disabled', 'expired'], ['disabled', 'void'],
  ] satisfies readonly [VoucherState, VoucherState][])(
    'allows %s to %s', (current, next) => expect(() => policy.assertTransition(current, next)).not.toThrow(),
  );

  it.each([
    ['created', 'redeemed'], ['reserved', 'disabled'], ['reserved', 'void'],
    ['redeemed', 'active'], ['expired', 'active'], ['void', 'active'],
  ] satisfies readonly [VoucherState, VoucherState][])(
    'rejects %s to %s', (current, next) => expect(() => policy.assertTransition(current, next)).toThrow('VOUCHER_STATE_INVALID'),
  );
});
