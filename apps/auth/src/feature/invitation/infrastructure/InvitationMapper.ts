import type { OperationOutputFor } from '@shop/contract';
import { TransportError } from '@shop/sdk';
import type { EnrollmentState } from '../model/Enrollment';
import type { InvitationOutcome } from '../model/Invitation';

export function mapEnrollment(result: OperationOutputFor<'identity.enrollments.read'>): EnrollmentState {
  return Object.freeze({
    id: result.id,
    kind: result.kind,
    target: result.target,
    expiresAt: result.expiresAt,
    subjectMode: result.subjectMode,
    organization: Object.freeze(result.organization),
    ...(result.recipientMasked === undefined ? {} : { recipientMasked: result.recipientMasked }),
    ...(result.employee === undefined ? {} : { employee: Object.freeze({ displayName: result.employee.displayName, ...(result.employee.employeeNo === undefined ? {} : { employeeNo: result.employee.employeeNo }), ...(result.employee.departmentName === undefined ? {} : { departmentName: result.employee.departmentName }) }) }),
    policy: Object.freeze({
      termsTitle: result.policy.terms_title,
      termsBody: result.policy.terms_body,
      privacyTitle: result.policy.privacy_title,
      privacyBody: result.policy.privacy_body,
      termsHash: result.policy.terms_hash,
    }),
  });
}

export function mapInvitation(result: Exclude<OperationOutputFor<'identity.invitations.resolve'>, { kind: 'session' }>): InvitationOutcome {
  if (result.kind === 'enrollment') return Object.freeze({ kind: 'enrollment', id: result.enrollment.id, expiresAt: result.enrollment.expiresAt });
  if (result.kind === 'proofRequired' && result.proof.reference) return Object.freeze({ kind: 'proof', reference: result.proof.reference, expiresAt: result.proof.expiresAt, method: result.proof.method, target: result.proof.target });
  throw new TransportError('CONTRACT_INVALID', undefined, false);
}
