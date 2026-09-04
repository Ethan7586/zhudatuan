import { expect, it } from 'vitest';
import { assertProviderFailure } from '@shop/providercore/test';
import { HeaderAuthenticator } from '@shop/providercore';
import { mapTmallError, TmallAuthenticator } from '../integration';
import { manifest } from '../Manifest';

it('fails tmall closed without leaking raw errors', () => expect(() => assertProviderFailure(mapTmallError, 'TMALL', manifest)).not.toThrow());

it('rejects expired authorization and signature clock skew', async () => {
  const now = Date.parse('2026-09-06T00:00:00Z');
  const input = { method: 'POST', path: '/orders', body: '{}', timestamp: '2026-09-06T00:00:00Z', nonce: 'nonce' };
  await expect(new TmallAuthenticator(new HeaderAuthenticator('x-auth', 'signed'), '2026-09-05T00:00:00Z', () => now).authenticate(input)).rejects.toThrow('TMALL_AUTHORIZATION_EXPIRED');
  await expect(new TmallAuthenticator(new HeaderAuthenticator('x-auth', 'signed'), '2026-09-07T00:00:00Z', () => now).authenticate({ ...input, timestamp: '2026-09-05T23:50:00Z' })).rejects.toThrow('TMALL_SIGNATURE_CLOCK_SKEW');
});
