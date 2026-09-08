import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationRepository } from '../application/port/AuthorizationRepository';
import { ReadAuthorizationSnapshot } from '../application/service/ReadAuthorizationSnapshot';
import { result as databaseResult, transactionManager } from '../../../test/TransactionFixture';

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
    const query = new ReadAuthorizationSnapshot(
      repository,
      transactionManager(async () => databaseResult([])),
      { metrics: { count: vi.fn(), duration } } as never
    );
    const signal = new AbortController().signal;
    const deadline = Date.now() + 1_000;
    const snapshot = await query.resolve(
      { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 7, target: 'console', assurance: { level: 2 } },
      'order.orders.read',
      { deadline, signal }
    );
    expect([...snapshot.membership.permissions.allows]).toEqual(['order.read', 'order.refund']);
    expect([...snapshot.membership.permissions.denies]).toEqual(['order.refund']);
    expect([...snapshot.capabilities]).toEqual(['order.orders.read']);
    expect(snapshot.capabilityVersion).toBe(3);
    expect(snapshot.credentialVersion).toBe(2);
    expect(snapshot.roles).toEqual([expect.objectContaining({ id: 'role:one', version: 4, active: true })]);
    expect(duration).toHaveBeenCalledWith('access_authorization_snapshot_duration_ms', expect.any(Number), expect.objectContaining({ operation: 'order.orders.read', result: 'success' }));
  });

  it('honors the caller cancellation instead of starting an independent authorization budget', async () => {
    const snapshot = vi.fn();
    const controller = new AbortController();
    controller.abort(new Error('CALLER_ABORTED'));
    const query = new ReadAuthorizationSnapshot(
      { snapshot } as unknown as AuthorizationRepository,
      transactionManager(async () => databaseResult([])),
      { metrics: { count: vi.fn(), duration: vi.fn() } } as never
    );

    await expect(
      query.resolve(
        { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 7, target: 'console', assurance: { level: 2 } },
        'order.orders.read',
        { deadline: Date.now() + 1_000, signal: controller.signal }
      )
    ).rejects.toThrow('CALLER_ABORTED');
    expect(snapshot).not.toHaveBeenCalled();
  });
});
