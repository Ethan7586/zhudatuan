import { describe, expect, it } from 'vitest';
import { localBootstrapPassword } from './LocalPassword';

describe('localBootstrapPassword', () => {
  it('always satisfies the canonical password character policy', () => {
    const passwords = Array.from({ length: 256 }, () => localBootstrapPassword());

    expect(new Set(passwords).size).toBe(passwords.length);
    for (const password of passwords) {
      expect(password.length).toBeGreaterThanOrEqual(12);
      expect(password.length).toBeLessThanOrEqual(128);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/\d/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });
});
