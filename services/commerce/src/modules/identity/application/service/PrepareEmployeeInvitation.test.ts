import { describe, expect, it, vi } from 'vitest';
import { InvitationCode } from '../../domain/model/InvitationCode';
import { PrepareEmployeeInvitation } from './PrepareEmployeeInvitation';

describe('PrepareEmployeeInvitation', () => {
  it('normalizes employee identity and keeps the raw code in clear-once memory only', async () => {
    const kms = { encrypt: vi.fn(async () => ({ ciphertext: 'ciphertext-mobile', fingerprint: 'f'.repeat(64), keyVersion: 'v1' })) };
    const generator = { issue: () => InvitationCode.issue(Buffer.alloc(24, 9)) };
    const hasher = { recipient: vi.fn(() => Buffer.alloc(32, 1)), current: vi.fn(() => ({ version: 'v1', hash: Buffer.alloc(32, 2) })) };
    const service = new PrepareEmployeeInvitation(kms as never, generator, hasher as never);
    const value = await service.prepare({
      kind: 'enrollment',
      target: 'storefront',
      organizationId: 'mall:one',
      employee: { displayName: ' 张 三 ', mobile: '139 0000 1301', employeeNo: 'emp-01' },
      expiresAt: '2026-09-05T00:00:00.000Z',
      reason: ' 邀请员工注册 ',
    } as never);
    expect(value).toMatchObject({ target: 'storefront', organization: 'mall:one', displayName: '张 三', employeeNo: 'EMP-01', mobileMasked: '+86139****1301', reason: '邀请员工注册' });
    expect(kms.encrypt).toHaveBeenCalledWith('pii', 'identity/mobile', '+8613900001301', { principal: value.principal });
    expect(hasher.recipient).toHaveBeenCalledWith('+8613900001301');
    expect(value.code.reveal()).toMatch(/^[A-Za-z0-9_-]{4}(?: [A-Za-z0-9_-]{4}){7}$/);
    value.code.clear();
    expect(() => value.code.reveal()).toThrow('INVITATION_CODE_CLEARED');
  });

  it('rejects malformed employee numbers before any encryption occurs', async () => {
    const kms = { encrypt: vi.fn() };
    const service = new PrepareEmployeeInvitation(kms as never, { issue: vi.fn() } as never, { recipient: vi.fn(), current: vi.fn() } as never);
    await expect(
      service.prepare({
        kind: 'enrollment',
        target: 'storefront',
        organizationId: 'mall:one',
        employee: { displayName: '张三', mobile: '13900001301', employeeNo: '../admin' },
        expiresAt: '2026-09-05T00:00:00.000Z',
        reason: '邀请员工注册',
      } as never)
    ).rejects.toThrow('VALIDATION_FAILED');
    expect(kms.encrypt).not.toHaveBeenCalled();
  });
});
