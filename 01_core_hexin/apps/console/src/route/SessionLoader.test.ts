import { ApiError } from '@shop/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { landingLoader, scopeLoader, scopeShouldRevalidate } from './SessionLoader';

const api = vi.hoisted(() => ({
  identitySessionRead: vi.fn(),
  memberProfileRead: vi.fn(),
  organizationLayersRead: vi.fn(),
}));

vi.mock('../shared/api/Client', () => ({
  consoleRequest: vi.fn(() => ({})),
  identitySessionRead: api.identitySessionRead,
  memberProfileRead: api.memberProfileRead,
  organizationLayersRead: api.organizationLayersRead,
}));

const platformScope = { kind: 'platform' as const, id: 'organization-platform-root', name: '主打团平台' };
const session = {
  actor: 'principal:owner',
  membership: 'membership:owner',
  scope: platformScope,
  scopes: [platformScope],
  accessVersion: 7,
  permissions: [],
  capabilities: ['reporting.dashboard.read'],
  governance: { level: 'owner', exactOwner: true, organization: 'organization-platform-root' },
  assurance: { level: 2 },
  target: 'console',
  syncedAt: '2026-09-01T20:46:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  delete window.__consoleSessionPrefetch;
  delete window.__consoleScopePrefetch;
  delete window.__consoleAbortDocumentPrefetch;
  api.identitySessionRead.mockResolvedValue(session);
  api.memberProfileRead.mockResolvedValue({ display_name: 'Ethan', employee_no: null });
});

describe('scope loader revalidation', () => {
  it('does not reload the parent session while navigating inside the same scope', () => {
    const currentUrl = new URL('https://console.zhudatuan.com/scopes/platform/organization-platform-root/settings/members');
    const nextUrl = new URL(`${currentUrl.href}?cursor=page%3A2`);

    expect(scopeShouldRevalidate({
      currentUrl, nextUrl, defaultShouldRevalidate: true,
    })).toBe(false);
    expect(scopeShouldRevalidate({
      currentUrl,
      nextUrl: new URL('https://console.zhudatuan.com/scopes/platform/organization-platform-root/settings/profile'),
      defaultShouldRevalidate: true,
    })).toBe(false);
    expect(scopeShouldRevalidate({
      currentUrl,
      nextUrl: new URL('https://console.zhudatuan.com/scopes/mall/mall%3Aother/storefront-members'),
      defaultShouldRevalidate: true,
    })).toBe(true);
    expect(scopeShouldRevalidate({
      currentUrl,
      nextUrl,
      formMethod: 'POST',
      defaultShouldRevalidate: true,
    })).toBe(true);
  });
});

