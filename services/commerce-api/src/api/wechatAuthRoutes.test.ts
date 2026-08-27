import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeWechatCode, handleWechatRegistration, handleWechatSession } from './wechatAuthRoutes';
import type { WorkerEnv } from './types';

const env = {
  WECHAT_MINIAPP_APP_ID: 'wx-test-app',
  WECHAT_MINIAPP_APP_SECRET: 'server-only-secret',
};

describe('WeChat mini-program code exchange', () => {
  it('exchanges a one-time code without returning session_key', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe('api.weixin.qq.com');
      expect(url.searchParams.get('appid')).toBe('wx-test-app');
      expect(url.searchParams.get('secret')).toBe('server-only-secret');
      expect(url.searchParams.get('js_code')).toBe('one-time-code');
      return new Response(JSON.stringify({ openid: 'openid-1', unionid: 'unionid-1', session_key: 'must-not-leak' }), {
        headers: { 'content-type': 'application/json' },
      });
    });
    await expect(exchangeWechatCode(env, 'one-time-code', fetcher as typeof fetch)).resolves.toEqual({ ok: true, openId: 'openid-1', unionId: 'unionid-1' });
  });

  it('maps an invalid code to a stable client error without provider detail', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ errcode: 40029, errmsg: 'invalid code' }), { headers: { 'content-type': 'application/json' } }));
    await expect(exchangeWechatCode(env, 'expired', fetcher as typeof fetch)).resolves.toEqual({
      ok: false,
      status: 401,
      code: 'INVALID_WECHAT_CODE',
      message: '微信登录凭证已失效，请重试',
    });
  });

  it('fails closed when WeChat cannot be reached', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('network detail must not escape');
    });
    await expect(exchangeWechatCode(env, 'code', fetcher as typeof fetch)).resolves.toMatchObject({ ok: false, status: 502, code: 'WECHAT_AUTH_UNAVAILABLE' });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('WeChat mini-program silent enrollment', () => {
  it('creates one basic member when the verified WeChat identity is new', async () => {
    const database = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('api.weixin.qq.com/sns/jscode2session')) {
        return response({ openid: 'openid-new', unionid: 'unionid-new', session_key: 'must-not-leak' });
      }
      if (url.includes('/rpc/api_resolve_wechat_identity')) return response(null);
      if (url.includes('/rpc/api_ensure_wechat_member')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          p_app_id: 'wx-test-app',
          p_open_id: 'openid-new',
          p_union_id: 'unionid-new',
          p_mall_slug: 'smart-wing-demo',
        });
        return response({ status: 'active', created: true, memberId: 'member-one', membershipId: 'membership-one' });
      }
      if (url.includes('/rpc/api_resolve_membership_context')) return response(activeRuntime());
      if (url.includes('/rpc/api_create_auth_session')) return response(true);
      return new Response('unexpected request', { status: 500 });
    });
    vi.stubGlobal('fetch', database);

    const result = await handleWechatSession(sessionRequest(), sessionEnv(), 'wechat-silent-new');

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toMatchObject({
      authenticated: true,
      accessToken: expect.stringMatching(/^swm1\./),
      authorization: { memberId: 'member-one', membershipId: 'membership-one' },
    });
    const urls = database.mock.calls.map(([value]) => String(value));
    expect(urls.filter((url) => url.includes('/rpc/api_ensure_wechat_member'))).toHaveLength(1);
    expect(urls.some((url) => url.includes('/rpc/api_create_wechat_binding_challenge'))).toBe(false);
  });

  it('reuses an existing WeChat membership without creating another member', async () => {
    const database = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('api.weixin.qq.com/sns/jscode2session')) return response({ openid: 'openid-existing' });
      if (url.includes('/rpc/api_resolve_wechat_identity')) return response({ memberId: 'member-one', membershipId: 'membership-one' });
      if (url.includes('/rpc/api_resolve_membership_context')) return response(activeRuntime());
      if (url.includes('/rpc/api_create_auth_session')) return response(true);
      return new Response('unexpected request', { status: 500 });
    });
    vi.stubGlobal('fetch', database);

    const result = await handleWechatSession(sessionRequest(), sessionEnv(), 'wechat-silent-existing');

    expect(result.status).toBe(200);
    const urls = database.mock.calls.map(([value]) => String(value));
    expect(urls.some((url) => url.includes('/rpc/api_ensure_wechat_member'))).toBe(false);
  });
});

