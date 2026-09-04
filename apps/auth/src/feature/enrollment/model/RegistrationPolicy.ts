import type { OperationOutputFor } from '@shop/contract';

export interface RegistrationPolicy {
  readonly termsTitle: string;
  readonly termsBody: string;
  readonly privacyTitle: string;
  readonly privacyBody: string;
  readonly termsHash: string;
}

export function canEditDisplayName(subjectMode: OperationOutputFor<'identity.enrollments.read'>['subjectMode']): boolean {
  return subjectMode === 'input';
}
