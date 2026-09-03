import { describe, expect, it } from 'vitest';
import { loginMachine } from '../../src/feature/login/application/LoginMachine';
import { initialLoginState } from '../../src/feature/login/model/LoginState';
import { bootstrap } from '../TestData';

describe('replay protection at the UI boundary', () => {
  it('ignores stale completions and does not submit twice while an operation is active', () => {
    const ready = loginMachine(initialLoginState('storefront'), { type: 'BOOTSTRAP_SUCCEEDED', command: 1, bootstrap });
    const accepted = loginMachine(ready, { type: 'ACCEPTANCE_CHANGED', accepted: true });
    const active = loginMachine(accepted, { type: 'SUBMIT_REQUESTED' });
    expect(loginMachine(active, { type: 'SUBMIT_REQUESTED' })).toBe(active);
    const switched = loginMachine(active, { type: 'TARGET_CHANGED', target: 'console' });
    expect(loginMachine(switched, { type: 'AUTHENTICATED', command: active.command, redirectUrl: 'https://attacker.example' })).toBe(switched);
  });
});
