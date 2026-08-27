import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleHealth, handleInitialPasswordChange, handleLogin, handleLogout, handleRegisteredCredentialDiscovery } from './publicRoutes';
import { hashPassword } from './registrationSecurity';
import type { WorkerEnv } from './types';
afterEach(() => vi.unstubAllGlobals());

describe('health endpoint', () => {
  it('does not report ready when encryption is unavailable', async () => {
    const env: WorkerEnv = {
      APP_ENV: 'production',
      AUTH_MODE: 'membership',
      SUPABASE_REGION: 'ap-southeast-1',
      SESSION_SIGNING_KEY: 'storefront-test-key-that-is-longer-than-32-bytes',
      ADMIN_SESSION_SIGNING_KEY: 'admin-test-key-that-is-longer-than-32-bytes',
    };
    const response = await handleHealth(new Request('https://mall.example/api/health'), env, 'health-request');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('health-request');
    await expect(response.json()).resolves.toMatchObject({
      status: 'degraded',
      checks: { authentication: 'mvp_session_ready', piiEncryption: 'required_for_orders' },
      database: { region: 'ap-southeast-1' },
    });
  });

  it('rejects methods other than GET', async () => {
    const response = await handleHealth(new Request('https://mall.example/api/health', { method: 'POST' }), {}, 'health-request');

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('rejects demo credential login in production before any database access', async () => {
    const response = await handleLogin(
      new Request('https://zhudatuan.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://zhudatuan.com' },
        body: JSON.stringify({ username: 'onewr', password: '123456' }),
      }),
      { APP_ENV: 'production', AUTH_MODE: 'production' },
      'production-login-request'
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'AUTH_PROVIDER_NOT_CONFIGURED', requestId: 'production-login-request' },
    });
  });

  it('authenticates a registered phone against the real credential hash and membership', async () => {
    const passwordHash = await hashPassword('SmartWing2026');
    const responses = [
      true,
      { memberId: 'member-new', membershipId: 'membership-new', target: 'storefront', passwordHash, entrances: [{ membershipId: 'membership-new', target: 'storefront' }] },
      {
        id: 'membership-new',
        memberId: 'member-new',
        target: 'storefront',
        status: 'active',
        roleIds: ['role-employee'],
        permissions: ['catalog.read'],
        deniedPermissions: [],
        context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-new' },
        scopeBindings: [{ kind: 'self', resourceId: 'user-new' }],
        expiresAt: null,
        authzVersion: 1,
        actor: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', mallCode: 'SMART_WING_DEMO', userId: 'user-new', employeeNo: 'REG-NEW' },
      },
      true,
      true,
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }))
    );
    const response = await handleLogin(
      new Request('https://zhudatuan.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://zhudatuan.com', 'x-real-ip': '203.0.113.8' },
        body: JSON.stringify({ username: '13800138000', password: 'SmartWing2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
        IDENTITY_LOOKUP_KEY: 'identity-key-that-is-longer-than-thirty-two-bytes',
      },
      'registered-login'
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('__Host-zhudatuan_store_session=');
    await expect(response.json()).resolves.toMatchObject({ authenticated: true, authorization: { membershipId: 'membership-new', target: 'storefront' } });
  });

  it('authenticates a registered username through the local username alias', async () => {
    const passwordHash = await hashPassword('SmartWing2026');
    const responses = [
      true,
      { memberId: 'member-username', membershipId: 'membership-username', target: 'storefront', passwordHash, entrances: [{ membershipId: 'membership-username', target: 'storefront' }] },
      {
        id: 'membership-username',
        memberId: 'member-username',
        target: 'storefront',
        status: 'active',
        roleIds: ['role-employee'],
        permissions: ['catalog.read'],
        deniedPermissions: [],
        context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-username' },
        scopeBindings: [{ kind: 'self', resourceId: 'user-username' }],
        expiresAt: null,
        authzVersion: 1,
        actor: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', mallCode: 'SMART_WING_DEMO', userId: 'user-username', employeeNo: 'REG-USERNAME' },
      },
      true,
      true,
    ];
    const fetchMock = vi.fn(async (_input: unknown, _init?: unknown) => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleLogin(
      new Request('https://zhudatuan.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://zhudatuan.com', 'x-real-ip': '203.0.113.18' },
        body: JSON.stringify({ username: 'New.Employee', password: 'SmartWing2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
      },
      'username-login'
    );

    expect(response.status).toBe(200);
    const calls = fetchMock.mock.calls as unknown as Array<[unknown, { body?: unknown }?]>;
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toMatchObject({ p_provider: 'local_username', p_subject: 'new.employee' });
    await expect(response.json()).resolves.toMatchObject({ authenticated: true, authorization: { membershipId: 'membership-username' } });
  });

  it('sets the storefront host cookie and redirects after a top-level form login', async () => {
    const passwordHash = await hashPassword('SmartWing2026');
    const responses = [
      true,
      { memberId: 'member-form', membershipId: 'membership-form', target: 'storefront', passwordHash, entrances: [{ membershipId: 'membership-form', target: 'storefront' }] },
      {
        id: 'membership-form',
        memberId: 'member-form',
        target: 'storefront',
        status: 'active',
        roleIds: ['role-employee'],
        permissions: ['catalog.read'],
        deniedPermissions: [],
        context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-form' },
        scopeBindings: [{ kind: 'self', resourceId: 'user-form' }],
        expiresAt: null,
        authzVersion: 1,
        actor: {
          tenantId: 'tenant-smart-wing',
          enterpriseId: 'enterprise-demo',
          mallId: 'mall-demo',
          mallCode: 'SMART_WING_DEMO',
          userId: 'user-form',
          employeeNo: 'REG-FORM',
        },
      },
      true,
      true,
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }))
    );

    const response = await handleLogin(
      new Request('https://zhudatuan.com/api/v1/auth/login?redirect=/', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://accounts.zhudatuan.com', 'x-real-ip': '203.0.113.28' },
        body: new URLSearchParams({ username: 'new.employee', password: 'SmartWing2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
      },
      'storefront-form-login'
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/');
    expect(response.headers.get('set-cookie')).toContain('__Host-zhudatuan_store_session=');
  });

  it('rejects cross-site login CSRF before reading credentials', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleLogin(
      new Request('https://zhudatuan.com/api/v1/auth/login?redirect=/', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
        body: new URLSearchParams({ username: 'attacker', password: 'attacker-password' }),
      }),
      { APP_ENV: 'production', AUTH_MODE: 'membership' },
      'login-csrf'
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'LOGIN_ORIGIN_NOT_ALLOWED' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing Origin when the runtime is not explicitly development or test', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleLogin(
      new Request('https://zhudatuan.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'member', password: 'member-password' }),
      }),
      { AUTH_MODE: 'membership' },
      'login-missing-origin'
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'LOGIN_ORIGIN_NOT_ALLOWED' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['cross-site', { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' }, { APP_ENV: 'production', AUTH_MODE: 'membership' }],
    ['missing-origin', {}, { AUTH_MODE: 'membership' }],
  ])('rejects %s initial-password changes before reading credentials', async (_label, headers, environment) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleInitialPasswordChange(
      new Request('https://zhudatuan.com/api/v1/auth/password/initial-change', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ username: 'member', password: 'temporary-password', newPassword: 'Permanent2026' }),
      }),
      environment,
      'initial-password-origin'
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'LOGIN_ORIGIN_NOT_ALLOWED' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects cross-site logout without clearing the host-only session', async () => {
    const response = await handleLogout(
      new Request('https://zhudatuan.com/api/v1/auth/logout', {
        method: 'POST',
        headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
      }),
      { APP_ENV: 'production', AUTH_MODE: 'membership' },
      'logout-csrf'
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'LOGIN_ORIGIN_NOT_ALLOWED' } });
  });

  it.each(['/\\\\evil.example', '//evil.example', '/.//evil.example', '/%2e//evil.example', '/\nLocation: https://evil.example', '/%250d%250aLocation:%2520https://evil.example'])(
    'does not redirect to an unsafe location: %s',
    async (redirect) => {
      const passwordHash = await hashPassword('SmartWing2026');
      const responses = [
        true,
        { memberId: 'member-safe', membershipId: 'membership-safe', target: 'storefront', passwordHash, entrances: [{ membershipId: 'membership-safe', target: 'storefront' }] },
        {
          id: 'membership-safe',
          memberId: 'member-safe',
          target: 'storefront',
          status: 'active',
          roleIds: ['role-employee'],
          permissions: ['catalog.read'],
          deniedPermissions: [],
          context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-safe' },
          scopeBindings: [{ kind: 'self', resourceId: 'user-safe' }],
          expiresAt: null,
          authzVersion: 1,
          actor: {
            tenantId: 'tenant-smart-wing',
            enterpriseId: 'enterprise-demo',
            mallId: 'mall-demo',
            mallCode: 'SMART_WING_DEMO',
            userId: 'user-safe',
            employeeNo: 'REG-SAFE',
          },
        },
        true,
        true,
      ];
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }))
      );

      const response = await handleLogin(
        new Request(`https://zhudatuan.com/api/v1/auth/login?redirect=${encodeURIComponent(redirect)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://accounts.zhudatuan.com', 'x-real-ip': '203.0.113.29' },
          body: new URLSearchParams({ username: 'new.employee', password: 'SmartWing2026' }),
        }),
        {
          APP_ENV: 'production',
          AUTH_MODE: 'membership',
          SUPABASE_URL: 'https://db.example',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role',
          SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
        },
        'unsafe-redirect'
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    }
  );

  it('fails closed when credential discovery finds more than one active entrance', async () => {
    const passwordHash = await hashPassword('SmartWing2026');
    const responses = [
      true,
      {
        memberId: 'member-multi',
        membershipId: 'membership-one',
        target: 'storefront',
        passwordHash,
        entrances: [
          { membershipId: 'membership-one', target: 'storefront' },
          { membershipId: 'membership-two', target: 'admin' },
        ],
      },
      {
        id: 'membership-one',
        memberId: 'member-multi',
        target: 'storefront',
        status: 'active',
        roleIds: ['role-employee'],
        permissions: ['catalog.read'],
        deniedPermissions: [],
        context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-multi' },
        scopeBindings: [{ kind: 'self', resourceId: 'user-multi' }],
        expiresAt: null,
        authzVersion: 1,
        actor: {
          tenantId: 'tenant-smart-wing',
          enterpriseId: 'enterprise-demo',
          mallId: 'mall-demo',
          mallCode: 'SMART_WING_DEMO',
          userId: 'user-multi',
          employeeNo: 'REG-MULTI',
        },
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }))
    );

    const response = await handleRegisteredCredentialDiscovery(
      new Request('https://accounts.zhudatuan.com/api/v1/auth/credential/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://accounts.zhudatuan.com', 'x-real-ip': '203.0.113.30' },
        body: JSON.stringify({ username: 'multi.member', password: 'SmartWing2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
      },
      'multi-membership'
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'MEMBERSHIP_SELECTION_REQUIRED' } });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('fails closed when an older credential candidate omits the entrances contract', async () => {
    const passwordHash = await hashPassword('SmartWing2026');
    const fetchMock = vi.fn(async () => {
      const response = fetchMock.mock.calls.length === 1 ? true : { memberId: 'member-legacy', membershipId: 'membership-legacy', target: 'storefront', passwordHash };
      return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleLogin(
      new Request('https://zhudatuan.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://zhudatuan.com', 'x-real-ip': '203.0.113.31' },
        body: JSON.stringify({ username: 'legacy.member', password: 'SmartWing2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
      },
      'legacy-membership-contract'
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'MEMBERSHIP_SELECTION_REQUIRED' } });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not restore the old demo password after a test account changes its password', async () => {
    const passwordHash = await hashPassword('ChangedBuyer2026');
    const responses = [
      true,
      {
        memberId: 'member-test-buyer-001',
        membershipId: 'membership-test-buyer-001',
        target: 'storefront',
        passwordHash,
      },
      null,
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleLogin(
      new Request('https://zhudatuan.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://zhudatuan.com', 'x-real-ip': '203.0.113.9' },
        body: JSON.stringify({ username: 'buyer001', password: '123456' }),
      }),
      {
        APP_ENV: 'test',
        AUTH_MODE: 'test',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
      },
      'changed-test-password'
    );

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_USERNAME_PASSWORD' } });
  });

  it('rate-limits credential discovery before verifying a registered password', async () => {
    const fetchMock = vi.fn(async () => new Response('false', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleRegisteredCredentialDiscovery(
      new Request('https://zhudatuan.com/api/v1/auth/credential/discover', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://zhudatuan.com', 'x-real-ip': '203.0.113.10' },
        body: JSON.stringify({ username: '13800138000', password: 'WrongPassword2026' }),
      }),
      {
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
        SUPABASE_URL: 'https://db.example',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role',
        SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes',
        IDENTITY_LOOKUP_KEY: 'identity-key-that-is-longer-than-thirty-two-bytes',
      },
      'credential-discovery'
    );
    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never creates a session while a registered member must reset the initial password', async () => {
    const passwordHash = await hashPassword('Temporary2026');
    const responses = [
      true,
      {
        memberId: 'member-new',
        membershipId: 'membership-new',
        target: 'storefront',
        passwordHash,
        mustResetPassword: true,
        entrances: [{ membershipId: 'membership-new', target: 'storefront' }],
      },
      {
        id: 'membership-new',
        memberId: 'member-new',
        target: 'storefront',
        status: 'active',
        roleIds: ['role-employee'],
        permissions: ['catalog.read'],
        deniedPermissions: [],
        context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-new' },
        scopeBindings: [{ kind: 'self', resourceId: 'user-new' }],
        expiresAt: null,
        authzVersion: 1,
        actor: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', mallCode: 'SMART_WING_DEMO', userId: 'user-new', employeeNo: 'REG-NEW' },
      },
      null,
    ];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleLogin(
      new Request('https://zhudatuan.com/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://zhudatuan.com', 'x-real-ip': '203.0.113.24' },
        body: JSON.stringify({ username: 'new.employee', password: 'Temporary2026' }),
      }),
      { APP_ENV: 'production', AUTH_MODE: 'membership', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role', SESSION_SIGNING_KEY: 'session-key-that-is-longer-than-thirty-two-bytes' },
      'must-reset'
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PASSWORD_RESET_REQUIRED' } });
  });
});
