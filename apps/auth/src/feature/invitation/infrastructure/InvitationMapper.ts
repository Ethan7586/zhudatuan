import type { OperationOutputFor } from '@shop/contract';
import type { EnrollmentState } from '../model/Enrollment';

export function mapEnrollment(result: OperationOutputFor<'identity.enrollments.read'>): EnrollmentState {
  return Object.freeze({
    id: result.id,
    kind: result.kind,
    target: result.target,
    expiresAt: result.expiresAt,
    subjectMode: result.subjectMode,
    organization: Object.freeze(result.organization),
    ...(result.recipientMasked === undefined ? {} : { recipientMasked: result.recipientMasked }),
    ...(result.employee === undefined ? {} : { employee: Object.freeze(result.employee) }),
    policy: Object.freeze({
      termsTitle: result.policy.terms_title,
      termsBody: result.policy.terms_body,
      privacyTitle: result.policy.privacy_title,
      privacyBody: result.policy.privacy_body,
      termsHash: result.policy.terms_hash,
    }),
  });
}
