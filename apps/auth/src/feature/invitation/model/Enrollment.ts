import type { RegistrationPolicy } from './RegistrationPolicy';

export interface EnrollmentState {
  readonly id: string;
  readonly kind: 'enrollment' | 'campaign';
  readonly target: 'storefront';
  readonly expiresAt: string;
  readonly subjectMode: 'bound' | 'input';
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