describe('WeChat mini-program registration', () => {
  it('atomically creates and binds one membership before issuing a session', async () => {
    const runtime = {
      id: 'membership-one',
      memberId: 'member-one',
      target: 'storefront',
      status: 'active',
      roleIds: ['employee'],
      permissions: [],
      deniedPermissions: [],
      context: { tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', userId: 'user-one' },
      scopeBindings: [{ kind: 'self', resourceId: 'user-one' }],
      authzVersion: 1,
      actor: {
        tenantId: 'tenant-one',
        enterpriseId: 'enterprise-one',
        mallId: 'mall-one',
        mallCode: 'MALL',
        userId: 'user-one',
        employeeNo: 'E-001',
      },
    };
    const database = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/rpc/api_username_registration_allowed')) return response(true);
      if (url.includes('/rpc/api_register_and_bind_wechat_member')) {
        return response({ status: 'active', memberId: 'member-one', membershipId: 'membership-one', username: 'new.employee', employeeNo: 'E-001' });
      }
      if (url.includes('/rpc/api_resolve_membership_context')) return response(runtime);
      if (url.includes('/rpc/api_create_auth_session')) return response(true);
      return new Response('unexpected RPC', { status: 500 });
    });
    vi.stubGlobal('fetch', database);
    const registrationEnv: WorkerEnv = {
      APP_ENV: 'test',
      AUTH_MODE: 'test',
      SUPABASE_URL: 'https://db.example',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      WECHAT_MINIAPP_APP_ID: 'wx-test-app',
      WECHAT_MINIAPP_APP_SECRET: 'server-only-secret',
      MINIAPP_SESSION_SIGNING_KEY: 'miniapp-session-key-longer-than-thirty-two-bytes',
      USERNAME_REGISTRATION_ENABLED: 'true',
    };
    const request = new Request('https://hbbtzn.com/api/v1/auth/wechat/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9', 'user-agent': 'WeChat Mini Program' },
      body: JSON.stringify({
        bindingChallenge: '11111111-1111-4111-8111-111111111111',
        username: 'New.Employee',
        password: 'SmartWing2026',
        displayName: '新员工',
        inviteCode: 'SW-EMPLOYEE-2026',
        acceptedTerms: true,
      }),
    });

    const result = await handleWechatRegistration(request, registrationEnv, 'wechat-register');
    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toMatchObject({ authenticated: true, accessToken: expect.stringMatching(/^swm1\./) });
    const urls = database.mock.calls.map(([value]) => String(value));
    expect(urls.filter((url) => url.includes('/rpc/api_register_and_bind_wechat_member'))).toHaveLength(1);
    expect(urls.some((url) => url.includes('/rpc/api_register_username_member'))).toBe(false);
    expect(urls.some((url) => url.includes('/rpc/api_bind_wechat_identity'))).toBe(false);
  });
});

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}

function sessionRequest(): Request {
  return new Request('https://hbbtzn.com/api/v1/auth/wechat/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9', 'user-agent': 'WeChat Mini Program' },
    body: JSON.stringify({ code: 'one-time-code' }),
  });
}

function sessionEnv(): WorkerEnv {
  return {
    APP_ENV: 'test',
    AUTH_MODE: 'test',
    SUPABASE_URL: 'https://db.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    WECHAT_MINIAPP_APP_ID: 'wx-test-app',
    WECHAT_MINIAPP_APP_SECRET: 'server-only-secret',
    MINIAPP_SESSION_SIGNING_KEY: 'miniapp-session-key-longer-than-thirty-two-bytes',
    PUBLIC_MALL_SLUG: 'smart-wing-demo',
  };
}

function activeRuntime() {
  return {
    id: 'membership-one',
    memberId: 'member-one',
    target: 'storefront',
    status: 'active',
    roleIds: ['public_member'],
    permissions: ['catalog.read', 'order.create', 'order.read'],
    deniedPermissions: [],
    context: { tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', userId: 'user-one' },
    scopeBindings: [{ kind: 'self', resourceId: 'user-one' }],
    authzVersion: 1,
    actor: {
      tenantId: 'tenant-one',
      enterpriseId: 'enterprise-one',
      mallId: 'mall-one',
      mallCode: 'MALL',
      userId: 'user-one',
      employeeNo: 'WX-001',
    },
  };
}
