import { identityClientSchema } from '@shop/contract/identityschema';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../pipeline/OperationRequest';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { ReadIdentityBootstrap } from '../application/service/ReadIdentityBootstrap';

describe('ReadIdentityBootstrap', () => {
  it('projects only public password rules into the strict bootstrap contract', async () => {
    const action = new ReadIdentityBootstrap(
      {
        issue: vi.fn(() => ({ target: 'storefront' as const, url: 'http://127.0.0.1:3000', proof: 'return-proof', expiresAt: '2099-01-01T00:00:00.000Z' })),
        verify: vi.fn(),
      },
      {
        current: vi.fn(async () => ({
          id: 'policy:one',
          terms_title: '服务协议',
          terms_body: '服务条款正文',
          privacy_title: '隐私政策',
          privacy_body: '隐私政策正文',
          terms_hash: 'terms-hash',
        })),
        read: vi.fn(),
      }
    ).action();

    const result = await action(request(), {} as ReadTransactionContext);
    const body = result.body as Record<string, unknown>;
    const password = body.password as Record<string, unknown>;

    expect(identityClientSchema('identity.bootstrap.read').output.parse(body)).toEqual(body);
    expect(body.methods).toEqual(['password', 'otp', 'federation']);
    expect(body.preferredMethod).toBe('password');
    expect(body.methods).not.toContain('invitation');
    expect(Object.keys(password).sort()).toEqual(['lowercase', 'maximumLength', 'minimumLength', 'number', 'symbol', 'uppercase']);
    expect(password).not.toHaveProperty('maximumConcurrency');
    expect(password).not.toHaveProperty('maximumQueue');
  });
});

function request(): OperationRequest {
  return {
    type: 'identity.bootstrap.read',
    input: {
      path: {},
      query: {},
      headers: { 'x-client-target': 'storefront' },
      rawBody: '',
      body: undefined,
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
    },
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:bootstrap' },
  };
}
