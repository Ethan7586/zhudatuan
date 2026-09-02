import { describe, expect, it } from 'vitest';
import { InvitationCode } from './InvitationCode';

describe('InvitationCode', () => {
  it('never serializes or stringifies plaintext while preserving one-time display', () => {
    const code = InvitationCode.issue(Uint8Array.from({ length: 24 }, (_, index) => index + 1));
    const display = code.display();
    expect(display).toMatch(/^(?:[A-Za-z0-9_-]{4} ){7}[A-Za-z0-9_-]{4}$/);
    expect(String(code)).toBe('[REDACTED]');
    expect(JSON.stringify(code)).toBe('"[REDACTED]"');
    expect(JSON.stringify(code)).not.toContain(display.replaceAll(' ', ''));
  });

  it('normalizes display whitespace and rejects invalid Base64URL input', () => {
    const issued = InvitationCode.issue(Uint8Array.from({ length: 24 }, (_, index) => 255 - index));
    expect(InvitationCode.parse(issued.display()).display()).toBe(issued.display());
    expect(() => InvitationCode.parse(`${issued.display()}!`)).toThrow('INVITATION_INVALID');
    expect(() => InvitationCode.issue(Buffer.alloc(23))).toThrow('INVITATION_ENTROPY_INVALID');
  });
});
