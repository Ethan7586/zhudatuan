import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { AuthorizationRepository } from '../port/AuthorizationRepository';
import { ReadAuthorizationSnapshot } from './ReadAuthorizationSnapshot';

describe('ReadAuthorizationSnapshot', () => {
  it('preserves independent allow and deny sets from the canonical repository snapshot', async () => {
    const repository = {
      snapshot: async () =>
        Object.freeze({
          membership: 'membership:one',
          active: true,
          accessVersion: 7,
          allows: Object.freeze(['order.read', 'order.refund']),
          denies: Object.freeze(['order.refund']),
          scopes: Object.freeze([]),
          resource: Object.freeze({ id: 'mall:one', kind: 'mall' as const, path: Object.freeze([]) }),
          operations: Object.freeze(['order.orders.read']),
          capabilityVersion: 3,
          credentialVersion: 2,
          organization: 'organization:one',
          target: 'console' as const,
          roles: Object.freeze([{ id: 'role:one', kind: 'custom' as const, status: 'active' as const, version: 4, effectiveAt: '2026-08-01T00:00:00.000Z', expiresAt: null, active: true }]),
        }),
    } as unknown as AuthorizationRepository;
    const duration = vi.fn();
    const query = new ReadAuthorizationSnapshot(repository, {} as DatabasePool, { metrics: { count: vi.fn(), duration } } as never);
    const result = await query.resolve({ id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 7, target: 'console', assurance: { level: 2 } }, 'order.orders.read');
    expect([...result.membership.permissions.allows]).toEqual(['order.read', 'order.refund']);
    expect([...result.membership.permissions.denies]).toEqual(['order.refund']);
    expect([...result.capabilities]).toEqual(['order.orders.read']);
    expect(result.capabilityVersion).toBe(3);
    expect(result.credentialVersion).toBe(2);
    expect(result.roles).toEqual([expect.objectContaining({ id: 'role:one', version: 4, active: true })]);
    expect(duration).toHaveBeenCalledWith('access_authorization_snapshot_duration_ms', expect.any(Number), expect.objectContaining({ operation: 'order.orders.read', result: 'success' }));
  });
});
