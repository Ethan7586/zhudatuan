import { describe, expect, it } from 'vitest';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { SessionPolicy } from './SessionPolicy';

describe('SessionPolicy', () => {
  it('uses the configured two-hour browser session boundary', () => {
    expect(new SessionPolicy(RUNTIME_LIMITS.authentication.session.ttlSeconds).ttlSeconds).toBe(7_200);
  });

  it.each([0, 299, 43_201, 1.5, Number.NaN])('rejects an unsafe session duration: %s', (ttlSeconds) => {
    expect(() => new SessionPolicy(ttlSeconds)).toThrow('SESSION_POLICY_INVALID');
  });
});
