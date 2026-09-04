import { describe, expect, it } from 'vitest';
import { hashPassword, maskMobile, normalizeChineseMobile, normalizeLocalUsername, validRegistrationPassword, verifyPassword } from './registrationSecurity';

describe('registration credentials', () => {
  it('hashes passwords with a unique PBKDF2 salt and verifies in constant-shape comparison', async () => {
    const first = await hashPassword('SmartWing2026');
    const second = await hashPassword('SmartWing2026');
    expect(first).not.toBe(second);
    await expect(verifyPassword('SmartWing2026', first)).resolves.toBe(true);
    await expect(verifyPassword('SmartWing2027', first)).resolves.toBe(false);
    await expect(verifyPassword('SmartWing2026', 'invalid')).resolves.toBe(false);
  });

  it('enforces the public registration password baseline', () => {
    expect(validRegistrationPassword('SmartWing2026')).toBe(true);
    expect(validRegistrationPassword('1234567890')).toBe(false);
    expect(validRegistrationPassword('OnlyLetters')).toBe(false);
    expect(validRegistrationPassword('S1short')).toBe(false);
    expect(validRegistrationPassword(' SmartWing2026')).toBe(false);
    expect(validRegistrationPassword('SmartWing2026 ')).toBe(false);
  });

  it('normalizes and masks only supported mobile identifiers', () => {
    expect(normalizeChineseMobile(' 13800138000 ')).toBe('13800138000');
    expect(maskMobile('13800138000')).toBe('138****8000');
    expect(normalizeChineseMobile('123')).toBeNull();
  });

  it('normalizes supported usernames and rejects unsupported syntax', () => {
    expect(normalizeLocalUsername(' New.Employee ')).toBe('new.employee');
    expect(normalizeLocalUsername('employee_01')).toBe('employee_01');
    expect(normalizeLocalUsername('123employee')).toBeNull();
    expect(normalizeLocalUsername('ab')).toBeNull();
    expect(normalizeLocalUsername('新员工')).toBeNull();
  });
});
