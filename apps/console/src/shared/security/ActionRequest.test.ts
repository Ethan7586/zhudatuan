import { describe, expect, it } from 'vitest';
import { createActionRequest, readActionRequest } from './ActionRequest';

describe('action request exchange', () => {
  it('binds the exact operation, resource, body, version, and maker without exposing the body', async () => {
    const encoded = await createActionRequest(
      'referral.settings.manage',
      {
        path: { settingid: 'referralsetting:one' },
        body: { enabled: true, expectedVersion: 7, reason: '年度政策' },
      },
      7,
      'membership:maker'
    );
    const request = readActionRequest(encoded);
    expect(request).toMatchObject({
      version: 1,
      operation: 'referral.settings.manage',
      resource: 'referralsetting:one',
      expectedVersion: 7,
      makerMembership: 'membership:maker',
      requestHash: 'f553c0462144f1d1721545ed98a9ea1a032db9daf484fd2adf4a4b1f639406d0',
    });
    expect(encoded).not.toContain('年度政策');
  });

  it('rejects operations that do not require maker-checker approval', async () => {
    await expect(createActionRequest('referral.withdrawals.create', { path: {}, body: {} }, 1, 'membership:maker')).rejects.toThrow('ACTION_REQUEST_OPERATION_INVALID');
  });

  it('binds pathless governance commands to the active scope resource', async () => {
    const encoded = await createActionRequest('access.overrides.manage', { body: { action: 'set', targetMembership: 'membership:target', permission: 'order.read', effect: 'allow', reason: '岗位授权' } }, 9, 'membership:maker', 'mall:one');
    expect(readActionRequest(encoded)).toMatchObject({ operation: 'access.overrides.manage', resource: 'mall:one', expectedVersion: 9, makerMembership: 'membership:maker' });
  });
});
