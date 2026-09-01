import { describe, expect, it } from 'vitest';
import { executionRequestHash } from './OperationHash';

describe('executionRequestHash', () => {
  it('matches the browser action-request fingerprint for the same command', () => {
    expect(
      executionRequestHash(
        'referral.settings.manage',
        { path: { settingid: 'referralsetting:one' }, body: { enabled: true, expectedVersion: 7, reason: '年度政策' } },
        7
      )
    ).toBe('5baba7585b00ab669bd73ff2c4a2f22ff5284ab8a3a8ed28e78f144c8607fa84');
  });
});
