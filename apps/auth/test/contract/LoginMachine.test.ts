import { describe, expect, it } from 'vitest';
import type { FailureView } from '@shop/presentation';
import type { Bootstrap } from '../../src/feature/bootstrap/model/Bootstrap';
import { loginMachine } from '../../src/feature/login/model/LoginMachine';
import { initialLoginState, type LoginEvent, type LoginState } from '../../src/feature/login/model/LoginState';

const bootstrap: Bootstrap = Object.freeze({
  target: 'storefront',
  returnTarget: 'signed',
  expiresAt: Date.now() + 60_000,
  csrf: 'csrf',
  methods: Object.freeze(['password', 'otp', 'federation'] as const),
  preferredMethod: 'password',
  password: Object.freeze({ minimumLength: 12, maximumLength: 128, uppercase: true, lowercase: true, number: true, symbol: true }),
  otp: Object.freeze({ validSeconds: 300, resendSeconds: 60 }),
  legal: Object.freeze({ termsTitle: '服务协议', termsBody: '条款', privacyTitle: '隐私政策', privacyBody: '隐私', termsHash: 'hash' }),
});
const problem: FailureView = Object.freeze({ title: '请求失败', message: '请重试', severity: 'warning', action: Object.freeze({ kind: 'retry', label: '重试' }), retryable: true });

function ready(accepted = false): LoginState {
  return loginMachine(initialLoginState('storefront'), { type: 'BOOTSTRAP_SUCCEEDED', command: 1, bootstrap: Object.freeze({ ...bootstrap, target: 'storefront' }) });
}

function reduce(state: LoginState, ...events: readonly LoginEvent[]): LoginState {
  return events.reduce(loginMachine, state);
}

