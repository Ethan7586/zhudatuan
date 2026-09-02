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
