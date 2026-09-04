import { describe, expect, it } from 'vitest';
import { defaultTermsAccepted } from './termsAcceptance';

describe('terms acceptance defaults', () => {
  it('preselects agreement for login and after a registration invitation is resolved', () => {
    expect(defaultTermsAccepted('login')).toBe(true);
    expect(defaultTermsAccepted('invitation-unresolved')).toBe(false);
    expect(defaultTermsAccepted('invitation-resolved')).toBe(true);
  });
});
