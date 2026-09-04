import { describe, expect, it } from 'vitest';
import { ReturnTargetSigner } from './ReturnTargetSigner';

const NOW = new Date('2026-08-30T00:00:00.000Z');
const TARGETS = Object.freeze({
  console: 'https://console.fufu.wang',
  storefront: 'https://fufu.wang',
  miniapp: 'https://miniapp.fufu.wang',
  store: 'https://store.fufu.wang',
  supplier: 'https://supplier.fufu.wang',
});
const signer = new ReturnTargetSigner(TARGETS, 'current-return-target-key-that-is-long-enough', 'previous-return-target-key-that-is-long-enough');

describe('ReturnTargetSigner', () => {
  it('accepts only the exact configured target before expiry', () => {
    const issued = signer.issue('console', NOW);
    expect(signer.verify(issued.proof, new Date(NOW.getTime() + 599_000))).toMatchObject({ target: 'console', url: TARGETS.console });
    expect(() => signer.verify(issued.proof, new Date(NOW.getTime() + 600_000))).toThrow('RETURN_TARGET_INVALID');
  });

  it('rejects payload tampering and cross-target replay', () => {
    const issued = signer.issue('console', NOW);
    const [payload, signature] = issued.proof.split('.') as [string, string];
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const changed = Buffer.from(JSON.stringify({ ...value, target: 'storefront', url: TARGETS.storefront })).toString('base64url');
    expect(() => signer.verify(`${changed}.${signature}`, NOW)).toThrow('RETURN_TARGET_INVALID');
  });

  it('signs and verifies a canonical storefront deep path', () => {
    const issued = signer.issue('storefront', { now: NOW, path: '/s/mall-one/orders?status=paid' });
    expect(issued.url).toBe('https://fufu.wang/s/mall-one/orders?status=paid');
    expect(signer.verify(issued.proof, NOW).url).toBe(issued.url);
    expect(() => signer.issue('storefront', { now: NOW, path: '/orders' })).toThrow('RETURN_TARGET_INVALID');
    expect(() => signer.issue('storefront', { now: NOW, path: '/s/%2fadmin' })).toThrow('RETURN_TARGET_INVALID');
  });

  it.each(['/s/mall-one?accessToken=secret', '/s/mall-one?member_id=member%3Aone', '/s/mall-one?membership-id=membership%3Aone', '/s/mall-one?cookie=secret', '/s/mall-one?phone=13800000000'])(
    'rejects sensitive identity material in a deep-link query: %s',
    (path) => {
      expect(() => signer.issue('storefront', { now: NOW, path })).toThrow('RETURN_TARGET_INVALID');
    }
  );

  it.each(['https://attacker.example', 'https://console.fufu.wang.attacker.example', 'https://user@console.fufu.wang', 'https://console.fufu.wang/#token'])('rejects open redirect tampering for destination %s', (url) => {
    const issued = signer.issue('console', NOW);
    const [payload, signature] = issued.proof.split('.') as [string, string];
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const changed = Buffer.from(JSON.stringify({ ...value, url })).toString('base64url');
    expect(() => signer.verify(`${changed}.${signature}`, NOW)).toThrow('RETURN_TARGET_INVALID');
  });
});
