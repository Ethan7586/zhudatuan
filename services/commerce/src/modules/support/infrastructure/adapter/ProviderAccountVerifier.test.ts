import type { SecretMaterial } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { ProviderAccountVerifier } from './ProviderAccountVerifier';

describe('ProviderAccountVerifier', () => {
  it('probes an external provider outside persistence and returns only a safe summary', async () => {
    const reveal = vi.fn(() => JSON.stringify({ endpoint: 'https://support-provider.example/', bearer: 'provider-token-long-enough', healthPath: '/ready' }));
    const resolve = vi.fn(async () => material('version:7', reveal));
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer provider-token-long-enough', 'x-support-provider': 'email', 'x-support-scope': 'mall:one' });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const result = await new ProviderAccountVerifier({ resolve }, fetcher).verify({ provider: 'email', scope: 'mall:one', secretRef: 'support/email/main' }, execution());

    expect(resolve).toHaveBeenCalledWith('support/email/main');
    expect(reveal).toHaveBeenCalledWith('providerconfig');
    expect(fetcher).toHaveBeenCalledWith(new URL('https://support-provider.example/ready'), expect.any(Object));
    expect(result).toMatchObject({ secretRef: 'support/email/main', secretVersion: 'version:7', state: 'verified', code: 'SUPPORT_ACCOUNT_CONNECTED' });
    expect(JSON.stringify(result)).not.toContain('provider-token-long-enough');
  });

  it('uses a no-secret local strategy and fails closed for invalid external credentials', async () => {
    const resolve = vi.fn(async () => material('version:1', () => '{}'));
    const verifier = new ProviderAccountVerifier({ resolve }, vi.fn());

    await expect(verifier.verify({ provider: 'inapp', scope: 'mall:one', secretRef: null }, execution())).resolves.toMatchObject({ state: 'notrequired', code: 'SUPPORT_ACCOUNT_LOCAL' });
    await expect(verifier.verify({ provider: 'sms', scope: 'mall:one', secretRef: null }, execution())).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { field: 'secretRef' } });
    await expect(verifier.verify({ provider: 'sms', scope: 'mall:one', secretRef: 'support/sms/main' }, execution())).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

function material(version: string, reveal: () => string): SecretMaterial {
  return { version, expiresAt: null, reveal };
}

function execution() {
  return {
    requestId: 'request:one',
    traceId: 'trace:one',
    deadline: Date.now() + 10_000,
    signal: new AbortController().signal,
    operation: 'support.accounts.manage' as const,
    headers: {},
    rawBody: '{}',
    security: { kind: 'anonymous' as const, channel: 'public' as const, target: 'console' as const, trace: 'trace:one' },
  };
}
