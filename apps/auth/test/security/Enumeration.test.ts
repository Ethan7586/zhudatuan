import { describe, expect, it } from 'vitest';
import { presentError } from '@shop/presentation';
import { challengeNotice } from '../../src/feature/challenge/model/Challenge';

describe('enumeration resistance', () => {
  it('uses the same safe challenge acknowledgement without echoing a subject', () => {
    const notice = challengeNotice({ id: 'challenge:one', purpose: 'login', expiresAt: '2026-09-06T12:10:00.000Z', retryAt: '2026-09-06T12:00:30.000Z', attemptsRemaining: 10, validSeconds: 600, resendSeconds: 30 }, true);
    expect(notice).toContain('无论账号是否存在均显示相同结果');
    expect(notice).not.toContain('13800000000');
  });

  it('does not expose credential internals or arbitrary server messages', () => {
    const view = presentError({ kind: 'api', code: 'CREDENTIAL_INVALID', retryable: false, message: 'database says employee exists' });
    expect(view.message).not.toContain('database');
    expect(view.message).not.toContain('exists');
  });
});
