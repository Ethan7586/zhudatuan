import { describe, expect, it } from 'vitest';
import { MEMBER_CODE_PROTOCOL } from '@shop/contract';
import { mapMemberCode } from './infrastructure/MemberCodeMapper';
import { memberCodeRefreshWait, memberCodeRemaining } from './model/MemberCode';

describe('member code presentation model', () => {
  it('maps the short-lived server credential without exposing member identifiers', () => {
    const code = mapMemberCode({
      id: 'verification:11111111-1111-4111-8111-111111111111',
      state: 'issued',
      issued_at: '2026-09-10T03:00:00.000Z',
      expires_at: '2026-09-10T03:00:45.000Z',
      version: 1,
      token: 'A'.repeat(43),
    });

    expect(code.credential).toBe(`${MEMBER_CODE_PROTOCOL}${code.challenge}.${'A'.repeat(43)}`);
    expect(code).not.toHaveProperty('member');
    expect(code).not.toHaveProperty('mobile');
    expect(memberCodeRemaining(code, Date.parse('2026-09-10T03:00:14.100Z'))).toBe(31);
    expect(memberCodeRefreshWait(code, Date.parse('2026-09-10T03:00:04.100Z'))).toBe(6);
  });

  it('rejects malformed or nonactive credentials before rendering', () => {
    expect(() =>
      mapMemberCode({
        id: 'member:one',
        state: 'issued',
        issued_at: '2026-09-10T03:00:00.000Z',
        expires_at: '2026-09-10T03:00:45.000Z',
        version: 1,
        token: 'A'.repeat(43),
      })
    ).toThrow('MEMBER_CODE_CREDENTIAL_INVALID');
  });
});
