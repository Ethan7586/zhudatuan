import { DomainError } from '../../../../platform/error/DomainError';
import type { Organization } from '../model/Organization';

export class HierarchyPolicy {
  assertMallParent(input: Readonly<{ parent: Organization; accessScope: string; visible: boolean; activeMalls: number; expectedVersion: number }>): void {
    if (!input.visible || !['platform', 'distributor', 'tenant', 'enterprise'].includes(input.parent.kind)) throw new DomainError('SCOPE_DENIED');
    if (input.parent.status !== 'active') throw new DomainError('VALIDATION_FAILED', { field: 'parentId' });
    if (input.parent.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    if (!Number.isSafeInteger(input.activeMalls) || input.activeMalls < 0) throw new Error('ORGANIZATION_CHILD_COUNT_INVALID');
    if (input.activeMalls >= input.parent.malllimit) throw new DomainError('CAPABILITY_QUOTA_EXCEEDED');
  }

  assertAcyclic(id: string, parent: string | null, descendants: readonly string[]): void {
    if (parent === id || (parent !== null && descendants.includes(parent))) throw new DomainError('VALIDATION_FAILED', { field: 'parentId' });
  }

  assertOwner(candidate: string, actor: string, withinParent: boolean): void {
    if (candidate !== actor && !withinParent) throw new DomainError('SCOPE_DENIED');
  }
}
