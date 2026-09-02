import { Button } from '@shop/design';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import {
  bindMallEnrollmentMobile,
  mallEnrollmentError,
  requestMallEnrollmentCode,
  verifyMallEnrollmentPassword,
  type MallMobileChallenge,
} from './MallCreateCommand';

type EnrollmentStage = 'password' | 'mobile' | 'code' | 'binding' | 'relogin';

export function MallMobileEnrollment({ context, onRelogin }: Readonly<{
  context: ConsoleContext;
  onRelogin: () => void;
}>) {
  const [stage, setStage] = useState<EnrollmentStage>('password');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<MallMobileChallenge>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const verifyPassword = async () => {
    if (password.length === 0 || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await verifyMallEnrollmentPassword(context, password);
      setPassword('');
      setStage('mobile');
    } catch (cause) {
      setPassword('');
      setError(mallEnrollmentError(cause));
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async () => {
    if (!mainlandMobileValid(mobile) || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      setChallenge(await requestMallEnrollmentCode(context, mobile));
      setCode('');
      setStage('code');
    } catch (cause) {
      setError(mallEnrollmentError(cause));
    } finally {
      setBusy(false);
    }
  };

  const bindMobile = async () => {
    if (challenge === undefined || !/^\d{6}$/.test(code) || busy) return;
    setBusy(true);
    setError(undefined);
    setStage('binding');
    try {
      await bindMallEnrollmentMobile(context, mobile, challenge.id, code);
      setCode('');
      setMobile('');
      setStage('relogin');
    } catch (cause) {
      setCode('');
      setStage('code');
      setError(mallEnrollmentError(cause));
    } finally {
      setBusy(false);
    }
  };

  return <section className="command" aria-labelledby="mallmobileheading">
    <div>
      <p className="muted">首次开店身份确认</p>
      <h3 id="mallmobileheading">先绑定安全手机号</h3>
    </div>
    <p className="commandhint">当前账号尚未绑定手机号。请先验证当前密码，再验证本人手机号；绑定完成后重新登录即可继续创建商城。</p>
    {error === undefined ? null : <p className="notice" role="alert">{error}</p>}
    {stage === 'password' ? <EnrollmentForm onSubmit={verifyPassword}>
      <label>当前账户密码
        <input type="password" autoComplete="current-password" maxLength={128} value={password} disabled={busy}
          onChange={(event) => setPassword(event.target.value)} />
      </label>
      <small className="muted">密码仅用于本次服务端验证。</small>
      <EnrollmentButton busy={busy} disabled={password.length === 0} label="验证当前密码" />
    </EnrollmentForm> : null}
    {stage === 'mobile' ? <EnrollmentForm onSubmit={requestCode}>
      <p role="status">当前密码已验证，请输入本人中国大陆手机号。</p>
      <label>中国大陆手机号
        <input type="tel" inputMode="tel" autoComplete="tel-national" maxLength={11} placeholder="例如 13800138000"
          value={mobile} disabled={busy} onChange={(event) => setMobile(mobileInput(event.target.value))} />
      </label>
      <EnrollmentButton busy={busy} disabled={!mainlandMobileValid(mobile)} label="获取绑定验证码" />
    </EnrollmentForm> : null}
    {stage === 'code' ? <EnrollmentForm onSubmit={bindMobile}>
      <p role="status">验证码已发送到 {maskMobile(mobile)}，有效期至 {formatExpiry(challenge?.expires_at)}。</p>
      <label>六位手机验证码
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
      </label>
      <EnrollmentButton busy={busy} disabled={!/^\d{6}$/.test(code)} label="验证并绑定手机号" />
    </EnrollmentForm> : null}
    {stage === 'binding' ? <p role="status">正在验证并绑定手机号…</p> : null}
    {stage === 'relogin' ? <div className="notice" role="status">
      <strong>手机号已绑定</strong>
      <p>身份凭证已经更新。请重新登录，再回到商城管理继续创建。</p>
      <Button tone="primary" onPress={onRelogin}>使用新手机号重新登录</Button>
    </div> : null}
  </section>;
}

function EnrollmentForm({ children, onSubmit }: Readonly<{
  children: ReactNode;
  onSubmit: () => void;
}>) {
  return <form className="command" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  }}>{children}</form>;
}

function EnrollmentButton({ busy, disabled, label }: Readonly<{ busy: boolean; disabled: boolean; label: string }>) {
  return <footer><Button type="submit" tone="primary" isDisabled={busy || disabled}>
    {busy ? '正在处理…' : label}
  </Button></footer>;
}

function mobileInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

function mainlandMobileValid(value: string): boolean {
  return /^1[3-9][0-9]{9}$/.test(value);
}

function maskMobile(value: string): string {
  return mainlandMobileValid(value) ? `+86 ${value.slice(0, 3)}****${value.slice(-4)}` : '当前手机号';
}

function formatExpiry(value: string | undefined): string {
  if (value === undefined) return '十分钟内';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '十分钟内' : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
