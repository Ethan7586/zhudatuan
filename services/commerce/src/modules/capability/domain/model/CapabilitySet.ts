import { Entitlement, type EntitlementState } from './Entitlement';

export interface CapabilityImpact {
  readonly operations: number;
  readonly dependentCapabilities: number;
  readonly descendantScopes: number;
  readonly navigationAffected: boolean;
}

export interface CapabilityChange {
  readonly entitlement: Entitlement;
  readonly setVersion: number;
  readonly changed: boolean;
  readonly impact: CapabilityImpact;
}

export class CapabilitySet {
  constructor(
    readonly scope: string,
    readonly version: number,
    readonly parent: string | null,
    readonly descendants: number
  ) {
    if (!scope || !Number.isSafeInteger(version) || version < 0 || !Number.isSafeInteger(descendants) || descendants < 0) throw new Error('CAPABILITY_SET_INVALID');
  }

  change(
    current: Entitlement | null,
    input: Readonly<{ id: string; capability: string; state: EntitlementState; quota: number | null; expiresAt: Date | null }>,
    at: Date,
    impact: Omit<CapabilityImpact, 'descendantScopes' | 'navigationAffected'>
  ): CapabilityChange {
    const unchanged = current?.sameConfiguration(input.state, input.quota, input.expiresAt) ?? false;
    const entitlement = current === null ? Entitlement.create({ ...input, scope: this.scope, at }) : unchanged ? current : current.reconfigure(input.state, input.quota, input.expiresAt, at);
    return Object.freeze({
      entitlement,
      setVersion: this.version + (unchanged ? 0 : 1),
      changed: !unchanged,
      impact: Object.freeze({ ...impact, descendantScopes: this.descendants, navigationAffected: !unchanged }),
    });
  }
}
