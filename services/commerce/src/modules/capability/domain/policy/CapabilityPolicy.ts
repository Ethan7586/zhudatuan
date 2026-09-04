import { DomainError } from '../../../../foundation/domain/DomainError';
import type { EntitlementState } from '../model/Entitlement';

export interface CapabilityGate {
  readonly parent: Readonly<{ scope: string; state: EntitlementState; quota: number | null }> | null;
  readonly dependencies: readonly Readonly<{ capability: string; healthy: boolean }>[];
}

export class CapabilityPolicy {
  assertChange(input: Readonly<{ state: EntitlementState; quota: number | null; expiresAt: Date | null }>, gate: CapabilityGate, now: Date): void {
    if (input.quota !== null && (!Number.isSafeInteger(input.quota) || input.quota < 0)) throw new DomainError('VALIDATION_FAILED', { field: 'quota' });
    if (input.expiresAt !== null && input.expiresAt <= now) throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
    if (input.state === 'disabled') return;
    if (gate.parent !== null && gate.parent.state !== 'enabled') throw new DomainError('CAPABILITY_PARENT_REQUIRED');
    if (gate.parent?.quota !== null && gate.parent?.quota !== undefined && (input.quota === null || input.quota > gate.parent.quota)) throw new DomainError('CAPABILITY_QUOTA_EXCEEDED');
    if (gate.dependencies.some((dependency) => !dependency.healthy)) throw new DomainError('CAPABILITY_DEPENDENCY_UNHEALTHY');
  }
}
