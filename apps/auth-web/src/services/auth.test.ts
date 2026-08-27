import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginWithPassword, TEST_ACCOUNT_MEMBERSHIPS, verifyStepUp } from './auth';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('public test authentication fixtures', () => {
  it('contains all 25 requested accounts with one active membership each', () => {
    const usernames = ['buyer', 'seller', 'ops', 'cs', 'admin'].flatMap((prefix) => Array.from({ length: 5 }, (_, index) => `${prefix}${String(index + 1).padStart(3, '0')}`));

    for (const username of usernames) {
      expect(TEST_ACCOUNT_MEMBERSHIPS[username]).toHaveLength(1);
      expect(TEST_ACCOUNT_MEMBERSHIPS[username][0].status).toBe('active');
    }
  });

  it('accepts a roster account and rejects former universal passwords', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ authorization: { membershipId: 'membership-test-buyer-001', target: 'storefront' } }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: '账号或密码不正确' } }), { status: 401, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const accepted = loginWithPassword('buyer001', '123456');
    await expect(accepted).resolves.toMatchObject({ identifier: 'buyer001', memberships: [{ id: 'membership-test-buyer-001', target: 'storefront' }] });

    const rejected = loginWithPassword('not-an-account', 'password123');
    await expect(rejected).rejects.toThrow('账号或密码不正确');
  });

  it('requires the documented test step-up code', async () => {
    vi.useFakeTimers();
    const rejected = verifyStepUp('pat', 'membership', '654321');
    const rejectedAssertion = expect(rejected).rejects.toThrow('动态口令错误');
    await vi.runAllTimersAsync();
    await rejectedAssertion;

    const accepted = verifyStepUp('pat', 'membership', '123456');
    await vi.runAllTimersAsync();
    await expect(accepted).resolves.toMatchObject({ targetDomain: 'smart.hbbtzn.com' });
  });
});
