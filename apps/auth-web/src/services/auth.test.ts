import { afterEach, describe, expect, it, vi } from 'vitest';
<<<<<<< HEAD
import {
  acceptInvitation,
  buildCredentialLoginAction,
  requiresAuthoritativeMembershipSelection,
  resolveAdminLoginOrigin,
  resolveStorefrontLoginOrigin,
  TEST_ACCOUNT_MEMBERSHIPS,
  verifyStepUp,
} from './auth';
=======
import { loginWithPassword, TEST_ACCOUNT_MEMBERSHIPS, verifyStepUp } from './auth';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('public test authentication fixtures', () => {
<<<<<<< HEAD
  it('proxies local auth requests to the compatibility BFF rather than canonical API', () => {
    const viteConfig = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');

    expect(viteConfig).toContain("process.env.AUTH_COMPAT_API_ORIGIN ?? 'http://127.0.0.1:3000'");
    expect(viteConfig).not.toContain("'http://127.0.0.1:3001'");
  });

  it('only permits the canonical admin origin plus explicit local development', () => {
    expect(resolveAdminLoginOrigin()).toBe('https://console.zhudatuan.com');
    expect(resolveAdminLoginOrigin('http://127.0.0.1:4173', true)).toBe('http://127.0.0.1:4173');
    expect(resolveAdminLoginOrigin('https://console.staging.example', false, 'https://console.staging.example')).toBe('https://console.staging.example');
    expect(() => resolveAdminLoginOrigin('https://example.com')).toThrow('不在允许清单');
    expect(() => resolveAdminLoginOrigin('https://console.staging.example', false, 'http://console.staging.example')).toThrow('配置无效');
    expect(() => resolveAdminLoginOrigin('http://127.0.0.1:3001')).toThrow('不在允许清单');
  });

  it('only permits the canonical storefront origin plus explicit local development', () => {
    expect(resolveStorefrontLoginOrigin()).toBe('https://zhudatuan.com');
    expect(resolveStorefrontLoginOrigin('http://127.0.0.1:3000', true)).toBe('http://127.0.0.1:3000');
    expect(resolveStorefrontLoginOrigin('https://store.staging.example', false, 'https://store.staging.example')).toBe('https://store.staging.example');
    expect(() => resolveStorefrontLoginOrigin('https://example.com')).toThrow('不在允许清单');
    expect(() => resolveStorefrontLoginOrigin('http://127.0.0.1:3000')).toThrow('不在允许清单');
  });

  it('builds a credential-free login URL for top-level POST', () => {
    const action = buildCredentialLoginAction(resolveStorefrontLoginOrigin());

    expect(action).toBe('https://zhudatuan.com/api/v1/auth/login?redirect=%2F');
    expect(action).not.toContain('username');
    expect(action).not.toContain('password');
  });

  it('fails closed when more than one usable membership needs server-side selection', () => {
    expect(
      requiresAuthoritativeMembershipSelection([
        { id: 'one', target: 'storefront', status: 'active', enterpriseName: 'A', storeName: 'A', roleName: 'A', dataScope: 'A' },
        { id: 'two', target: 'admin', status: 'invited', enterpriseName: 'B', storeName: 'B', roleName: 'B', dataScope: 'B' },
      ])
    ).toBe(true);
    expect(requiresAuthoritativeMembershipSelection([{ id: 'one', target: 'storefront', status: 'active', enterpriseName: 'A', storeName: 'A', roleName: 'A', dataScope: 'A' }])).toBe(false);
  });

  it('builds one relocatable artifact with accounts-domain metadata', () => {
    const viteConfig = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const manifest = readFileSync(new URL('../../public/brand/site.webmanifest', import.meta.url), 'utf8');

    expect(viteConfig).toContain("base: command === 'build' ? './' : '/'");
    expect(html).toContain('https://accounts.zhudatuan.com/');
    // The manifest lives in brand/, so ../ resolves to either the accounts
    // root or the optional /login/ mount without hard-coding either path.
    expect(JSON.parse(manifest)).toMatchObject({ start_url: '../', scope: '../' });
  });

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  it('contains all 25 requested accounts with one active membership each', () => {
    const usernames = ['buyer', 'seller', 'ops', 'cs', 'admin'].flatMap((prefix) => Array.from({ length: 5 }, (_, index) => `${prefix}${String(index + 1).padStart(3, '0')}`));

    for (const username of usernames) {
      expect(TEST_ACCOUNT_MEMBERSHIPS[username]).toHaveLength(1);
      expect(TEST_ACCOUNT_MEMBERSHIPS[username][0].status).toBe('active');
    }
  });

<<<<<<< HEAD
  it('fails closed for unfinished invitation and step-up services', async () => {
    await expect(acceptInvitation()).rejects.toThrow('不会模拟授权成功');
    await expect(verifyStepUp()).rejects.toThrow('不会接受固定口令');
  });

=======
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
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
});
