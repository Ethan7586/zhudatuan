import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CapabilityChange, CapabilityImpact } from '../../domain/model/CapabilitySet';
import type { Entitlement, EntitlementState } from '../../domain/model/Entitlement';

export type CapabilityKind = 'operation' | 'feature' | 'uiblock' | 'quota' | 'entitlement';
export type CapabilityDisabledReason = 'explicitdisabled' | 'parentnotgranted' | 'dependencyunhealthy' | 'notgranted' | 'expired' | 'retired';

export interface CapabilityDependency {
  readonly capabilityId: string;
  readonly name: string;
  readonly healthy: boolean;
  readonly reason: CapabilityDisabledReason | null;
}

export interface Assignment {
  readonly id: string;
  readonly scopeId: string;
  readonly capabilityId: string;
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly state: EntitlementState;
  readonly configuredState: EntitlementState | null;
  readonly inheritedFrom: string | null;
  readonly quota: number | null;
  readonly effectiveAt: string | null;
  readonly expiresAt: string | null;
  readonly version: number;
  readonly capabilityVersion: number;
  readonly dependencyHealthy: boolean;
  readonly disabledReason: CapabilityDisabledReason | null;
  readonly dependencies: readonly CapabilityDependency[];
  readonly impact: CapabilityImpact;
}

export interface AssignmentPlan {
  readonly current: Entitlement | null;
  readonly setVersion: number;
  readonly parent: Readonly<{ scope: string; state: EntitlementState; quota: number | null }> | null;
  readonly dependencies: readonly CapabilityDependency[];
  readonly operations: number;
  readonly dependentCapabilities: number;
}

export interface AssignmentRepository {
  list(context: ReadTransactionContext, input: Readonly<{ scope: string; sort: string | null; id: string | null; fetch: number; descendants: number }>): Promise<readonly Assignment[]>;
  prepare(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; parent: string | null; capability: string }>): Promise<AssignmentPlan | null>;
  project(context: ReadTransactionContext, input: Readonly<{ scope: string; capability: string; descendants: number }>): Promise<Assignment | null>;
  save(context: WriteTransactionContext, change: CapabilityChange, input: Readonly<{ expectedSetVersion: number; actor: string; reason: string; trace: string; descendants: number }>): Promise<Assignment | null>;
}
