import { DomainError } from '../../../../platform/error/DomainError';

export interface ApprovalAssignment {
  readonly kind: 'permission' | 'role' | 'membership';
  readonly value: string;
}

export interface ApproverContext {
  readonly membership: string;
  readonly requester: string;
  readonly principal: string;
  readonly requesterPrincipal: string;
  readonly permissions: ReadonlySet<string>;
  readonly roles: ReadonlySet<string>;
}

export class ApproverPolicy {
  assertAssigned(assignment: ApprovalAssignment, context: ApproverContext): void {
    if (!context.principal || !context.requesterPrincipal) throw new DomainError('AUTHORIZATION_DENIED');
    if (context.membership === context.requester || context.principal === context.requesterPrincipal) throw new DomainError('APPROVAL_SELF_DECISION_FORBIDDEN');
    const assigned =
      (assignment.kind === 'membership' && assignment.value === context.membership) || (assignment.kind === 'permission' && context.permissions.has(assignment.value)) || (assignment.kind === 'role' && context.roles.has(assignment.value));
    if (!assigned) throw new DomainError('APPROVAL_NOT_ASSIGNED');
  }
}
