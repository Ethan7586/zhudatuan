import { describe, expect, it } from 'vitest';
import { localVerificationCode } from './LocalVerificationCode';

describe('local verification code', () => {
  it('creates one valid code and preserves it across local preparation', () => {
    const created = localVerificationCode();
    expect(created).toMatch(/^\d{6}$/);
    expect(localVerificationCode(created)).toBe(created);
  });

  it('replaces invalid legacy values', () => {
    expect(localVerificationCode('invalid')).toMatch(/^\d{6}$/);
  });
});