describe('LoginMachine', () => {
  it('covers bootstrap success, failure and retry without hidden side effects', () => {
    const loading = initialLoginState('storefront');
    expect(loginMachine(loading, { type: 'BOOTSTRAP_SUCCEEDED', command: 1, bootstrap }).phase).toBe('ready');
    const failed = loginMachine(loading, { type: 'BOOTSTRAP_FAILED', command: 1, failure: problem });
    expect(failed.phase).toBe('bootstrapfailure');
    expect(loginMachine(failed, { type: 'RETRY_REQUESTED' })).toMatchObject({ phase: 'bootstrapping', command: 2 });
  });

  it('covers challenge, submit, invitation, enrollment, proof and membership legal transitions', () => {
    const accepted = loginMachine(ready(), { type: 'ACCEPTANCE_CHANGED', accepted: true });
    const challenge = loginMachine(accepted, { type: 'CHALLENGE_REQUESTED' });
    expect(challenge).toMatchObject({ phase: 'challengepending', command: 2 });
    expect(loginMachine(challenge, { type: 'CHALLENGE_SUCCEEDED', command: 2, notice: 'sent' })).toMatchObject({ phase: 'ready', notice: 'sent' });
    expect(loginMachine(challenge, { type: 'CHALLENGE_FAILED', command: 2, failure: problem }).phase).toBe('recoverablefailure');

    const invitation = loginMachine(accepted, { type: 'SUBMIT_REQUESTED', invitation: true });
    expect(invitation.phase).toBe('resolvinginvitation');
    const resolving = loginMachine(invitation, { type: 'INVITATION_RESOLVED', command: 2 });
    expect(resolving.phase).toBe('submitting');
    expect(loginMachine(resolving, { type: 'ENROLLMENT_REQUIRED', command: 2, enrollment: enrollment() })).toMatchObject({ phase: 'enrollment', submitting: false });
    expect(loginMachine(resolving, { type: 'PROOF_REQUIRED', command: 2, reference: 'proof', method: 'otp', expiresAt: '2099-01-01' }).phase).toBe('proof');
    expect(loginMachine(resolving, { type: 'MEMBERSHIP_REQUIRED', command: 2, memberships: [] }).phase).toBe('membershipselection');
  });

  it('exchanges a ticket once and makes redirecting insensitive to form events', () => {
    const submitted = reduce(ready(), { type: 'ACCEPTANCE_CHANGED', accepted: true }, { type: 'SUBMIT_REQUESTED' });
    const exchange = loginMachine(submitted, { type: 'AUTHENTICATED', command: 2, redirectUrl: 'https://storefront.example.test' });
    expect(exchange.phase).toBe('exchangingticket');
    const redirected = loginMachine(exchange, { type: 'TICKET_EXCHANGED', command: 2 });
    expect(redirected.phase).toBe('redirecting');
    expect(loginMachine(redirected, { type: 'SUBMIT_REQUESTED' })).toBe(redirected);
    expect(loginMachine(redirected, { type: 'METHOD_CHANGED', method: 'otp' })).toBe(redirected);
  });

  it('rejects double submit and illegal transitions without incrementing a command', () => {
    const submitted = reduce(ready(), { type: 'ACCEPTANCE_CHANGED', accepted: true }, { type: 'SUBMIT_REQUESTED' });
    expect(loginMachine(submitted, { type: 'SUBMIT_REQUESTED' })).toBe(submitted);
    expect(loginMachine(ready(), { type: 'AUTHENTICATED', command: 1, redirectUrl: 'https://invalid.example' })).toEqual(ready());
  });

  it('invalidates late responses after target changes and rejects unavailable methods', () => {
    const submitted = reduce(ready(), { type: 'ACCEPTANCE_CHANGED', accepted: true }, { type: 'SUBMIT_REQUESTED' });
    const changed = loginMachine(submitted, { type: 'TARGET_CHANGED', target: 'console' });
    expect(changed).toMatchObject({ phase: 'bootstrapping', target: 'console', command: 3 });
    expect(loginMachine(changed, { type: 'AUTHENTICATED', command: 2, redirectUrl: 'https://stale.example' })).toBe(changed);
    const passwordOnly = loginMachine(initialLoginState('storefront'), { type: 'BOOTSTRAP_SUCCEEDED', command: 1, bootstrap: Object.freeze({ ...bootstrap, methods: ['password'] as const }) });
    expect(loginMachine(passwordOnly, { type: 'METHOD_CHANGED', method: 'otp' })).toBe(passwordOnly);
  });

  it('allows terminal failure to restart only through bootstrap', () => {
    const terminal = loginMachine(ready(), { type: 'TERMINAL_FAILED', command: 1, failure: problem });
    expect(terminal.phase).toBe('terminalfailure');
    expect(loginMachine(terminal, { type: 'SUBMIT_REQUESTED' })).toBe(terminal);
    expect(loginMachine(terminal, { type: 'RETRY_REQUESTED' })).toBe(terminal);
    expect(loginMachine(terminal, { type: 'BOOTSTRAP_REQUESTED', target: 'storefront' })).toMatchObject({ phase: 'bootstrapping', command: 2 });
  });

  it('supports cancellation, recoverable retry, back navigation, enrollment completion and notices', () => {
    const submitted = reduce(ready(), { type: 'ACCEPTANCE_CHANGED', accepted: true }, { type: 'SUBMIT_REQUESTED' });
    const cancelled = loginMachine(submitted, { type: 'CANCELLED', command: 2 });
    expect(loginMachine(cancelled, { type: 'RETRY_REQUESTED' }).phase).toBe('bootstrapping');
    const failed = loginMachine(submitted, { type: 'RECOVERABLE_FAILED', command: 2, failure: problem });
    expect(loginMachine(failed, { type: 'RETRY_REQUESTED' }).phase).toBe('ready');
    const enrollmentState = loginMachine(submitted, { type: 'ENROLLMENT_REQUIRED', command: 2, enrollment: enrollment() });
    const enrollmentSubmitting = loginMachine(enrollmentState, { type: 'ENROLLMENT_SUBMIT_REQUESTED' });
    expect(enrollmentSubmitting).toMatchObject({ phase: 'enrollment', submitting: true, command: 3 });
    expect(loginMachine(enrollmentSubmitting, { type: 'ENROLLMENT_SUBMIT_REQUESTED' })).toBe(enrollmentSubmitting);
    expect(loginMachine(enrollmentSubmitting, { type: 'BACK_REQUESTED' })).toBe(enrollmentSubmitting);
    expect(loginMachine(enrollmentSubmitting, { type: 'ENROLLMENT_COMPLETED', command: 3, notice: 'complete' })).toMatchObject({ phase: 'registrationcomplete', notice: 'complete' });
    expect(loginMachine(enrollmentState, { type: 'ENROLLMENT_COMPLETED', command: 2, notice: 'illegal' })).toBe(enrollmentState);
    const enrollmentFailed = loginMachine(enrollmentSubmitting, { type: 'ENROLLMENT_FAILED', command: 3, failure: problem });
    expect(enrollmentFailed).toMatchObject({ phase: 'enrollment', submitting: false });
    expect(loginMachine(enrollmentFailed, { type: 'BACK_REQUESTED' }).phase).toBe('ready');
    expect(loginMachine(ready(), { type: 'NOTICE_CHANGED', notice: 'updated' })).toMatchObject({ phase: 'ready', notice: 'updated' });
  });
});

function enrollment() {
  return Object.freeze({
    id: 'enrollment',
    kind: 'enrollment' as const,
    target: 'storefront' as const,
    expiresAt: '2099-01-01',
    subjectMode: 'bound' as const,
    organization: Object.freeze({ id: 'organization', name: '示例企业' }),
    employee: Object.freeze({ displayName: '测试员工' }),
    policy: bootstrap.legal,
  });
}
