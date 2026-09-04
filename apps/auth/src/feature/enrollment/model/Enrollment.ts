import type { AuthTarget } from '@shop/config/client';
import type { OperationOutputFor } from '@shop/contract';
import type { RegistrationPolicy } from './RegistrationPolicy';

type EnrollmentDto = OperationOutputFor<'identity.enrollments.read'>;
export type EnrollmentTarget = EnrollmentDto['target'] & AuthTarget;

export interface EnrollmentState {
  readonly id: string;
  readonly kind: EnrollmentDto['kind'];
  readonly target: EnrollmentTarget;
  readonly expiresAt: string;
  readonly subjectMode: EnrollmentDto['subjectMode'];
  readonly organization: Readonly<{ id: string; name: string }>;
  readonly recipientMasked?: string;
  readonly employee?: Readonly<{ displayName: string; employeeNo?: string; departmentName?: string }>;
  readonly policy: RegistrationPolicy;
}

export interface EnrollmentCompletion {
  readonly id: string;
  readonly subjectMode: EnrollmentState['subjectMode'];
  readonly subject?: string;
  readonly challenge: string;
  readonly code: string;
  readonly termsHash: string;
  readonly password: string;
  readonly displayName?: string;
}
