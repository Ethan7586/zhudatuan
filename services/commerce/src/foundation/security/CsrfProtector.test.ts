import { describe, expect, it } from 'vitest';
import { CsrfProtector } from './CsrfProtector';

const protector = new CsrfProtector('csrf-test-key-that-is-at-least-thirty-two-bytes', {
  console: 'https://console.fufu.wang',
  storefront: 'https://fufu.wang',
});

describe('CsrfProtector', () => {
  it('binds the token to session, target, origin and expiry', () => {
    const token = protector.issue('session-secret', 'storefront', 60);
    expect(protector.verify(token, 'session-secret', 'storefront', 'https://fufu.wang')).toBe(true);
    expect(protector.verify(token, 'other-session', 'storefront', 'https://fufu.wang')).toBe(false);
    expect(protector.verify(token, 'session-secret', 'console', 'https://console.fufu.wang')).toBe(false);
    expect(protector.verify(token, 'session-secret', 'storefront', 'https://evil.example')).toBe(false);
    expect(protector.verify(token, 'session-secret', 'storefront', 'https://fufu.wang', Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it('rejects tampering without throwing', () => {
    const token = protector.issue('session-secret', 'console', 60);
    expect(protector.verify(`${token}x`, 'session-secret', 'console', 'https://console.fufu.wang')).toBe(false);
    expect(protector.verify('invalid', 'session-secret', 'console', 'https://console.fufu.wang')).toBe(false);
  });
});
