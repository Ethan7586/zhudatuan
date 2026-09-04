import { describe, expect, it } from 'vitest';
import { approvedProviderRedirect } from '../../src/shared/security/ProviderRedirect';

describe('identity provider redirect security', () => {
  it('allows an HTTPS provider authorization URL with opaque query state', () => {
    expect(approvedProviderRedirect('https://identity.example.com/authorize?state=opaque&client=mall')).toBe(
      'https://identity.example.com/authorize?state=opaque&client=mall'
    );
  });

  it.each([
    'http://identity.example.com/authorize',
    'https://user:secret@identity.example.com/authorize',
    'https://identity.example.com/authorize#token',
    '//identity.example.com/authorize',
    '/authorize',
    'javascript:alert(1)',
  ])('rejects an unsafe provider redirect: %s', (value) => {
    expect(() => approvedProviderRedirect(value)).toThrow('CONTRACT_INVALID');
  });
});
