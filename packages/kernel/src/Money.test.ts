import { describe, expect, it } from 'vitest';
import { Money } from './Money';

describe('Money', () => {
  it('uses only safe integer minor units', () => {
    expect(Money.of(1200).add(Money.of(34)).minor).toBe(1234);
    expect(Money.of(Number.MAX_SAFE_INTEGER).multiplyRatio(1, 10_000).minor).toBe(900719925474);
    expect(() => Money.of(0.1)).toThrow('MONEY_MINOR_INVALID');
    expect(() => Money.of(Number.MAX_SAFE_INTEGER).add(Money.of(1))).toThrow('MONEY_OVERFLOW');
    expect(() => Money.of(1).multiplyRatio(1, 0)).toThrow('MONEY_RATIO_INVALID');
  });
});
