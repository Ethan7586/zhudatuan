export type TermsAcceptanceContext = 'login' | 'invitation-unresolved' | 'invitation-resolved';

export function defaultTermsAccepted(context: TermsAcceptanceContext): boolean {
  return context !== 'invitation-unresolved';
}
