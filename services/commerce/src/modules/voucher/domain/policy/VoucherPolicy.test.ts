import { describe, expect, it } from 'vitest';
import { VoucherPolicy, type VoucherState } from './VoucherPolicy';

describe('VoucherPolicy', () => {
  const policy = new VoucherPolicy();

  it.each([
    ['inactive', 'active'],
    ['inactive', 'expired'],
    ['inactive', 'void'],
    ['active', 'held'],
    ['active', 'disabled'],
    ['active', 'redeemed'],
    ['active', 'expired'],
    ['active', 'void'],
    ['held', 'active'],
    ['held', 'redeemed'],
    ['held', 'expired'],
    ['redeemed', 'reversed'],
    ['disabled', 'expired'],
    ['disabled', 'void'],
  ] satisfies readonly [VoucherState, VoucherState][])('allows %s to %s', (current, next) => expect(() => policy.assertTransition(current, next)).not.toThrow());

  it.each([
    ['inactive', 'redeemed'],
    ['held', 'disabled'],
    ['held', 'void'],
    ['redeemed', 'active'],
    ['reversed', 'active'],
    ['disabled', 'active'],
    ['expired', 'active'],
    ['void', 'active'],
  ] satisfies readonly [VoucherState, VoucherState][])('rejects %s to %s', (current, next) => expect(() => policy.assertTransition(current, next)).toThrow('VOUCHER_STATE_INVALID'));
});
