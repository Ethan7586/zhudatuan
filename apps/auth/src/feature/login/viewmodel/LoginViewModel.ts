import { useEffect, useMemo, useReducer, useState } from 'react';
import { presentError } from '@shop/presentation';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { Dependencies } from '../../../app/Dependencies';
import { initialLoginState } from '../model/LoginState';
import { loginMachine } from '../model/LoginMachine';
import { challengeNotice, type Challenge, type ChallengeRequest } from '../../challenge';
import type { LoginMethod } from '../../bootstrap';
import type { Provider } from '../../federation';
import type { Membership } from '../../membership';
import { actionFailure, actionSuccess, type ActionResult } from '../../../shared/ui/ActionResult';
import type { EnrollmentCompletion } from '../../invitation';
import { loginBusy, useLoginCommand } from './LoginCommandViewModel';
import { useLoginProviderViewModel } from './LoginProviderViewModel';

export function useLoginViewModel(dependencies: Dependencies, request: AuthRequest, invitation: boolean, onTarget: (target: AuthRequest['target']) => void) {
  const [state, dispatch] = useReducer(loginMachine, request.target, initialLoginState);
  const [fields, setFields] = useState<Readonly<Record<string, string>>>({});
  const [recovery, setRecovery] = useState(false);
  const [focusTarget, setFocusTarget] = useState<AuthRequest['target']>();
  const returns = useMemo(() => Object.freeze({ ...(request.returnTarget ? { returnTarget: request.returnTarget } : {}), ...(request.returnPath ? { returnPath: request.returnPath } : {}) }), [request.returnPath, request.returnTarget]);
  const currentBootstrap = 'bootstrap' in state ? state.bootstrap : undefined;
  const command = useLoginCommand(dependencies, state, dispatch);
  const providerState = useLoginProviderViewModel(dependencies, state.target, currentBootstrap?.methods.includes('federation') ?? false);

  useEffect(() => {
    if (state.phase !== 'bootstrapping') return;
    const controller = new AbortController();
    const command = state.command;
    void dependencies.bootstrap.execute(state.target, returns, controller.signal).then(
      (bootstrap) => {
        dispatch({ type: 'BOOTSTRAP_SUCCEEDED', command, bootstrap });
        if (invitation && bootstrap.methods.includes('invitation')) queueMicrotask(() => dispatch({ type: 'METHOD_CHANGED', method: 'invitation' }));
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'BOOTSTRAP_FAILED', command, failure: presentError(cause) });
      }
    );
    return () => controller.abort();
  }, [dependencies.bootstrap, invitation, returns, state.command, state.phase, state.target]);

  useEffect(() => {
    if (state.phase === 'redirecting') dependencies.navigation.replace(state.redirectUrl);
  }, [dependencies.navigation, state]);

  const validateTerms = () => {
    if (state.accepted) return true;
    setFields({ agreement: '请先阅读并同意服务协议与隐私政策' });
    return false;
  };
  const password = (subject: string, password: string) => {
    const next = Object.freeze({ ...(!subject.trim() ? { subject: '请输入登录账号或已绑定手机号' } : {}), ...(!password ? { password: '请输入密码' } : {}) });
    setFields(next);
    if (Object.keys(next).length || !validateTerms()) return;
    const operation = command.start();
    if (operation === undefined) return;
    void dependencies.authenticate.execute({ kind: 'password', subject, password, target: state.target, returns }, operation.signal).then(
      (outcome) => command.route(operation.command, outcome),
      (cause: unknown) => command.fail(operation.command, cause)
    );
  };
  const otp = (subject: string, challenge: string, code: string) => {
    const next = Object.freeze({ ...(!subject.trim() ? { subject: '请输入登录账号或已绑定手机号' } : {}), ...(!challenge || !/^\d{6}$/.test(code) ? { code: challenge ? '请输入 6 位短信验证码' : '请先获取验证码' } : {}) });
    setFields(next);
    if (Object.keys(next).length || !validateTerms()) return;
    const operation = command.start();
    if (operation === undefined) return;
    void dependencies.authenticate.execute({ kind: 'otp', subject, challenge, code, target: state.target, returns }, operation.signal).then(
      (outcome) => command.route(operation.command, outcome),
      (cause: unknown) => command.fail(operation.command, cause)
    );
  };
  const challenge = async (subject: string): Promise<ActionResult<Readonly<{ id: string; resendSeconds: number }>>> => {
    if (!subject.trim()) {
      setFields({ subject: '请输入登录账号或已绑定手机号' });
      return actionFailure(presentError({ kind: 'api', code: 'VALIDATION_FAILED', retryable: false }));
    }
    const signal = command.renew();
    const sequence = state.command + 1;
    dispatch({ type: 'CHALLENGE_REQUESTED' });
    try {
      const value = await dependencies.challenge.execute({ purpose: 'login', destination: subject }, state.target, returns, signal);
      dispatch({ type: 'CHALLENGE_SUCCEEDED', command: sequence, notice: challengeNotice(value.validSeconds, value.resendSeconds, true) });
      return actionSuccess(Object.freeze({ id: value.id, resendSeconds: value.resendSeconds }));
    } catch (cause) {
      return actionFailure(command.fail(sequence, cause));
    }
  };
  const resolveInvitation = async (code: string) => {
    if (!validateTerms()) return;
    const operation = command.start(true);
    if (operation === undefined) return;
    try {
      const outcome = await dependencies.invitationView.resolve({ code, target: state.target, returns, signal: operation.signal });
      dispatch({ type: 'INVITATION_RESOLVED', command: operation.command });
      await command.route(operation.command, outcome);
    } catch (cause) {
      command.fail(operation.command, cause);
    }
  };
  const select = (membership: Membership) => {
    const operation = command.start();
    if (operation === undefined) return;
    void dependencies.selectMembership.execute(membership.id, membership.target, operation.signal).then(
      ({ redirectUrl }) => {
        dispatch({ type: 'AUTHENTICATED', command: operation.command, redirectUrl });
        queueMicrotask(() => dispatch({ type: 'TICKET_EXCHANGED', command: operation.command }));
      },
      (cause: unknown) => command.fail(operation.command, cause)
    );
  };
  const proof = async (code: string) => {
    if (state.phase !== 'proof') return;
    const operation = command.start();
    if (operation === undefined) return;
    try {
      await command.route(operation.command, await dependencies.authenticate.proof(state.reference, code, { target: state.target, returns }, operation.signal));
    } catch (cause) {
      command.fail(operation.command, cause);
    }
  };
  const changeTarget = (target: AuthRequest['target']) => {
    if (target === state.target) return;
    command.cancel();
    dependencies.clearBootstrap();
    setFields({});
    providerState.clear();
    setFocusTarget(target);
    dispatch({ type: 'TARGET_CHANGED', target });
    onTarget(target);
  };
  const createEnrollmentChallenge = async (input: ChallengeRequest): Promise<ActionResult<Challenge>> => {
    const signal = command.renew();
    try {
      return actionSuccess(await dependencies.challenge.execute(input, 'storefront', {}, signal));
    } catch (cause) {
      return actionFailure(presentError(cause));
    }
  };
  const completeEnrollment = async (input: EnrollmentCompletion): Promise<ActionResult<void>> => {
    const operation = command.startEnrollment();
    if (operation === undefined) return actionFailure(presentError({ kind: 'client', code: 'UNEXPECTED_FAILURE', retryable: false }));
    try {
      await command.route(operation.command, await dependencies.invitationView.complete(input, operation.signal));
      return actionSuccess(undefined);
    } catch (cause) {
      const view = presentError(cause);
      dispatch({ type: 'ENROLLMENT_FAILED', command: operation.command, failure: view });
      return actionFailure(view);
    }
  };
  const recoveryChallenge = async (destination: string): Promise<ActionResult<Challenge>> => {
    const signal = command.renew();
    try {
      return actionSuccess(await dependencies.challenge.execute({ purpose: 'password_reset', destination }, 'storefront', {}, signal));
    } catch (cause) {
      return actionFailure(presentError(cause));
    }
  };
  const resetPassword = async (challengeId: string, code: string, passwordValue: string): Promise<ActionResult<void>> => {
    const signal = command.renew();
    try {
      await dependencies.recovery.execute({ challenge: challengeId, code, password: passwordValue }, signal);
      setRecovery(false);
      dispatch({ type: 'NOTICE_CHANGED', notice: '密码已重置，所有旧会话已撤销，请使用新密码登录。' });
      return actionSuccess(undefined);
    } catch (cause) {
      return actionFailure(presentError(cause));
    }
  };
  const pageFailure = state.phase === 'recoverablefailure' ? state.failure : undefined;
  return Object.freeze({
    state,
    fields,
    providers: providerState.providers,
    providersLoading: providerState.loading,
    providerFailure: providerState.failure,
    focusTarget,
    recovery,
    busy: loginBusy(state),
    pageFailure,
    password,
    otp,
    challenge,
    resolveInvitation,
    select,
    proof,
    changeTarget,
    method: (method: LoginMethod) => {
      command.cancel();
      setFields({});
      dispatch({ type: 'METHOD_CHANGED', method });
    },
    accepted: (accepted: boolean) => {
      setFields({});
      dispatch({ type: 'ACCEPTANCE_CHANGED', accepted });
    },
    provider: (provider: Provider) => {
      if (!validateTerms()) return;
      const operation = command.start();
      if (operation === undefined) return;
      void dependencies.federationView.start(provider.id, state.target, returns, operation.signal).then(
        ({ redirectUrl }) => dependencies.navigation.assign(redirectUrl),
        (cause: unknown) => command.fail(operation.command, cause)
      );
    },
    retryProviders: providerState.retry,
    back: () => dispatch({ type: 'BACK_REQUESTED' }),
    retry: () => dispatch({ type: 'BOOTSTRAP_REQUESTED', target: state.target }),
    restart: () => dispatch({ type: 'RETRY_REQUESTED' }),
    openRecovery: () => setRecovery(true),
    closeRecovery: () => setRecovery(false),
    createEnrollmentChallenge,
    completeEnrollment,
    recoveryChallenge,
    resetPassword,
  });
}
