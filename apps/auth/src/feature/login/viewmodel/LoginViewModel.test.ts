import { describe, expect, it } from 'vitest';
import { initialLoginState } from '../model/LoginState';
import { loginMachine } from '../model/LoginMachine';

describe('LoginViewModel state machine', () => {
  it('ignores a late bootstrap response after the command identity changes', () => {
    const current = loginMachine(initialLoginState('console'), { type: 'BOOTSTRAP_REQUESTED', target: 'storefront' });
    const late = loginMachine(current, { type: 'BOOTSTRAP_FAILED', command: 1, failure: { title: '失败', message: 'late', severity: 'danger', action: { kind: 'retry', label: '重试' }, retryable: true } });
    expect(late).toBe(current);
  });

  it('keeps the resolved invitation mode through proof and clears it when returning', () => {
    const bootstrap = { target: 'console', preferredMethod: 'password', methods: ['password'] } as never;
    let state = loginMachine(initialLoginState('console'), { type: 'BOOTSTRAP_SUCCEEDED', command: 1, bootstrap });
    state = loginMachine(state, { type: 'ACCEPTANCE_CHANGED', accepted: true });
    state = loginMachine(state, { type: 'SUBMIT_REQUESTED', invitation: true });
    state = loginMachine(state, { type: 'INVITATION_RESOLVED', command: 2, mode: 'signin' });
    state = loginMachine(state, { type: 'PROOF_REQUIRED', command: 2, reference: 'challenge:one', method: 'otp', expiresAt: '2026-09-09T12:00:00.000Z' });
    expect(state).toMatchObject({ phase: 'proof', invitationMode: 'signin' });

    state = loginMachine(state, { type: 'BACK_REQUESTED' });
    expect(state).toMatchObject({ phase: 'ready' });
    expect('invitationMode' in state).toBe(false);
  });

  it('clears a resolved invitation mode after a recoverable failure so the code can be entered again', () => {
    const bootstrap = { target: 'console', preferredMethod: 'password', methods: ['password'] } as never;
    let state = loginMachine(initialLoginState('console'), { type: 'BOOTSTRAP_SUCCEEDED', command: 1, bootstrap });
    state = loginMachine(state, { type: 'ACCEPTANCE_CHANGED', accepted: true });
    state = loginMachine(state, { type: 'SUBMIT_REQUESTED', invitation: true });
    state = loginMachine(state, { type: 'INVITATION_RESOLVED', command: 2, mode: 'signin' });
    state = loginMachine(state, {
      type: 'RECOVERABLE_FAILED',
      command: 2,
      failure: { title: '验证未完成', message: '请重新输入邀请码', severity: 'warning', action: { kind: 'retry', label: '重试' }, retryable: true },
    });
    expect(state).toMatchObject({ phase: 'recoverablefailure' });
    expect('invitationMode' in state).toBe(false);
  });
});
