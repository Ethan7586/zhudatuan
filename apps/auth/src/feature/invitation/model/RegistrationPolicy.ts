export interface RegistrationPolicy {
  readonly termsTitle: string;
  readonly termsBody: string;
  readonly privacyTitle: string;
  readonly privacyBody: string;
  readonly termsHash: string;
}

export function canEditDisplayName(subjectMode: 'bound' | 'input'): boolean {
  return subjectMode === 'input';
}
