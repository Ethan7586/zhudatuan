import { lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { isTerminalFailure, presentError, type FailureView } from '@shop/presentation';
import type { AuthRequest } from '../shared/security/ReturnTarget';
import type { Dependencies } from './Dependencies';
import { initialLoginState } from '../feature/login/model/LoginState';
import { loginMachine } from '../feature/login/application/LoginMachine';
import type { LoginOutcome } from '../feature/login/model/Login';
import { LoginPage } from '../feature/login/ui/LoginPage';
import { Loading } from '../shared/ui/Loading';
import { Alert } from '../shared/ui/Alert';
import { AuthCard } from '../shell/AuthCard';
import { AuthShell } from '../shell/AuthShell';
import { challengeNotice } from '../feature/challenge/model/Challenge';
import type { Provider } from '../feature/federation/model/Provider';
import type { Membership } from '../feature/membership/model/Membership';
import { InvitationProof } from '../feature/invitation/ui/InvitationProof';
import { actionFailure, actionSuccess, type ActionResult } from '../shared/ui/ActionResult';

const EnrollmentPage = lazy(() => import('../feature/invitation/ui/EnrollmentPage').then((module) => ({ default: module.EnrollmentPage })));
const RecoveryDialog = lazy(() => import('../feature/recovery/ui/RecoveryDialog').then((module) => ({ default: module.RecoveryDialog })));
const MembershipList = lazy(() => import('../feature/membership/ui/MembershipList').then((module) => ({ default: module.MembershipList })));

const RUNNING = new Set(['bootstrapping', 'challengepending', 'submitting', 'resolvinginvitation', 'exchangingticket']);

export function AuthRuntime({ dependencies, request, invitation, onTarget }: Readonly<{ dependencies: Dependencies; request: AuthRequest; invitation: boolean; onTarget: (target: AuthRequest['target']) => void }>) {
  const [state, dispatch] = useReducer(loginMachine, request.target, initialLoginState);
  const [fields, setFields] = useState<Readonly<Record<string, string>>>({});
  const [providers, setProviders] = useState<readonly Provider[]>([]);
  const [providerFailure, setProviderFailure] = useState<FailureView>();
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providerAttempt, setProviderAttempt] = useState(0);
  const [recovery, setRecovery] = useState(false);
  const [focusTarget, setFocusTarget] = useState<AuthRequest['target']>();
  const active = useRef<AbortController | undefined>(undefined);
  const commandActive = useRef(false);
  const returns = useMemo(() => Object.freeze({ ...(request.returnTarget ? { returnTarget: request.returnTarget } : {}), ...(request.returnPath ? { returnPath: request.returnPath } : {}) }), [request.returnPath, request.returnTarget]);
  const currentBootstrap = 'bootstrap' in state ? state.bootstrap : undefined;

  useEffect(() => {
    if (state.phase !== 'bootstrapping') return;
    const controller = new AbortController();
    const command = state.command;
    void dependencies.bootstrap.execute(state.target, returns, controller.signal).then(
      (bootstrap) => {
        dispatch({ type: 'BOOTSTRAP_SUCCEEDED', command, bootstrap });
        if (invitation && bootstrap.methods.includes('invitation')) queueMicrotask(() => dispatch({ type: 'METHOD_CHANGED', method: 'invitation' }));
      },
      (cause: unknown) => { if (!controller.signal.aborted) dispatch({ type: 'BOOTSTRAP_FAILED', command, failure: presentError(cause) }); }
    );
    return () => controller.abort();
  }, [dependencies.bootstrap, invitation, returns, state.command, state.phase, state.target]);

  const loadProviders = useCallback(() => {
    const controller = new AbortController();
    setProviderFailure(undefined);
    setProvidersLoading(true);
    void dependencies.providers.execute(state.target, controller.signal).then(setProviders, (cause: unknown) => { if (!controller.signal.aborted) setProviderFailure(presentError(cause)); }).finally(() => { if (!controller.signal.aborted) setProvidersLoading(false); });
    return controller;
  }, [dependencies.providers, state.target]);

  useEffect(() => {
    if (!currentBootstrap?.methods.includes('federation')) return;
    const controller = loadProviders();
    return () => controller.abort();
  }, [currentBootstrap, loadProviders, providerAttempt]);

  useEffect(() => {
    if (state.phase === 'redirecting') window.location.replace(state.redirectUrl);
  }, [state]);

  useEffect(() => () => active.current?.abort(), []);

  useEffect(() => {
    if (!RUNNING.has(state.phase) && !(state.phase === 'enrollment' && state.submitting)) commandActive.current = false;
  }, [state]);

  const start = (invitationCommand = false) => {
    if (commandActive.current) return undefined;
    commandActive.current = true;
    active.current?.abort();
    active.current = new AbortController();
    const command = state.command + 1;
    dispatch({ type: 'SUBMIT_REQUESTED', ...(invitationCommand ? { invitation: true } : {}) });
    return Object.freeze({ command, signal: active.current.signal });
  };
  const startEnrollment = () => {
    if (commandActive.current) return undefined;
    commandActive.current = true;
    active.current?.abort();
    active.current = new AbortController();
    const command = state.command + 1;
    dispatch({ type: 'ENROLLMENT_SUBMIT_REQUESTED' });
    return Object.freeze({ command, signal: active.current.signal });
  };
  const fail = (command: number, cause: unknown): FailureView => {
    const view = presentError(cause);
    const terminal = isTerminalFailure(cause);
    dispatch({ type: terminal ? 'TERMINAL_FAILED' : 'RECOVERABLE_FAILED', command, failure: view });
    return view;
  };
  const route = async (command: number, outcome: LoginOutcome) => {
    switch (outcome.kind) {
      case 'authenticated':
        dispatch({ type: 'AUTHENTICATED', command, redirectUrl: outcome.redirectUrl });
        queueMicrotask(() => dispatch({ type: 'TICKET_EXCHANGED', command }));
        break;
      case 'membership': dispatch({ type: 'MEMBERSHIP_REQUIRED', command, memberships: outcome.memberships }); break;
      case 'proof':
        if (outcome.method === 'sso') window.location.assign(outcome.reference);
        else dispatch({ type: 'PROOF_REQUIRED', command, reference: outcome.reference, method: outcome.method, expiresAt: outcome.expiresAt });
        break;
      case 'enrollment': {
        const enrollment = await dependencies.readEnrollment.execute(outcome.id, active.current?.signal);
        dispatch({ type: 'ENROLLMENT_REQUIRED', command, enrollment });
        break;
      }
      case 'enrolled': dispatch({ type: 'ENROLLMENT_COMPLETED', command, notice: '员工商城账号已创建，请使用新账号登录。' }); break;
    }
  };
  const validateTerms = () => {
    if (state.accepted) return true;
    setFields({ agreement: '请先阅读并同意服务协议与隐私政策' });
    return false;
  };
  const password = (subject: string, password: string) => {
    const next = Object.freeze({ ...(!subject.trim() ? { subject: '请输入登录账号或已绑定手机号' } : {}), ...(!password ? { password: '请输入密码' } : {}) });
    setFields(next);
    if (Object.keys(next).length || !validateTerms()) return;
    const operation = start();
    if (operation === undefined) return;
    void dependencies.authenticate.execute({ kind: 'password', subject, password, target: state.target, returns }, operation.signal).then((outcome) => route(operation.command, outcome), (cause: unknown) => fail(operation.command, cause));
  };
  const otp = (subject: string, challenge: string, code: string) => {
    const next = Object.freeze({ ...(!subject.trim() ? { subject: '请输入登录账号或已绑定手机号' } : {}), ...(!challenge || !/^\d{6}$/.test(code) ? { code: challenge ? '请输入 6 位短信验证码' : '请先获取验证码' } : {}) });
    setFields(next);
    if (Object.keys(next).length || !validateTerms()) return;
    const operation = start();
    if (operation === undefined) return;
    void dependencies.authenticate.execute({ kind: 'otp', subject, challenge, code, target: state.target, returns }, operation.signal).then((outcome) => route(operation.command, outcome), (cause: unknown) => fail(operation.command, cause));
  };
  const challenge = async (subject: string): Promise<ActionResult<Readonly<{ id: string; resendSeconds: number }>>> => {
    if (!subject.trim()) {
      setFields({ subject: '请输入登录账号或已绑定手机号' });
      return actionFailure(presentError({ kind: 'api', code: 'VALIDATION_FAILED', retryable: false }));
    }
    active.current?.abort(); active.current = new AbortController();
    const command = state.command + 1; dispatch({ type: 'CHALLENGE_REQUESTED' });
    try {
      const value = await dependencies.challenge.execute({ purpose: 'login', destination: subject }, state.target, returns, active.current.signal);
      dispatch({ type: 'CHALLENGE_SUCCEEDED', command, notice: challengeNotice(value.validSeconds, value.resendSeconds, true) });
      return actionSuccess(Object.freeze({ id: value.id, resendSeconds: value.resendSeconds }));
    } catch (cause) { return actionFailure(fail(command, cause)); }
  };
  const resolveInvitation = async (code: string) => {
    if (!validateTerms()) return;
    const operation = start(true);
    if (operation === undefined) return;
    try {
      const outcome = await dependencies.resolveInvitation.execute({ code, target: state.target, returns, signal: operation.signal });
      dispatch({ type: 'INVITATION_RESOLVED', command: operation.command });
      await route(operation.command, outcome);
    } catch (cause) { fail(operation.command, cause); }
  };
  const select = (membership: Membership) => {
    const operation = start();
    if (operation === undefined) return;
    void dependencies.selectMembership.execute(membership.id, membership.target, operation.signal).then(({ redirectUrl }) => {
      dispatch({ type: 'AUTHENTICATED', command: operation.command, redirectUrl }); queueMicrotask(() => dispatch({ type: 'TICKET_EXCHANGED', command: operation.command }));
    }, (cause: unknown) => fail(operation.command, cause));
  };
  const proof = async (code: string) => {
    if (state.phase !== 'proof') return;
    const operation = start();
    if (operation === undefined) return;
    try { await route(operation.command, await dependencies.authenticate.proof(state.reference, code, { target: state.target, returns }, operation.signal)); }
    catch (cause) { fail(operation.command, cause); }
  };
  const changeTarget = (target: AuthRequest['target']) => {
    if (target === state.target) return;
    active.current?.abort(); dependencies.clearBootstrap(); setFields({}); setProviders([]); setProviderFailure(undefined); setFocusTarget(target); dispatch({ type: 'TARGET_CHANGED', target }); onTarget(target);
  };
  const stage = state.phase === 'membershipselection' ? <MembershipList memberships={state.memberships} busy={false} onSelect={select} /> : state.phase === 'proof' ? <InvitationProof busy={false} method={state.methodKind} onSubmit={proof} /> : undefined;

  if (state.phase === 'bootstrapping') return <AuthShell><AuthCard stage={1} onBack={() => undefined}><Loading label="正在初始化安全登录…" /></AuthCard></AuthShell>;
  if (state.phase === 'bootstrapfailure' || state.phase === 'terminalfailure') return <AuthShell><AuthCard stage={1} onBack={() => undefined}><Alert failure={state.failure} onAction={() => dispatch({ type: 'BOOTSTRAP_REQUESTED', target: state.target })} /></AuthCard></AuthShell>;
  if (state.phase === 'cancelled') return <AuthShell><AuthCard stage={1} onBack={() => undefined}><section className="authstatus"><h1>操作已取消</h1><p>当前请求已安全停止，你可以重新开始登录。</p><button className="authprimary" type="button" onClick={() => dispatch({ type: 'RETRY_REQUESTED' })}>重新开始</button></section></AuthCard></AuthShell>;
  const pageFailure = state.phase === 'recoverablefailure' ? state.failure : undefined;
  return <><LoginPage bootstrap={state.bootstrap} target={state.target} {...(focusTarget ? { focusTarget } : {})} method={state.method} accepted={state.accepted} busy={RUNNING.has(state.phase)} fields={fields} providers={providers} providersLoading={providersLoading} {...(pageFailure ? { failure: pageFailure } : {})} {...(state.notice ? { notice: state.notice } : {})} {...(providerFailure ? { providerFailure } : {})} {...(stage ? { stage } : {})} onMethod={(method) => { active.current?.abort(); setFields({}); dispatch({ type: 'METHOD_CHANGED', method }); }} onTarget={changeTarget} onAccepted={(accepted) => { setFields({}); dispatch({ type: 'ACCEPTANCE_CHANGED', accepted }); }} onPassword={password} onOtp={otp} onChallenge={challenge} onInvitation={resolveInvitation} onProvider={(provider) => { if (!validateTerms()) return; const operation = start(); if (operation === undefined) return; void dependencies.federation.execute(provider.id, state.target, returns, operation.signal).then(({ redirectUrl }) => window.location.assign(redirectUrl), (cause: unknown) => fail(operation.command, cause)); }} onProviderRetry={() => setProviderAttempt((value) => value + 1)} onBack={() => dispatch({ type: 'BACK_REQUESTED' })} onReset={() => setRecovery(true)} />
    {state.phase === 'enrollment' ? <EnrollmentPage enrollment={state.enrollment} passwordPolicy={state.bootstrap.password} createChallenge={async (request) => { active.current?.abort(); active.current = new AbortController(); try { return actionSuccess(await dependencies.challenge.execute(request, 'storefront', {}, active.current.signal)); } catch (cause) { return actionFailure(presentError(cause)); } }} onComplete={async (input) => { const operation = startEnrollment(); if (operation === undefined) return actionFailure(presentError({ kind: 'client', code: 'UNEXPECTED_FAILURE', retryable: false })); try { await route(operation.command, await dependencies.completeEnrollment.execute(input, operation.signal)); return actionSuccess(undefined); } catch (cause) { const view = presentError(cause); dispatch({ type: 'ENROLLMENT_FAILED', command: operation.command, failure: view }); return actionFailure(view); } }} onClose={() => dispatch({ type: 'BACK_REQUESTED' })} /> : null}
    {recovery ? <RecoveryDialog open bootstrap={state.bootstrap} onChallenge={async (destination) => { active.current?.abort(); active.current = new AbortController(); try { return actionSuccess(await dependencies.challenge.execute({ purpose: 'password_reset', destination }, 'storefront', {}, active.current.signal)); } catch (cause) { return actionFailure(presentError(cause)); } }} onReset={async (challengeId, code, passwordValue) => { active.current?.abort(); active.current = new AbortController(); try { await dependencies.recovery.execute({ challenge: challengeId, code, password: passwordValue }, active.current.signal); setRecovery(false); dispatch({ type: 'NOTICE_CHANGED', notice: '密码已重置，所有旧会话已撤销，请使用新密码登录。' }); return actionSuccess(undefined); } catch (cause) { return actionFailure(presentError(cause)); } }} onClose={() => setRecovery(false)} /> : null}
  </>;
}
