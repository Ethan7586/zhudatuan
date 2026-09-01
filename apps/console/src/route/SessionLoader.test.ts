import { ApiError } from '@shop/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scopeLoader } from './SessionLoader';

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
  capabilities: [],
  assurance: { level: 2 },
  target: 'console',
  syncedAt: '2026-09-01T20:46:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.identitySessionRead.mockResolvedValue(session);
  api.memberProfileRead.mockResolvedValue({ display_name: 'Ethan', employee_no: null });
});

describe('console scope loader profile isolation', () => {
  it('returns the live profile when the personal data source succeeds', async () => {
    const context = await loadPlatformScope();

    expect(context.profile).toMatchObject({ display_name: 'Ethan', employee_no: null });
    expect(context.profileState).toBe('ready');
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
