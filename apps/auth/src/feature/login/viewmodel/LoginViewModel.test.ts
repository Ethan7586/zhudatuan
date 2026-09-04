import { describe, expect, it } from 'vitest';
import { initialLoginState } from '../model/LoginState';
import { loginMachine } from '../model/LoginMachine';

describe('LoginViewModel state machine', () => {
  it('ignores a late bootstrap response after the command identity changes', () => {
    const current = loginMachine(initialLoginState('console'), { type: 'BOOTSTRAP_REQUESTED', target: 'storefront' });
    const late = loginMachine(current, { type: 'BOOTSTRAP_FAILED', command: 1, failure: { title: '失败', message: 'late', severity: 'danger', action: { kind: 'retry', label: '重试' }, retryable: true } });
    expect(late).toBe(current);
  });
});
