import { describe, expect, it } from 'vitest';
import { presentError } from '@shop/presentation';

describe('invitation failure presentation', () => {
  it.each([
    ['INVITATION_EXPIRED', '已过期', '重新发送邀请'],
    ['INVITATION_REVOKED', '已被管理员撤销', '重新邀请'],
    ['INVITATION_ACCEPTED', '已经接受', '直接登录'],
  ] as const)('explains %s without exposing a technical error', (code, state, action) => {
    const view = presentError({ kind: 'api', code, retryable: false });
    expect(view.message).toContain(state);
    expect(view.message).toContain(action);
    expect(view.message).not.toContain(code);
  });
});
