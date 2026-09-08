import { describe, expect, it } from 'vitest';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { localPassword } from './LocalPassword';

describe('local password', () => {
  it('always satisfies the canonical password policy with unique random entropy', () => {
    const policy = RUNTIME_LIMITS.authentication.password;
    const passwords = Array.from({ length: 64 }, localPassword);

    for (const password of passwords) {
      expect(password.length).toBeGreaterThanOrEqual(policy.minimumLength);
      expect(password.length).toBeLessThanOrEqual(policy.maximumLength);
      if (policy.uppercase) expect(password).toMatch(/[A-Z]/);
      if (policy.lowercase) expect(password).toMatch(/[a-z]/);
      if (policy.number) expect(password).toMatch(/\d/);
      if (policy.symbol) expect(password).toMatch(/[^A-Za-z0-9]/);
    }
    expect(new Set(passwords)).toHaveLength(passwords.length);
    expect(localPassword(passwords[0])).toBe(passwords[0]);
    expect(localPassword('invalid')).not.toBe('invalid');
  });
});
