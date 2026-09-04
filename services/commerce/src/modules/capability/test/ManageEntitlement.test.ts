import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { OrganizationReadPort } from '../../organization/public';
import { ManageEntitlement } from '../application/service/ManageEntitlement';
import type { Assignment, AssignmentRepository } from '../application/port/AssignmentRepository';
import { Entitlement } from '../domain/model/Entitlement';

const transaction = {} as WriteTransactionContext;
const now = new Date('2026-09-04T00:00:00.000Z');

describe('manage capability entitlement', () => {
  it('rejects an enabled child when the inherited parent grant is disabled before persistence', async () => {
    const save = vi.fn();
    const action = new ManageEntitlement(organizations(), {
      prepare: vi.fn(async () => ({
        current: null,
        setVersion: 2,
        parent: { scope: 'enterprise:one', state: 'disabled', quota: null },
        dependencies: [],
        operations: 1,
        dependentCapabilities: 0,
      })),
      save,
    } as unknown as AssignmentRepository);

    await expect(action.execute(transaction, command({ state: 'enabled' }))).rejects.toThrow('CAPABILITY_PARENT_REQUIRED');
    expect(save).not.toHaveBeenCalled();
  });

  it('persists disablement as a versioned state change without deleting the entitlement identity', async () => {
    const current = new Entitlement({
      id: 'entitlement:one',
      scope: 'mall:one',
      capability: 'voucher.lifecycle',
      state: 'enabled',
      quota: null,
      effectiveAt: now,
      expiresAt: null,
      version: 4,
    });
    const saved = assignment({ configuredState: 'disabled', state: 'disabled', version: 5, capabilityVersion: 9 });
    const save = vi.fn(async () => saved);
    const action = new ManageEntitlement(organizations(), {
      prepare: vi.fn(async () => ({
        current,
        setVersion: 8,
        parent: { scope: 'enterprise:one', state: 'enabled', quota: null },
        dependencies: [],
        operations: 12,
        dependentCapabilities: 2,
      })),
      save,
    } as unknown as AssignmentRepository);

    await expect(action.execute(transaction, command({ state: 'disabled', expectedVersion: 4 }))).resolves.toEqual(saved);
    expect(save).toHaveBeenCalledWith(transaction, expect.objectContaining({
      entitlement: expect.objectContaining({ id: 'entitlement:one', state: 'disabled', version: 5 }),
      setVersion: 9,
      impact: { operations: 12, dependentCapabilities: 2, descendantScopes: 3, navigationAffected: true },
    }), expect.objectContaining({ expectedSetVersion: 8, reason: '下线卡券能力' }));
  });
});

function organizations(): OrganizationReadPort {
  return {
    descendants: vi.fn(),
    activeMalls: vi.fn(),
    summaries: vi.fn(),
    scope: vi.fn(async () => ({
      id: 'mall:one',
      scopeKind: 'mall',
      timezone: 'Asia/Shanghai',
      tenant: 'tenant:one',
      ancestors: ['enterprise:one', 'platform:one'],
      descendants: ['store:one', 'store:two', 'store:three'],
    })),
  };
}

function command(overrides: Partial<Parameters<ManageEntitlement['execute']>[1]> = {}): Parameters<ManageEntitlement['execute']>[1] {
  return {
    id: 'entitlement:one',
    scope: 'mall:one',
    capability: 'voucher.lifecycle',
    state: 'disabled',
    quota: null,
    expiresAt: null,
    expectedVersion: 0,
    actor: 'principal:one',
    reason: '下线卡券能力',
    trace: 'trace:one',
    now,
    ...overrides,
  };
}

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: 'entitlement:one',
    scopeId: 'mall:one',
    capabilityId: 'voucher.lifecycle',
    name: 'voucher.lifecycle',
    kind: 'feature',
    state: 'enabled',
    configuredState: 'enabled',
    inheritedFrom: null,
    quota: null,
    effectiveAt: now.toISOString(),
    expiresAt: null,
    version: 4,
    capabilityVersion: 8,
    dependencyHealthy: true,
    disabledReason: null,
    dependencies: [],
    impact: { operations: 12, dependentCapabilities: 2, descendantScopes: 3, navigationAffected: true },
    ...overrides,
  };
}
