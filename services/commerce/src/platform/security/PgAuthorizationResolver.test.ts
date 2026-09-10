import { createHash } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../database/Pool';
import { PgAuthorizationResolver } from './PgAuthorizationResolver';

const TOKEN = 'a'.repeat(48);

describe('PgAuthorizationResolver', () => {
  it('resolves the session and canonical authorization snapshot in one database statement', async () => {
    const query = vi.fn(async () => result([authorizationRow()]));
    const duration = vi.fn();
    const resolver = new PgAuthorizationResolver(pool(query), { metrics: { count: vi.fn(), duration } } as never);

    const resolution = await resolver.resolve({ 'x-client-target': 'console', cookie: `__Host-console-session=${TOKEN}`, 'x-trace-id': 'trace:one' }, 'order.orders.read', {
      resource: 'mall:one',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
    });

    expect(query).toHaveBeenCalledOnce();
    const [statement, values] = query.mock.calls[0] as unknown as [string, readonly unknown[]];
    expect(statement).toContain('identity.resolve_session($1)');
    expect(statement).toContain('lateral access.authorization_snapshot');
    expect(values).toEqual([createHash('sha256').update(TOKEN).digest('hex'), 'order.orders.read', 'mall:one', 'console', ['console', 'storefront', 'miniapp', 'store', 'supplier']]);
    expect(resolution.actor).toMatchObject({ id: 'principal:one', membership: 'membership:one', target: 'console' });
    expect(resolution.snapshot).toMatchObject({ organization: 'organization:one', target: 'console', scope: { id: 'mall:one' }, capabilityVersion: 3 });
    expect([...(resolution.snapshot?.membership.permissions.allows ?? [])]).toEqual(['order.read']);
    expect(duration).toHaveBeenCalledWith('access_authorization_snapshot_duration_ms', expect.any(Number), expect.objectContaining({ operation: 'order.orders.read', result: 'success' }));
  });

  it('returns the resolved actor without a snapshot when the operation audience does not match', async () => {
    const query = vi.fn(async () => result([authorizationRow({ membership_active: null })]));
    const resolver = new PgAuthorizationResolver(pool(query), { metrics: { count: vi.fn(), duration: vi.fn() } } as never);

    const resolution = await resolver.resolve({ authorization: `Bearer ${TOKEN}` }, 'access.center.read', { deadline: Date.now() + 10_000, signal: new AbortController().signal });

    expect(resolution.actor.target).toBe('console');
    expect(resolution.snapshot).toBeNull();
  });

  it('honors cancellation before accessing the database', async () => {
    const query = vi.fn();
    const controller = new AbortController();
    controller.abort(new Error('CALLER_ABORTED'));
    const resolver = new PgAuthorizationResolver(pool(query), { metrics: { count: vi.fn(), duration: vi.fn() } } as never);

    await expect(resolver.resolve({ authorization: `Bearer ${TOKEN}` }, 'order.orders.read', { deadline: Date.now() + 10_000, signal: controller.signal })).rejects.toThrow('CALLER_ABORTED');
    expect(query).not.toHaveBeenCalled();
  });
});

function authorizationRow(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    actor_id: 'principal:one',
    session_id: 'session:one',
    membership_id: 'membership:one',
    session_credential_version: 2,
    session_access_version: 7,
    session_target: 'console',
    assurance_level: 3,
    assurance_verified_at: new Date('2026-09-10T00:00:00.000Z'),
    membership_active: true,
    snapshot_access_version: 7,
    snapshot_credential_version: 2,
    organization_id: 'organization:one',
    snapshot_target: 'console',
    role_assignments: [{ id: 'role:one', kind: 'custom', status: 'active', version: 1, effectiveAt: '2026-09-01T00:00:00.000Z', expiresAt: null, active: true }],
    permission_allows: ['order.read'],
    permission_denies: [],
    scopes: [{ effect: 'allow', scope: { kind: 'mall', id: 'mall:one', path: [] }, effective: '2026-09-01T00:00:00.000Z', expires: null }],
    resource_scope: { kind: 'mall', id: 'mall:one', tenant: 'tenant:one', path: [] },
    operation_ids: ['order.orders.read'],
    capability_version: 3,
    ...overrides,
  };
}

function pool(query: ReturnType<typeof vi.fn>): DatabasePool {
  const value = { connect: vi.fn(), query, workload: vi.fn(), end: vi.fn() } as unknown as DatabasePool;
  vi.mocked(value.workload).mockReturnValue(value);
  return value;
}

function result<R extends QueryResultRow>(rows: readonly R[]): QueryResult<R> {
  return { rows: [...rows], rowCount: rows.length, command: '', oid: 0, fields: [] };
}
