import { describe, expect, it } from 'vitest';
import { calculatePaymentAllocation } from './finance';

describe('calculatePaymentAllocation', () => {
  it('prevents combined account deductions from exceeding the order total', () => {
    expect(calculatePaymentAllocation(100, 100, 50, 1000, 1000)).toEqual({
      welfare: 100,
      meal: 0,
      external: 0,
    });
  });

  it('limits deductions by account balances and calculates the remainder', () => {
    expect(calculatePaymentAllocation(100, 80, 80, 30, 20)).toEqual({
      welfare: 30,
      meal: 20,
      external: 50,
    });
  });

  it('rounds monetary values to cents and rejects negative requests', () => {
    expect(calculatePaymentAllocation(10.005, -1, 4.567, 100, 100)).toEqual({
      welfare: 0,
      meal: 4.57,
      external: 5.44,
    });
  });
});
