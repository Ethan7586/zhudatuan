import { describe, expect, it } from 'vitest';
import { PaymentLifecycle, type ProviderPaymentState } from './PaymentLifecycle';

describe('PaymentLifecycle', () => {
  const policy = new PaymentLifecycle();

  it.each([
    ['succeeded', false, 'settle'], ['succeeded', true, 'settle'], ['refunded', false, 'recover'], ['refunded', true, 'recover'],
    ['pending', false, 'requery'], ['pending', true, 'close'], ['closed', false, 'expire'], ['absent', true, 'expire'],
    ['failed', true, 'expire'], ['absent', false, 'reset'], ['failed', false, 'reset'],
  ] satisfies readonly [ProviderPaymentState, boolean, string][])(
    'maps provider=%s expired=%s to %s after query', (state, expired, action) => expect(policy.afterQuery(state, expired)).toBe(action),
  );

  it.each([
    ['succeeded', 'settle'], ['refunded', 'recover'], ['pending', 'requery'], ['closed', 'expire'], ['absent', 'expire'], ['failed', 'expire'],
  ] satisfies readonly [ProviderPaymentState, string][])(
    'maps provider=%s to %s after close', (state, action) => expect(policy.afterClose(state)).toBe(action),
  );
});
