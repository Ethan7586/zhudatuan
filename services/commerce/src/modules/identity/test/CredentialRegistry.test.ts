import { describe, expect, it, vi } from 'vitest';
import type { AuthenticationStrategy } from '../application/service/AuthenticationStrategy';
import { CredentialRegistry } from '../infrastructure/registry/CredentialRegistry';

describe('CredentialRegistry', () => {
  it('owns exactly the password and OTP credential branches', () => {
    const password = strategy('password');
    const otp = strategy('otp');
    const registry = new CredentialRegistry([password, otp]);

    expect(registry.resolve('password')).toBe(password);
    expect(registry.resolve('otp')).toBe(otp);
    expect(() => registry.resolve('invitation')).toThrow('IDENTITY_PROVIDER_INVALID');
    expect(() => registry.resolve('federation')).toThrow('IDENTITY_PROVIDER_INVALID');
  });

  it('fails closed when a credential strategy is missing or duplicated', () => {
    const password = strategy('password');
    expect(() => new CredentialRegistry([password])).toThrow('AUTHENTICATION_STRATEGY_MISSING:otp');
    expect(() => new CredentialRegistry([password, password])).toThrow('AUTHENTICATION_STRATEGY_DUPLICATE');
  });
});

function strategy(method: 'password' | 'otp'): AuthenticationStrategy & Readonly<{ method: 'password' | 'otp' }> {
  return { method, load: vi.fn() };
}
