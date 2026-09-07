import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordMeetsPolicy,
} from './PasswordPolicyContract';

describe('password policy contract', () => {
  it('accepts 6-128 non-whitespace characters except the exact value 123456', () => {
    expect(passwordMeetsPolicy('12345')).toBe(false);
    expect(passwordMeetsPolicy('123456')).toBe(false);
    expect(passwordMeetsPolicy('654321')).toBe(true);
    expect(passwordMeetsPolicy('abcdef')).toBe(true);
    expect(passwordMeetsPolicy('      ')).toBe(false);
    expect(passwordMeetsPolicy('abc 123')).toBe(false);
    expect(passwordMeetsPolicy('abc\t123')).toBe(false);
    expect(passwordMeetsPolicy('1234567')).toBe(true);
    expect(passwordMeetsPolicy('a'.repeat(PASSWORD_MIN_LENGTH))).toBe(true);
    expect(passwordMeetsPolicy('a'.repeat(PASSWORD_MAX_LENGTH))).toBe(true);
    expect(passwordMeetsPolicy('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });
});