describe('console scope loader profile isolation', () => {
  it('consumes a successful document session prefetch through the existing validation path', async () => {
    window.__consoleSessionPrefetch = resolvedPrefetch({ value: session });

    const context = await loadPlatformScope();

    expect(context.scope).toEqual(platformScope);
    expect(context.session.governance).toEqual(session.governance);
    expect(api.identitySessionRead).not.toHaveBeenCalled();
  });

  it('falls back to the SDK after the bounded handoff when document prefetch remains pending', async () => {
    window.__consoleSessionPrefetch = { settled: false, promise: new Promise(() => undefined) };
    window.__consoleAbortDocumentPrefetch = vi.fn();

    const context = await loadPlatformScope();

    expect(context.scope).toEqual(platformScope);
    expect(window.__consoleAbortDocumentPrefetch).toHaveBeenCalledOnce();
    expect(api.identitySessionRead).toHaveBeenCalledOnce();
  });

  it('uses a document session that finishes inside the bounded handoff', async () => {
    let resolvePrefetch: (value: Readonly<{ value: unknown }>) => void = () => undefined;
    window.__consoleSessionPrefetch = {
      settled: false,
      promise: new Promise((resolve) => { resolvePrefetch = resolve; }),
    };

    const loading = loadPlatformScope();
    queueMicrotask(() => resolvePrefetch({ value: session }));
    const context = await loading;

    expect(context.scope).toEqual(platformScope);
    expect(api.identitySessionRead).not.toHaveBeenCalled();
  });

  it('keeps the in-flight document session instead of restarting it after 180ms', async () => {
    window.__consoleSessionPrefetch = {
      settled: false,
      promise: new Promise((resolve) => window.setTimeout(() => resolve({ value: session }), 250)),
    };

    const context = await loadPlatformScope();

    expect(context.scope).toEqual(platformScope);
    expect(api.identitySessionRead).not.toHaveBeenCalled();
  });

  it('abandons the handoff immediately when route navigation aborts', async () => {
    window.__consoleSessionPrefetch = { settled: false, promise: new Promise(() => undefined) };
    window.__consoleAbortDocumentPrefetch = vi.fn();
    const controller = new AbortController();
    const loading = scopeLoader({
      params: { scopeKind: platformScope.kind, scopeId: platformScope.id },
      request: new Request(`https://console.zhudatuan.com/scopes/${platformScope.kind}/${platformScope.id}/cockpit`, {
        signal: controller.signal,
      }),
    } as never);

    controller.abort(new DOMException('navigation cancelled', 'AbortError'));

    await expect(loading).rejects.toMatchObject({ name: 'AbortError' });
    expect(window.__consoleAbortDocumentPrefetch).toHaveBeenCalledOnce();
    expect(api.identitySessionRead).not.toHaveBeenCalled();
  });

  it('falls back to the SDK when the prefetched session schema is invalid', async () => {
    window.__consoleSessionPrefetch = resolvedPrefetch({ value: { ...session, accessVersion: 'invalid' } });

    const context = await loadPlatformScope();

    expect(context.scope).toEqual(platformScope);
    expect(api.identitySessionRead).toHaveBeenCalledOnce();
  });

  it('hands the validated landing session to the exact redirected cockpit route once', async () => {
    const response = await landingLoader({
      params: {},
      request: new Request('https://console.zhudatuan.com/'),
    } as never);
    const location = response.headers.get('location');
    expect(location).toBe('/scopes/platform/organization-platform-root/cockpit');

    const context = await scopeLoader({
      params: { scopeKind: platformScope.kind, scopeId: platformScope.id },
      request: new Request(new URL(location!, 'https://console.zhudatuan.com')),
    } as never);

    expect(context.scope).toEqual(platformScope);
    expect(api.identitySessionRead).toHaveBeenCalledTimes(1);
  });

  it('lands a pending administrator without business operations in personal center', async () => {
    api.identitySessionRead.mockResolvedValue({ ...session, capabilities: [] });

    const response = await landingLoader({
      params: {},
      request: new Request('https://console.zhudatuan.com/'),
    } as never);

    expect(response.headers.get('location')).toBe('/scopes/platform/organization-platform-root/settings/profile');
  });

  it('does not hand a landing session to a different route', async () => {
    await landingLoader({
      params: {},
      request: new Request('https://console.zhudatuan.com/'),
    } as never);

    await scopeLoader({
      params: { scopeKind: platformScope.kind, scopeId: platformScope.id },
      request: new Request(`https://console.zhudatuan.com/scopes/${platformScope.kind}/${platformScope.id}/settings/access`),
    } as never);

    expect(api.identitySessionRead).toHaveBeenCalledTimes(2);
  });

  it('returns the live profile when the personal data source succeeds', async () => {
    const context = await loadPlatformScope();

    expect(context.profile).toMatchObject({ display_name: 'Ethan', employee_no: null });
    expect(context.profileState).toBe('ready');
  });

  it('uses the profile carried by the validated session without a second permission-gated request', async () => {
    api.identitySessionRead.mockResolvedValue({
      ...session,
      profile: { display_name: '张三', employee_no: null },
    });

    const context = await loadPlatformScope();

    expect(context.profile).toEqual({ display_name: '张三', employee_no: null });
    expect(context.profileState).toBe('ready');
    expect(api.memberProfileRead).not.toHaveBeenCalled();
  });

  it('uses an exact access-version and scope context prefetch without loading the SDK profile', async () => {
    window.__consoleScopePrefetch = resolvedPrefetch({
      accessVersion: 7,
      roots: [{ kind: platformScope.kind, id: platformScope.id }],
      profile: { display_name: 'Prefetched Ethan', employee_no: null },
      layers: [],
    });

    const context = await loadPlatformScope();

    expect(context.profile.display_name).toBe('Prefetched Ethan');
    expect(api.memberProfileRead).not.toHaveBeenCalled();
  });

  it('keeps the authorized workspace available when the non-critical profile read is forbidden', async () => {
    api.memberProfileRead.mockRejectedValue(new ApiError('SCOPE_DENIED', 403, 'request:profile'));

    const context = await loadPlatformScope();

    expect(context.scope).toEqual(platformScope);
    expect(context.profile).toEqual({ display_name: '当前用户', employee_no: null });
    expect(context.profileState).toBe('unavailable');
  });

  it('does not hide an expired session behind the profile fallback', async () => {
    api.memberProfileRead.mockRejectedValue(new ApiError('AUTHENTICATION_REQUIRED', 401, 'request:profile'));

    await expect(loadPlatformScope()).rejects.toMatchObject({ status: 401, code: 'AUTHENTICATION_REQUIRED' });
  });
});

function loadPlatformScope() {
  return scopeLoader({
    params: { scopeKind: platformScope.kind, scopeId: platformScope.id },
    request: new Request(`https://console.zhudatuan.com/scopes/${platformScope.kind}/${encodeURIComponent(platformScope.id)}/cockpit`),
  } as never);
}

function resolvedPrefetch<T>(value: T) {
  return { settled: true, promise: Promise.resolve(value) };
}
