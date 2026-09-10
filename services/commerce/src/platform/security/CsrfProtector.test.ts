import { describe, expect, it } from 'vitest';
import { CsrfProtector } from './CsrfProtector';

const protector = new CsrfProtector('csrf-test-key-that-is-at-least-thirty-two-bytes', {
  console: 'https://console.yengze.press',
  storefront: 'https://yengze.press',
  miniapp: 'https://miniapp.yengze.press',
  store: 'https://store.yengze.press',
  supplier: 'https://supplier.yengze.press',
});

describe('CsrfProtector', () => {
  it('binds the token to session, target, origin and expiry', () => {
    const token = protector.issue('session-secret', 'storefront', 60);
    expect(protector.verify(token, 'session-secret', 'storefront', 'https://yengze.press')).toBe(true);
    expect(protector.verify(token, 'other-session', 'storefront', 'https://yengze.press')).toBe(false);
    expect(protector.verify(token, 'session-secret', 'console', 'https://console.yengze.press')).toBe(false);
    expect(protector.verify(token, 'session-secret', 'storefront', 'https://evil.example')).toBe(false);
    expect(protector.verify(token, 'session-secret', 'storefront', 'https://yengze.press', Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it('rejects tampering without throwing', () => {
    const token = protector.issue('session-secret', 'console', 60);
    expect(protector.verify(`${token}x`, 'session-secret', 'console', 'https://console.yengze.press')).toBe(false);
    expect(protector.verify('invalid', 'session-secret', 'console', 'https://console.yengze.press')).toBe(false);
  });
});
