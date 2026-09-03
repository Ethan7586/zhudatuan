import { describe, expect, it } from 'vitest';
import { mapBootstrap } from '../../src/feature/bootstrap/infrastructure/BootstrapMapper';
import { bootstrapOutput } from '../TestData';

describe('bootstrap contract', () => {
  it('maps the server-owned method, timing, password and legal policies', () => {
    const result = mapBootstrap(bootstrapOutput());
    expect(result).toMatchObject({ target: 'storefront', preferredMethod: 'password', csrf: 'csrf-token' });
    expect(result.password).toEqual({ minimumLength: 12, maximumLength: 128, uppercase: true, lowercase: true, number: true, symbol: true });
    expect(result.legal).toEqual({ termsTitle: '服务协议', termsBody: '服务条款正文', privacyTitle: '隐私政策', privacyBody: '隐私政策正文', termsHash: 'terms-hash' });
    expect(Object.isFrozen(result.methods)).toBe(true);
  });

  it('rejects a bootstrap response with an invalid expiry', () => {
    expect(() => mapBootstrap({ ...bootstrapOutput(), expiresAt: 'invalid' })).toThrow('CONTRACT_INVALID');
  });
});
