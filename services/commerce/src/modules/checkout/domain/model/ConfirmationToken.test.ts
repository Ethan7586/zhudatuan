import { describe, expect, it } from 'vitest';
import { confirmationDigest, confirmationMatches, issueConfirmationToken } from './ConfirmationToken';

describe('confirmation token', () => {
  it('issues an opaque 256-bit bearer and persists only its digest', () => {
    const token = issueConfirmationToken();
    const digest = confirmationDigest(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(token);
    expect(confirmationMatches(token, digest)).toBe(true);
  });

  it('rejects malformed and different tokens', () => {
    const digest = confirmationDigest(issueConfirmationToken());
    expect(confirmationMatches(issueConfirmationToken(), digest)).toBe(false);
    expect(() => confirmationDigest('short')).toThrow('VALIDATION_FAILED');
  });
});
