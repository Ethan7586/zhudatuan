import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveAdminLoginOrigin, resolveBuildTimeOrigin, resolveStorefrontLoginOrigin } from './originPolicy';

const policy = (configuredOrigin?: string, stagingOrigin?: string, allowLocalDevelopment = false) => ({
  canonicalOrigin: 'https://api.zhudatuan.com',
  configuredOrigin,
  stagingOrigin,
  allowLocalDevelopment,
  invalidMessage: 'ORIGIN_INVALID',
  deniedMessage: 'ORIGIN_DENIED',
});

describe('Auth build-time origin policy', () => {
  it('defaults to the canonical production origin without widening the allowlist', () => {
    expect(resolveBuildTimeOrigin(policy())).toBe('https://api.zhudatuan.com');
    expect(() => resolveBuildTimeOrigin(policy('https://attacker.example'))).toThrow('ORIGIN_DENIED');
  });

  it('allows one explicitly paired isolated staging HTTPS origin', () => {
    expect(resolveBuildTimeOrigin(policy('https://api.staging.example', 'https://api.staging.example/')))
      .toBe('https://api.staging.example');
  });

  it.each([
    'http://api.staging.example',
    'https://user:secret@api.staging.example',
    'https://api.staging.example/path',
    'https://api.staging.example?target=other',
    'https://api.staging.example#other',
  ])('rejects malformed or non-HTTPS staging allowlist value %s', (stagingOrigin) => {
    expect(() => resolveBuildTimeOrigin(policy('https://api.zhudatuan.com', stagingOrigin))).toThrow('ORIGIN_INVALID');
  });

  it('keeps loopback HTTP available only when the development flag is explicit', () => {
    expect(resolveBuildTimeOrigin(policy('http://127.0.0.1:3001', undefined, true))).toBe('http://127.0.0.1:3001');
    expect(() => resolveBuildTimeOrigin(policy('http://127.0.0.1:3001'))).toThrow('ORIGIN_DENIED');
  });
});

describe('canonical identity return origin policy', () => {
  it('preserves the approved admin and storefront origins after leaving the legacy auth module', () => {
    expect(resolveAdminLoginOrigin()).toBe('https://console.zhudatuan.com');
    expect(resolveStorefrontLoginOrigin()).toBe('https://hbbtzn.com');
    expect(resolveStorefrontLoginOrigin('https://zhudatuan.com')).toBe('https://zhudatuan.com');
  });

  it('keeps canonical identity physically disconnected from the legacy auth module', () => {
    const source = readFileSync(new URL('./canonicalIdentity.ts', import.meta.url), 'utf8');
    expect(source).toContain("from './originPolicy'");
    expect(source).not.toContain("from './auth'");
  });
});
