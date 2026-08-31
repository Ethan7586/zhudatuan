import { describe, expect, it } from 'vitest';
import { InvitationCode } from './InvitationCode';

describe('InvitationCode', () => {
  it('never serializes or stringifies plaintext while preserving one-time display', () => {
    const code = InvitationCode.issue(Uint8Array.from({ length: 20 }, (_, index) => index + 1));
    const display = code.display();
    expect(display).toMatch(/^(?:[0-9A-HJKMNP-TV-Z]{4}-){8}[0-9A-HJKMNP-TV-Z]$/);
    expect(String(code)).toBe('[REDACTED]');
    expect(JSON.stringify(code)).toBe('"[REDACTED]"');
    expect(JSON.stringify(code)).not.toContain(display.replaceAll('-', ''));
  });

  it('normalizes display formatting and rejects a checksum mutation', () => {
    const issued = InvitationCode.issue(Uint8Array.from({ length: 20 }, (_, index) => 255 - index));
    expect(InvitationCode.parse(issued.display().toLowerCase()).display()).toBe(issued.display());
    const changed = `${issued.display().slice(0, -1)}${issued.display().endsWith('0') ? '1' : '0'}`;
    expect(() => InvitationCode.parse(changed)).toThrow('INVITATION_INVALID');
  });
});
