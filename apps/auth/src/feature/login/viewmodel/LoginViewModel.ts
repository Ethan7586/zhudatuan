import { useEffect, useMemo, useReducer, useState } from 'react';
import { presentError } from '@shop/presentation';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { Dependencies } from '../../../app/Dependencies';
import { initialLoginState } from '../model/LoginState';
import { loginMachine } from '../model/LoginMachine';
import { challengeNotice, type Challenge, type ChallengeRequest } from '../../challenge';
import type { LoginMethod } from '../../bootstrap';
import type { Provider } from '../../federation';
import type { Membership } from '../../membership';
import { actionFailure, actionSuccess, type ActionResult } from '../../../shared/ui/ActionResult';
import type { EnrollmentCompletion } from '../../enrollment';
import { loginBusy, useLoginCommand } from './LoginCommandViewModel';
import { useLoginProviderViewModel } from './LoginProviderViewModel';
import { startLoginProvider } from './LoginProviderAction';

const NO_METHODS: readonly [] = Object.freeze([]);

export function useLoginViewModel(dependencies: Dependencies, request: SessionRequest, invitation: boolean, onTarget: (target: SessionRequest['target']) => void) {
  const [state, dispatch] = useReducer(loginMachine, request.target, initialLoginState);
  const [fields, setFields] = useState<Readonly<Record<string, string>>>({});
  const [recovery, setRecovery] = useState(false);
  const [focusTarget, setFocusTarget] = useState<SessionRequest['target']>();
  const session = useMemo(() => Object.freeze({ target: request.target, ...(request.returnTarget ? { returnTarget: request.returnTarget } : {}), ...(request.returnPath ? { returnPath: request.returnPath } : {}) }), [request.returnPath, request.returnTarget, request.target]);
  const currentBootstrap = 'bootstrap' in state ? state.bootstrap : undefined;
  const command = useLoginCommand(dependencies, state, dispatch);
  const providerState = useLoginProviderViewModel(dependencies, session, currentBootstrap?.methods ?? NO_METHODS);

  useEffect(() => {
    if (state.phase !== 'bootstrapping') return;
    const controller = new AbortController();
    const command = state.command;
    void dependencies.bootstrap.execute(session, controller.signal).then(
      (bootstrap) => {
        dispatch({ type: 'BOOTSTRAP_SUCCEEDED', command, bootstrap });
        if (invitation && bootstrap.methods.includes('invitation')) queueMicrotask(() => dispatch({ type: 'METHOD_CHANGED', method: 'invitation' }));
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'BOOTSTRAP_FAILED', command, failure: presentError(cause) });
      }
    );
    return () => controller.abort();
  }, [dependencies.bootstrap, invitation, session, state.command, state.phase]);

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
    void dependencies.authenticate.execute({ kind: 'password', subject, password, session }, operation.signal).then(
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
    void dependencies.authenticate.execute({ kind: 'otp', subject, challenge, code, session }, operation.signal).then(
      (outcome) => command.route(operation.command, outcome),
      (cause: unknown) => command.fail(operation.command, cause)
    );
  };
  const challenge = async (subject: string): Promise<ActionResult<Challenge>> => {
    if (!subject.trim()) {
      setFields({ subject: '请输入登录账号或已绑定手机号' });
      return actionFailure(presentError({ kind: 'api', code: 'VALIDATION_FAILED', retryable: false }));
    }
    const signal = command.renew();
    const sequence = state.command + 1;
    dispatch({ type: 'CHALLENGE_REQUESTED' });
    try {
      const value = await dependencies.challenge.execute({ purpose: 'login', destination: subject }, session, signal);
      dispatch({ type: 'CHALLENGE_SUCCEEDED', command: sequence, notice: challengeNotice(value, true) });
      return actionSuccess(value);
    } catch (cause) {
      return actionFailure(command.fail(sequence, cause));
    }
  };
  const resolveInvitation = async (code: string) => {
    if (!validateTerms()) return;
    const operation = command.start(true);
    if (operation === undefined) return;
    try {
      const outcome = await dependencies.invitationView.resolve({ code, session, signal: operation.signal });
      dispatch({ type: 'INVITATION_RESOLVED', command: operation.command });
      await command.route(operation.command, outcome);
    } catch (cause) {
      command.fail(operation.command, cause);
    }
  };
  const select = (membership: Membership) => {
    const operation = command.start();
    if (operation === undefined) return;
    void dependencies.selectMembership.execute(membership.id, { ...session, target: membership.target }, operation.signal).then(
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
      await command.route(operation.command, await dependencies.authenticate.proof(state.reference, code, session, operation.signal));
    } catch (cause) {
      command.fail(operation.command, cause);
    }
  };
  const changeTarget = (target: SessionRequest['target']) => {
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
      const target = state.phase === 'enrollment' ? state.enrollment.target : state.target;
      return actionSuccess(await dependencies.challenge.execute(input, { ...session, target }, signal));
    } catch (cause) {
      return actionFailure(presentError(cause));
    }
  };
  const completeEnrollment = async (input: EnrollmentCompletion): Promise<ActionResult<void>> => {
    const operation = command.startEnrollment();
    if (operation === undefined) return actionFailure(presentError({ kind: 'client', code: 'UNEXPECTED_FAILURE', retryable: false }));
    try {
      const target = state.phase === 'enrollment' ? state.enrollment.target : session.target;
      await command.route(operation.command, await dependencies.completeEnrollment.execute(input, { ...session, target }, operation.signal));
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
      return actionSuccess(await dependencies.challenge.execute({ purpose: 'password_reset', destination }, session, signal));
    } catch (cause) {
      return actionFailure(presentError(cause));
    }
  };
  const resetPassword = async (challengeId: string, code: string, passwordValue: string): Promise<ActionResult<void>> => {
    const signal = command.renew();
    try {
      await dependencies.recovery.execute({ challenge: challengeId, code, password: passwordValue }, session, signal);
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
    providers: providerState.catalog,
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
    provider: (provider: Provider) => startLoginProvider(provider, validateTerms, command, dependencies, session),
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
