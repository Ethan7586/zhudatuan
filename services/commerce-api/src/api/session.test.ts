import { describe, expect, it } from 'vitest';
import { createSessionCookie, createTrackedMiniappSessionToken, readSession, targetForRequest } from './session';
import type { WorkerEnv } from './types';

const env: WorkerEnv = {
  SESSION_SIGNING_KEY: 'test-session-signing-key-that-is-longer-than-32-bytes',
  ADMIN_SESSION_SIGNING_KEY: 'test-admin-signing-key-that-is-longer-than-32-bytes',
  MINIAPP_SESSION_SIGNING_KEY: 'test-miniapp-signing-key-that-is-longer-than-32-bytes',
  SUPABASE_URL: 'https://database.example.test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};
const membership = { memberId: 'member-test', membershipId: 'membership-test', authzVersion: 3 };

describe('MVP session', () => {
  it('creates and verifies an HttpOnly signed session', async () => {
    const setCookie = await createSessionCookie(env, 'SW0001', 'SMART_WING_DEMO', membership);
    expect(setCookie).toContain('__Host-hbbtzn_store_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).not.toContain('Domain=');
    const request = new Request('https://hbbtzn.com/api/v1/auth/session', {
      headers: { cookie: setCookie.split(';')[0] },
    });
    await expect(readSession(request, env)).resolves.toMatchObject({
      employeeNo: 'SW0001',
      mallCode: 'SMART_WING_DEMO',
      target: 'storefront',
      ...membership,
    });
  });

  it('does not accept a storefront session on the admin host', async () => {
    const setCookie = await createSessionCookie(env, 'SW0001', 'SMART_WING_DEMO', membership);
    const request = new Request('https://smart.hbbtzn.com/api/v1/auth/session', {
      headers: { cookie: setCookie.split(';')[0] },
    });
    await expect(readSession(request, env)).resolves.toBeNull();
  });

  it('uses the separate host-only cookie for the admin host', async () => {
    const setCookie = await createSessionCookie(env, 'SW0001', 'SMART_WING_DEMO', { ...membership, target: 'admin' });
    expect(setCookie).toContain('__Host-hbbtzn_admin_session=');
    const request = new Request('https://smart.hbbtzn.com/api/v1/auth/session', {
      headers: { cookie: setCookie.split(';')[0] },
    });
    expect(targetForRequest(request)).toBe('admin');
    await expect(readSession(request, env)).resolves.toMatchObject({ target: 'admin' });
  });

  it('does not fall back to the storefront signing secret for an admin session', async () => {
    await expect(createSessionCookie({ SESSION_SIGNING_KEY: env.SESSION_SIGNING_KEY }, 'SW0001', 'SMART_WING_DEMO', { ...membership, target: 'admin' })).rejects.toThrow('SESSION_SIGNING_KEY_NOT_CONFIGURED');
  });

  it('rejects a tampered session', async () => {
    const setCookie = await createSessionCookie(env, 'SW0001', 'SMART_WING_DEMO', membership);
    const cookie = setCookie.split(';')[0];
    const request = new Request('https://hbbtzn.com/api/v1/auth/session', {
      headers: { cookie: `${cookie}x` },
    });
    await expect(readSession(request, env)).resolves.toBeNull();
  });

  it('rejects a legacy session that lacks Membership identity fields', async () => {
    const legacy = await createSessionCookie(env, 'SW0001', 'SMART_WING_DEMO', membership);
    const [name, value] = legacy.split(';')[0].split('=');
    const payload = JSON.parse(atob(value.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    delete payload.memberId;
    const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const request = new Request('https://hbbtzn.com/api/v1/auth/session', { headers: { cookie: `${name}=${encoded}.${value.split('.')[1]}` } });
    await expect(readSession(request, env)).resolves.toBeNull();
  });

  it('creates a separately signed revocable mini-program bearer session', async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('true', { headers: { 'content-type': 'application/json' } });
    try {
      const session = await createTrackedMiniappSessionToken(new Request('https://hbbtzn.com/api/v1/auth/wechat/session'), env, 'SW0001', 'SMART_WING_DEMO', membership);
      expect(session.accessToken).toMatch(/^swm1\./);
      const request = new Request('https://hbbtzn.com/api/v1/orders', { headers: { authorization: `Bearer ${session.accessToken}` } });
      await expect(readSession(request, env)).resolves.toMatchObject({ ...membership, channel: 'miniapp', target: 'storefront' });
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it('does not accept mini-program bearer sessions on the admin host', async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('true', { headers: { 'content-type': 'application/json' } });
    try {
      const session = await createTrackedMiniappSessionToken(new Request('https://hbbtzn.com/api/v1/auth/wechat/session'), env, 'SW0001', 'SMART_WING_DEMO', membership);
      const request = new Request('https://smart.hbbtzn.com/api/v1/orders', { headers: { authorization: `Bearer ${session.accessToken}` } });
      await expect(readSession(request, env)).resolves.toBeNull();
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
