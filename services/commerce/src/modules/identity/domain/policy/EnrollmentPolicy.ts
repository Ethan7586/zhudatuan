import { DomainError } from '../../../../platform/error/DomainError';
export class EnrollmentPolicy {
  complete(input: Readonly<{ termsAccepted: boolean; termsHash: string; expectedTermsHash: string }>): void {
    if (!input.termsAccepted || input.termsHash !== input.expectedTermsHash) throw new DomainError('TERMS_ACCEPTANCE_REQUIRED');
  }
}
