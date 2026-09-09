import { describe, expect, it } from 'vitest';
import { encodeMemberCode, MEMBER_CODE_PROTOCOL, MEMBER_CODE_SECONDS, parseMemberCode } from './VerificationContract';

const credential = Object.freeze({
  challenge: 'verification:4b0a1800-21ae-4a5c-b1f4-56f159594004',
  token: 'A'.repeat(43),
});

describe('member code contract', () => {
  it('retains the frozen protocol and 45-second lifetime', () => {
    expect(MEMBER_CODE_PROTOCOL).toBe('smartwing-member-code:v1:');
    expect(MEMBER_CODE_SECONDS).toBe(45);
  });

  it('round-trips only a strict opaque challenge credential', () => {
    const payload = encodeMemberCode(credential);
    expect(payload).not.toContain('member:');
    expect(parseMemberCode(payload)).toEqual(credential);
    expect(parseMemberCode(`${payload}.extra`)).toBeNull();
    expect(parseMemberCode('https://example.com/member')).toBeNull();
  });

  it('rejects malformed challenge identifiers and tokens', () => {
    expect(() => encodeMemberCode({ ...credential, challenge: 'verification:member:one' })).toThrow('MEMBER_CODE_CREDENTIAL_INVALID');
    expect(() => encodeMemberCode({ ...credential, token: 'visible secret' })).toThrow('MEMBER_CODE_CREDENTIAL_INVALID');
  });
});
