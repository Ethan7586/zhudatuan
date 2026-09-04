import { isTerminalFailure, presentError, type FailureView } from '@shop/presentation';
import { useEffect, useRef, type Dispatch } from 'react';
import type { Dependencies } from '../../../app/Dependencies';
import type { LoginOutcome } from '../model/Login';
import type { LoginEvent, LoginState } from '../model/LoginState';

const RUNNING = new Set(['bootstrapping', 'challengepending', 'submitting', 'resolvinginvitation', 'exchangingticket']);

export function loginBusy(state: LoginState): boolean {
  return RUNNING.has(state.phase);
}

export function useLoginCommand(dependencies: Dependencies, state: LoginState, dispatch: Dispatch<LoginEvent>) {
  const active = useRef<AbortController | undefined>(undefined);
  const commandActive = useRef(false);

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (!RUNNING.has(state.phase) && !(state.phase === 'enrollment' && state.submitting)) commandActive.current = false;
  }, [state]);

  const renew = (): AbortSignal => {
    active.current?.abort();
    active.current = new AbortController();
    return active.current.signal;
  };
  const start = (invitation = false) => {
    if (commandActive.current) return undefined;
    commandActive.current = true;
    const signal = renew();
    const command = state.command + 1;
    dispatch({ type: 'SUBMIT_REQUESTED', ...(invitation ? { invitation: true } : {}) });
    return Object.freeze({ command, signal });
  };
  const startEnrollment = () => {
    if (commandActive.current) return undefined;
    commandActive.current = true;
    const signal = renew();
    const command = state.command + 1;
    dispatch({ type: 'ENROLLMENT_SUBMIT_REQUESTED' });
    return Object.freeze({ command, signal });
  };
  const fail = (command: number, cause: unknown): FailureView => {
    const view = presentError(cause);
    dispatch({ type: isTerminalFailure(cause) ? 'TERMINAL_FAILED' : 'RECOVERABLE_FAILED', command, failure: view });
    return view;
  };
  const route = async (command: number, outcome: LoginOutcome) => {
    if (outcome.kind === 'authenticated') {
      dispatch({ type: 'AUTHENTICATED', command, redirectUrl: outcome.redirectUrl });
      queueMicrotask(() => dispatch({ type: 'TICKET_EXCHANGED', command }));
    } else if (outcome.kind === 'membership') dispatch({ type: 'MEMBERSHIP_REQUIRED', command, memberships: outcome.memberships });
    else if (outcome.kind === 'proof') {
      if (outcome.method === 'sso') dependencies.navigation.assignExternal(outcome.reference);
      else dispatch({ type: 'PROOF_REQUIRED', command, reference: outcome.reference, method: outcome.method, expiresAt: outcome.expiresAt, ...(outcome.challenge ? { challenge: outcome.challenge } : {}) });
    } else if (outcome.kind === 'enrollment') {
      const enrollment = await dependencies.readEnrollment.execute(outcome.id, { target: outcome.target }, active.current?.signal);
      dispatch({ type: 'ENROLLMENT_REQUIRED', command, enrollment });
    } else dispatch({ type: 'ENROLLMENT_COMPLETED', command, notice: '员工商城账号已创建，请使用新账号登录。' });
  };
  return Object.freeze({ start, startEnrollment, fail, route, renew, cancel: () => active.current?.abort() });
}
