import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acceptInvitation,
  buildCredentialLoginAction,
  requiresAuthoritativeMembershipSelection,
  resolveAdminLoginOrigin,
  resolveStorefrontLoginOrigin,
  TEST_ACCOUNT_MEMBERSHIPS,
  verifyStepUp,
} from './auth';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('public test authentication fixtures', () => {
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
    expect(resolveStorefrontLoginOrigin()).toBe('https://mall.hbbtzn.com');
    expect(resolveStorefrontLoginOrigin('https://zhudatuan.com')).toBe('https://zhudatuan.com');
    expect(resolveStorefrontLoginOrigin('http://127.0.0.1:3000', true)).toBe('http://127.0.0.1:3000');
    expect(resolveStorefrontLoginOrigin('https://store.staging.example', false, 'https://store.staging.example')).toBe('https://store.staging.example');
    expect(() => resolveStorefrontLoginOrigin('https://example.com')).toThrow('不在允许清单');
    expect(() => resolveStorefrontLoginOrigin('http://127.0.0.1:3000')).toThrow('不在允许清单');
  });

  it('builds a credential-free login URL for top-level POST', () => {
    const action = buildCredentialLoginAction(resolveStorefrontLoginOrigin());

    expect(action).toBe('https://mall.hbbtzn.com/api/v1/auth/login?redirect=%2F');
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
    expect(html).toContain('https://accounts.hbbtzn.com/');
    // The manifest lives in brand/, so ../ resolves to either the accounts
    // root or the optional /login/ mount without hard-coding either path.
    expect(JSON.parse(manifest)).toMatchObject({ start_url: '../', scope: '../' });
  });

  it('contains all 25 requested accounts with one active membership each', () => {
    const usernames = ['buyer', 'seller', 'ops', 'cs', 'admin'].flatMap((prefix) => Array.from({ length: 5 }, (_, index) => `${prefix}${String(index + 1).padStart(3, '0')}`));

    for (const username of usernames) {
      expect(TEST_ACCOUNT_MEMBERSHIPS[username]).toHaveLength(1);
      expect(TEST_ACCOUNT_MEMBERSHIPS[username][0].status).toBe('active');
    }
  });

  it('fails closed for unfinished invitation and step-up services', async () => {
    await expect(acceptInvitation()).rejects.toThrow('不会模拟授权成功');
    await expect(verifyStepUp()).rejects.toThrow('不会接受固定口令');
  });

});
