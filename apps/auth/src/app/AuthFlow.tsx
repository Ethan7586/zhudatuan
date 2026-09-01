import { useEffect, useMemo, useState } from 'react';
import type { AuthenticationOutcome, AuthMethod, EnrollmentState, MembershipChoice, ProviderChoice } from '../entity/authentication/AuthenticationState';
import { EnrollmentPage } from '../feature/invitation/EnrollmentPage';
import { InvitationError } from '../feature/invitation/InvitationError';
import { InvitationProof } from '../feature/invitation/InvitationProof';
import { LoginPage } from '../feature/login/LoginPage';
import { PasswordResetDialog } from '../feature/login/PasswordResetDialog';
import { MembershipSelection } from '../feature/selection/MembershipSelection';
import { TermsDialog } from '../shared/ui/TermsDialog';
import { challengeNotice, OTP_POLICY } from '../shared/challenge/ChallengePolicy';
import { authentication } from './Authentication';
import { useAuth } from './AuthProvider';
import type { AuthRequest } from '../shared/returntarget/ReturnTarget';

export function AuthFlow() {
  const { request, selectTarget } = useAuth();
  const client = authentication;
  const [method, setMethod] = useState<AuthMethod>('password');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fields, setFields] = useState<Readonly<Record<string, string>>>({});
  const [outcome, setOutcome] = useState<AuthenticationOutcome | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [providers, setProviders] = useState<readonly ProviderChoice[]>([]);
  const [terms, setTerms] = useState<'terms' | 'privacy' | null>(null);
  const [reset, setReset] = useState(false);
  const returns = useMemo(() => returnRequest(request), [request]);

  useEffect(() => {
    const controller = new AbortController();
    void client
      .providers(returns, request.target, controller.signal)
      .then(setProviders)
      .catch(() => setProviders([]));
    return () => controller.abort();
  }, [client, request.target, returns]);

  const stage = outcome?.kind === 'selection' || outcome?.kind === 'proofRequired' ? outcome.kind : null;
  const changeMethod = (next: AuthMethod) => {
    setMethod(next);
    setError('');
    setNotice('');
    setFields({});
    setOutcome(null);
  };
  const changeTarget = (target: typeof request.target) => {
    if (target === request.target) return;
    selectTarget(target);
    setError('');
    setNotice('');
    setFields({});
    setOutcome(null);
    setEnrollment(null);
    setProviders([]);
  };
  const validateTerms = () => {
    if (accepted) return true;
    setError('请先阅读并勾选《用户协议》和《隐私政策》');
    return false;
  };
  const run = async (operation: () => Promise<AuthenticationOutcome>, invitation = false) => {
    if (!validateTerms()) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await route(await operation());
    } catch (cause) {
      setError(invitation ? '邀请码无效、已过期或暂不可用，请核对后重试' : message(cause, '认证失败'));
    } finally {
      setBusy(false);
    }
  };
  const route = async (result: AuthenticationOutcome) => {
    if (result.kind === 'authenticated') {
      window.location.replace(result.redirectUrl);
      return;
    }
    if (result.kind === 'proofRequired' && result.method === 'sso') {
      window.location.assign(result.reference);
      return;
    }
    if (result.kind === 'enrollment') {
      const value = await client.enrollment(result.id);
      setEnrollment(value);
      setOutcome(result);
      return;
    }
    if (result.kind === 'enrolled') {
      setOutcome(null);
      setEnrollment(null);
      setNotice('员工商城账号已创建，请使用新账号登录。');
      return;
    }
    setOutcome(result);
  };
  const password = (subject: string, value: string) => {
    const next: Record<string, string> = {};
    if (!subject.trim()) next.subject = '请输入登录账号或已绑定手机号';
    if (!value) next.password = '请输入密码';
    setFields(next);
    if (Object.keys(next).length > 0) return;
    void run(() => client.password(subject, value, request.target, returns));
  };
  const otp = (subject: string, challenge: string, code: string) => {
    const next: Record<string, string> = {};
    if (!subject.trim()) next.subject = '请输入登录账号或已绑定手机号';
    if (!challenge || !/^\d{6}$/.test(code)) next.code = challenge ? '请输入 6 位短信验证码' : '请先为当前账号获取验证码';
    setFields(next);
    if (Object.keys(next).length > 0) return;
    void run(() => client.otp(subject, challenge, code, request.target, returns));
  };
  const challenge = async (subject: string) => {
    if (!subject.trim()) {
      setFields({ subject: '请输入登录账号或已绑定手机号' });
      throw new Error('LOGIN_SUBJECT_REQUIRED');
    }
    setBusy(true);
    setError('');
    try {
      const value = await client.challenge(subject, 'login', request.target, returns);
      setNotice(challengeNotice(true));
      return Object.freeze({ id: value.id, resendSeconds: OTP_POLICY.resendSeconds });
    } catch (cause) {
      setError(message(cause, '验证码发送失败'));
      throw cause;
    } finally {
      setBusy(false);
    }
  };
  const invitationProof = async (code: string) => {
    if (outcome?.kind !== 'proofRequired') return;
    if (!/^\d{6}$/.test(code)) {
      setError('请输入 6 位短信验证码');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await route(await client.invitationProof(outcome.reference, code, outcome.target, returns));
    } catch {
      setError('验证失败或已过期，请重新使用邀请码登录');
    } finally {
      setBusy(false);
    }
  };
  const completeEnrollment = async (input: Readonly<{ subject: string; challenge: string; code: string; password: string; displayName: string }>) => {
    if (!enrollment) return;
    await route(await client.completeEnrollment({ ...input, id: enrollment.id, termsHash: enrollment.policy.termsHash }));
  };
  const selectMembership = (membership: MembershipChoice) => {
    if (outcome?.kind !== 'selection') return;
    setBusy(true);
    setError('');
    void client
      .selectMembership(membership.id, membership.target)
      .then(route)
      .catch((cause) => setError(message(cause, '身份选择失败')))
      .finally(() => setBusy(false));
  };

  const stageContent =
    outcome?.kind === 'selection' ? (
      <MembershipSelection memberships={outcome.memberships} busy={busy} onSelect={selectMembership} />
    ) : outcome?.kind === 'proofRequired' ? (
      <InvitationProof busy={busy} method={outcome.method} onSubmit={invitationProof} />
    ) : null;
  const alert = method === 'invitation' && error ? <InvitationError message={error} /> : undefined;

  return (
    <>
      <LoginPage
        target={request.target}
        method={method}
        accepted={accepted}
        busy={busy}
        error={error}
        notice={notice}
        fields={fields}
        providers={providers}
        stage={stage}
        stageContent={stageContent}
        alert={alert}
        onMethod={changeMethod}
        onTarget={changeTarget}
        onAccepted={setAccepted}
        onPassword={password}
        onOtp={otp}
        onChallenge={challenge}
        onInvitation={(code) => run(() => client.invitation(code, request.target, returns), true)}
        onProvider={(provider) => {
          void run(() => client.provider(provider.id, request.target, returns));
        }}
        onBack={() => {
          setOutcome(null);
          setError('');
        }}
        onReset={() => setReset(true)}
        onTerms={setTerms}
      />
      {enrollment && (
        <EnrollmentPage
          client={client}
          enrollment={enrollment}
          onComplete={completeEnrollment}
          onClose={() => {
            setEnrollment(null);
            setOutcome(null);
          }}
        />
      )}
      {reset && (
        <PasswordResetDialog
          client={client}
          onClose={() => setReset(false)}
          onComplete={() => {
            setReset(false);
            setNotice('密码已重置，所有旧会话已撤销，请使用新密码登录。');
          }}
        />
      )}
      {terms && (
        <TermsDialog
          kind={terms}
          onClose={() => setTerms(null)}
          onAccept={() => {
            setAccepted(true);
            setTerms(null);
          }}
        />
      )}
    </>
  );
}

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function returnRequest(request: AuthRequest) {
  return Object.freeze({ ...(request.returnTarget ? { returnTarget: request.returnTarget } : {}), ...(request.returnPath ? { returnPath: request.returnPath } : {}) });
}
