import { describe, expect, it } from 'vitest';
import { mapMemberCode } from './infrastructure/MemberCodeMapper';
import { refreshWaitSeconds, remainingSeconds } from './model/MemberCode';
import { MemberCodeManifest } from './Manifest';

describe('miniapp member code feature', () => {
  it('binds the generated member-code route to its real page', () => {
    expect(MemberCodeManifest.routes.map(({ routeid, operation }) => ({ routeid, operation }))).toEqual([
      { routeid: 'miniappmembercode', operation: 'verification.membercodes.issue' },
    ]);
  });

  it('projects the credential to QR modules without retaining plaintext', () => {
    const code = mapMemberCode({
      id: 'verification:11111111-1111-4111-8111-111111111111', state: 'issued', issued_at: '2026-09-10T03:00:00.000Z', expires_at: '2026-09-10T03:00:45.000Z', version: 1, token: 'A'.repeat(43),
    });
    expect(code.matrixSize).toBeGreaterThan(20);
    expect(code.modules).toHaveLength(code.matrixSize ** 2);
    expect(code.modules.some(({ dark }) => dark)).toBe(true);
    expect(code).not.toHaveProperty('credential');
    expect(code).not.toHaveProperty('token');
    expect(remainingSeconds(code, Date.parse('2026-09-10T03:00:15.100Z'))).toBe(30);
    expect(refreshWaitSeconds(code, Date.parse('2026-09-10T03:00:05.100Z'))).toBe(5);
  });
});
