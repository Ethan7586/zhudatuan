import { describe, expect, it } from 'vitest';
import { CapabilitySet } from '../domain/model/CapabilitySet';
import { Entitlement } from '../domain/model/Entitlement';
import { CapabilityPolicy } from '../domain/policy/CapabilityPolicy';
import { CapabilityModule } from '../Module';
import { PublishableCapabilities } from '../Manifest';

const now = new Date('2026-09-04T00:00:00.000Z');

describe('capability inheritance', () => {
  it('publishes Approval, Voucher, Import and all six surface capabilities from the canonical catalog', () => {
    expect(PublishableCapabilities).toEqual(['surface.auth', 'surface.console', 'surface.storefront', 'surface.miniapp', 'surface.store', 'surface.supplier', 'approval.workflow', 'voucher.lifecycle', 'runtime.importing']);
    expect(CapabilityModule.capabilities).toEqual(PublishableCapabilities);
  });

  it('rejects enabling a child capability when its parent is not enabled', () => {
    const policy = new CapabilityPolicy();
    expect(() => policy.assertChange({ state: 'enabled', quota: 10, expiresAt: null }, { parent: { scope: 'enterprise:one', state: 'disabled', quota: 100 }, dependencies: [] }, now)).toThrow('CAPABILITY_PARENT_REQUIRED');
  });

  it('rejects unlimited or excessive child quota under a finite parent quota', () => {
    const policy = new CapabilityPolicy();
    const gate = { parent: { scope: 'enterprise:one', state: 'enabled' as const, quota: 10 }, dependencies: [] };
    expect(() => policy.assertChange({ state: 'enabled', quota: null, expiresAt: null }, gate, now)).toThrow('CAPABILITY_QUOTA_EXCEEDED');
    expect(() => policy.assertChange({ state: 'enabled', quota: 11, expiresAt: null }, gate, now)).toThrow('CAPABILITY_QUOTA_EXCEEDED');
    expect(() => policy.assertChange({ state: 'enabled', quota: 10, expiresAt: null }, gate, now)).not.toThrow();
  });

  it('keeps the entitlement identity and history version when disabling instead of deleting it', () => {
    const current = new Entitlement({ id: 'entitlement:one', scope: 'mall:one', capability: 'voucher.feature', state: 'enabled', quota: 20, effectiveAt: now, expiresAt: null, version: 3 });
    const changed = new CapabilitySet('mall:one', 7, 'enterprise:one', 4).change(current, { id: current.id, capability: current.capability, state: 'disabled', quota: 20, expiresAt: null }, new Date('2026-09-04T01:00:00.000Z'), {
      operations: 12,
      dependentCapabilities: 2,
    });
    expect(changed.entitlement).toMatchObject({ id: current.id, state: 'disabled', version: 4 });
    expect(changed.setVersion).toBe(8);
    expect(changed.impact).toEqual({ operations: 12, dependentCapabilities: 2, descendantScopes: 4, navigationAffected: true });
  });

  it('rejects enabling when any declared dependency is unhealthy', () => {
    expect(() => new CapabilityPolicy().assertChange({ state: 'enabled', quota: null, expiresAt: null }, { parent: null, dependencies: [{ capability: 'surface.console', healthy: false }] }, now)).toThrow('CAPABILITY_DEPENDENCY_UNHEALTHY');
  });
});
