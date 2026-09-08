import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { databaseInteger } from '../../../../platform/database/DatabaseInteger';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { Assignment, AssignmentPlan, AssignmentRepository, CapabilityDependency, CapabilityDisabledReason, CapabilityKind } from '../../application/port/AssignmentRepository';
import { Entitlement } from '../../domain/model/Entitlement';

export interface AssignmentRow {
  readonly id: string;
  readonly scope_id: string;
  readonly capability_id: string;
  readonly name: string;
  readonly kind: CapabilityKind;
  readonly state: 'enabled' | 'disabled';
  readonly configured_state: 'enabled' | 'disabled' | null;
  readonly inherited_from: string | null;
  readonly quota: number | string | null;
  readonly effective_at: Date | string | null;
  readonly expires_at: Date | string | null;
  readonly version: number | string;
  readonly capability_version: number | string;
  readonly dependency_healthy: boolean;
  readonly disabled_reason: CapabilityDisabledReason | null;
  readonly dependencies: CapabilityDependency[];
  readonly operations: number | string;
  readonly dependent_capabilities: number | string;
}

export interface EntitlementRow {
  readonly id: string;
  readonly scope_id: string;
  readonly capability_id: string;
  readonly state: 'enabled' | 'disabled';
  readonly quota: number | string | null;
  readonly effective_at: Date | string;
  readonly expires_at: Date | string | null;
  readonly version: number | string;
}

export function assignment(row: AssignmentRow, descendants: number): Assignment {
  return Object.freeze({
    id: row.id,
    scopeId: row.scope_id,
    capabilityId: row.capability_id,
    name: row.name,
    kind: row.kind,
    state: row.state,
    configuredState: row.configured_state,
    inheritedFrom: row.inherited_from,
    quota: nullableInteger(row.quota),
    effectiveAt: nullableUtc(row.effective_at),
    expiresAt: nullableUtc(row.expires_at),
    version: databaseInteger(row.version),
    capabilityVersion: databaseInteger(row.capability_version),
    dependencyHealthy: row.dependency_healthy,
    disabledReason: row.disabled_reason,
    dependencies: Object.freeze(row.dependencies.map((item) => Object.freeze(item))),
    impact: Object.freeze({
      operations: databaseInteger(row.operations),
      dependentCapabilities: databaseInteger(row.dependent_capabilities),
      descendantScopes: descendants,
      navigationAffected: true,
    }),
  });
}

export function entitlement(row: EntitlementRow): Entitlement {
  return new Entitlement({
    id: row.id,
    scope: row.scope_id,
    capability: row.capability_id,
    state: row.state,
    quota: nullableInteger(row.quota),
    effectiveAt: date(row.effective_at),
    expiresAt: row.expires_at === null ? null : date(row.expires_at),
    version: databaseInteger(row.version),
  });
}

export function dependency(row: Readonly<{ capability_id: string; name: string; healthy: boolean; reason: CapabilityDisabledReason | null }>): CapabilityDependency {
  return Object.freeze({ capabilityId: row.capability_id, name: row.name, healthy: row.healthy, reason: row.reason });
}

export function nullableInteger(value: number | string | null): number | null {
  return value === null ? null : databaseInteger(value);
}

export function nullableUtc(value: Date | string | null): string | null {
  return value === null ? null : date(value).toISOString();
}

export function date(value: Date | string): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('CAPABILITY_TIME_INVALID');
  return parsed;
}
