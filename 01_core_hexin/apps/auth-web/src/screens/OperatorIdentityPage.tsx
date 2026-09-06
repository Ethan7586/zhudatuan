import React, { useEffect, useState } from 'react';
import { AlertCircle, Building2, Eye, EyeOff, FileText, KeyRound, LoaderCircle, LogIn, Send, UserPlus, X } from 'lucide-react';
import type { Membership } from '../types';
import {
  createCanonicalPasswordResetChallenge,
  loginCanonicalConsole,
  resetCanonicalPassword,
} from '../services/canonicalIdentity';
import {
  createCanonicalMember,
  createCanonicalRegistrationChallenge,
  resolveCanonicalInvite,
  type CanonicalInvitation,
} from '../services/canonicalRegistration';
import { isHongtaiConsoleEntry } from '../services/consumerIdentityEntry';

type PageMode = 'login' | 'register' | 'reset';

export const OperatorIdentityPage: React.FC = () => {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  const params = new URLSearchParams(search);
  const tenantConsole = isHongtaiConsoleEntry(search);
  const initialInvite = params.get('invite')?.trim().toUpperCase() ?? '';
  const [mode, setMode] = useState<PageMode>(initialInvite ? 'register' : 'login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [memberships, setMemberships] = useState<readonly Membership[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInvite);
  const [invite, setInvite] = useState<CanonicalInvitation | null>(null);
  const [resolvedInviteCode, setResolvedInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [registrationChallenge, setRegistrationChallenge] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [policy, setPolicy] = useState<'terms' | 'privacy' | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [resetChallenge, setResetChallenge] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');

  useEffect(() => {
    if (!initialInvite) return;
    void loadInvite(initialInvite);
  }, []);

  const changeMode = (next: PageMode) => {
    setMode(next);
    setError('');
    setNotice('');
    setMemberships([]);
  };

  const consoleOptions = () => tenantConsole
    ? {
        target: 'console-hbbtzn' as const,
        expectedOrigin: params.get('admin_origin')?.trim() || 'https://console.hbbtzn.com',
      }
    : { target: 'console' as const };

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await authorize();
  };

  const authorize = async (membership?: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await loginCanonicalConsole(identifier, password, membership, undefined, consoleOptions());
      if (result.kind === 'authenticated') return window.location.assign(result.redirectUrl);
      if (result.context.memberships.length === 0) throw new Error('该账号没有可用的运营会员身份');
      setMemberships(result.context.memberships);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  const loadInvite = async (value = inviteCode) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const normalized = value.trim().toUpperCase();
      const resolved = await resolveCanonicalInvite(normalized);
      setInvite(resolved);
      setInviteCode(normalized);
      setResolvedInviteCode(normalized);
      setAcceptedTerms(false);
      setRegistrationChallenge('');
      setNotice(`邀请码已确认：${resolved.organizationName}`);
      return resolved;
    } catch (reason) {
      setInvite(null);
      setResolvedInviteCode('');
      setError(messageOf(reason));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const sendRegistrationCode = async () => {
    setBusy(true);
    setError('');
    try {
      const normalized = inviteCode.trim().toUpperCase();
      const resolved = invite !== null && resolvedInviteCode === normalized ? invite : await resolveCanonicalInvite(normalized);
      setInvite(resolved);
      setResolvedInviteCode(normalized);
      const challenge = await createCanonicalRegistrationChallenge(identifier, normalized);
      setRegistrationChallenge(challenge.challengeId);
      setNotice('验证码已经发送，请填写最新收到的 6 位验证码');
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  const register = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invite === null || resolvedInviteCode !== inviteCode.trim().toUpperCase()) return setError('请先验证当前邀请码');
    if (!registrationChallenge) return setError('请先获取验证码');
    if (password !== confirmPassword) return setError('两次输入的密码不一致');
    if (!acceptedTerms) return setError('请先阅读并同意服务协议与隐私政策');
    setBusy(true);
    setError('');
    try {
      const created = await createCanonicalMember({
        subject: identifier,
        password,
        displayName,
        inviteCode,
        challengeId: registrationChallenge,
        code: registrationCode,
        termsAccepted: true,
        termsHash: invite.termsHash,
        directLogin: invite.target === 'storefront',
      });
      if (created.redirectUrl) return window.location.assign(created.redirectUrl);
      setPassword('');
      setConfirmPassword('');
      setNotice('账号已经创建，请使用手机号和刚才设置的密码登录');
      setMode('login');
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  const sendResetCode = async () => {
    setBusy(true);
    setError('');
    try {
      const challenge = await createCanonicalPasswordResetChallenge(identifier);
      setResetChallenge(challenge.challengeId);
      setNotice('验证码已经发送，请填写最新收到的 6 位验证码');
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetChallenge) return setError('请先获取验证码');
    if (password !== resetConfirm) return setError('两次输入的密码不一致');
    setBusy(true);
    setError('');
    try {
      await resetCanonicalPassword(resetChallenge, resetCode, password);
      setPassword('');
      setResetConfirm('');
      setNotice('密码已重置，请使用新密码登录');
      setMode('login');
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };

  const productName = tenantConsole ? '宏泰甄选运营后台' : '主打团平台';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-8">
      <section className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl shadow-slate-900/10">
        <header className="bg-gradient-to-br from-[var(--sw-brand)] to-[var(--sw-brand-dark)] p-7 text-white sm:p-9">
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}brand/brand-mark.svg`} alt="" className="h-12 w-12 rounded-2xl shadow-md" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Unified Identity</p>
              <h1 className="mt-1 text-2xl font-black">{productName}</h1>
            </div>
          </div>
          <p className="mt-5 text-sm leading-6 text-blue-100">统一账号、统一会话；登录后按会员身份进入对应工作台。</p>
        </header>

        <div className="p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <ModeButton active={mode === 'login'} onClick={() => changeMode('login')}>登录</ModeButton>
            <ModeButton active={mode === 'register'} onClick={() => changeMode('register')}>邀请注册</ModeButton>
            <ModeButton active={mode === 'reset'} onClick={() => changeMode('reset')}>找回密码</ModeButton>
          </div>

          {error && <Message tone="error">{error}</Message>}
          {notice && <Message tone="notice">{notice}</Message>}

          {mode === 'login' && memberships.length === 0 && (
            <form onSubmit={signIn} className="space-y-4">
              <TextField label="手机号或账号" value={identifier} onChange={setIdentifier} autoComplete="username" />
              <PasswordField label="密码" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="current-password" />
              <SubmitButton busy={busy} icon={<LogIn className="h-4 w-4" />}>登录并进入后台</SubmitButton>
            </form>
          )}

          {mode === 'login' && memberships.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-900">选择本次进入的会员身份</p>
              {memberships.map((membership) => (
                <button key={membership.id} type="button" disabled={busy} onClick={() => void authorize(membership.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50">
                  <Building2 className="h-5 w-5 text-[var(--sw-brand)]" />
                  <span><strong className="block text-sm text-slate-900">{membership.enterpriseName}</strong><span className="text-xs text-slate-500">{membership.roleName}</span></span>
                </button>
              ))}
              <button type="button" onClick={() => setMemberships([])} className="w-full text-center text-xs text-slate-500 hover:text-slate-800">返回重新登录</button>
            </div>
          )}

          {mode === 'register' && (
            <form onSubmit={register} className="space-y-4">
              <div className="flex gap-2">
                <input required value={inviteCode} onChange={(event) => { setInviteCode(event.target.value.toUpperCase()); setInvite(null); }} placeholder="企业邀请码" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-3 text-sm uppercase outline-none focus:ring-2 focus:ring-blue-100" />
                <button type="button" disabled={busy || !inviteCode.trim()} onClick={() => void loadInvite()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-[var(--sw-brand)] disabled:opacity-50">验证邀请码</button>
              </div>
              <TextField label="姓名" value={displayName} onChange={setDisplayName} autoComplete="name" />
              <TextField label="手机号" value={identifier} onChange={setIdentifier} autoComplete="tel" inputMode="tel" />
              <div className="flex gap-2">
                <input required inputMode="numeric" maxLength={6} value={registrationCode} onChange={(event) => setRegistrationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 位验证码" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                <button type="button" disabled={busy || !identifier.trim() || !inviteCode.trim()} onClick={() => void sendRegistrationCode()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-[var(--sw-brand)] disabled:opacity-50"><Send className="mr-1 inline h-3.5 w-3.5" />获取验证码</button>
              </div>
              <PasswordField label="设置密码" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
              <PasswordField label="确认密码" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
              <label className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} disabled={invite === null} className="mt-0.5 h-4 w-4 accent-[var(--sw-brand)]" />
                <span>我已阅读并同意<button type="button" disabled={invite === null} onClick={() => setPolicy('terms')} className="text-[var(--sw-brand)] disabled:text-slate-400">《用户服务协议》</button>和<button type="button" disabled={invite === null} onClick={() => setPolicy('privacy')} className="text-[var(--sw-brand)] disabled:text-slate-400">《隐私保护政策》</button></span>
              </label>
              <SubmitButton busy={busy} disabled={invite === null || !acceptedTerms} icon={<UserPlus className="h-4 w-4" />}>创建统一账号</SubmitButton>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={resetPassword} className="space-y-4">
              <TextField label="绑定手机号" value={identifier} onChange={setIdentifier} autoComplete="tel" inputMode="tel" />
              <div className="flex gap-2">
                <input required inputMode="numeric" maxLength={6} value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 位验证码" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                <button type="button" disabled={busy || !identifier.trim()} onClick={() => void sendResetCode()} className="rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-[var(--sw-brand)] disabled:opacity-50"><KeyRound className="mr-1 inline h-3.5 w-3.5" />获取验证码</button>
              </div>
              <PasswordField label="新密码" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
              <PasswordField label="确认新密码" value={resetConfirm} onChange={setResetConfirm} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} autoComplete="new-password" />
              <SubmitButton busy={busy} icon={<KeyRound className="h-4 w-4" />}>重置密码</SubmitButton>
            </form>
          )}
        </div>
      </section>

      {policy !== null && invite !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[82vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 font-bold"><FileText className="h-5 w-5 text-[var(--sw-brand)]" />{policy === 'terms' ? invite.termsTitle : invite.privacyTitle}</h3>
              <button type="button" onClick={() => setPolicy(null)} aria-label="关闭" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-slate-600">{policy === 'terms' ? invite.termsBody : invite.privacyBody}</div>
          </div>
        </div>
      )}
    </main>
  );
};

const ModeButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`rounded-lg px-2 py-2.5 transition ${active ? 'bg-white text-[var(--sw-brand)] shadow-sm' : 'text-slate-500'}`}>{children}</button>
);

const TextField: React.FC<{ label: string; value: string; onChange: (value: string) => void; autoComplete: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }> = ({ label, value, onChange, autoComplete, inputMode }) => (
  <label className="block space-y-1.5 text-xs font-semibold text-slate-700">{label}<input required value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} inputMode={inputMode} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-[var(--sw-brand)] focus:ring-2 focus:ring-blue-100" /></label>
);

const PasswordField: React.FC<{ label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; autoComplete: string }> = ({ label, value, onChange, visible, onToggle, autoComplete }) => (
  <label className="block space-y-1.5 text-xs font-semibold text-slate-700">{label}<span className="relative block"><input type={visible ? 'text' : 'password'} required minLength={12} maxLength={128} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 pr-11 text-sm outline-none focus:border-[var(--sw-brand)] focus:ring-2 focus:ring-blue-100" /><button type="button" onClick={onToggle} aria-label={visible ? '隐藏密码' : '显示密码'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400">{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
);

const SubmitButton: React.FC<{ busy: boolean; disabled?: boolean; icon: React.ReactNode; children: React.ReactNode }> = ({ busy, disabled, icon, children }) => (
  <button type="submit" disabled={busy || disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}{busy ? '处理中…' : children}</button>
);

const Message: React.FC<{ tone: 'error' | 'notice'; children: React.ReactNode }> = ({ tone, children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-5 flex items-start gap-2 rounded-xl border p-3 text-xs leading-5 ${tone === 'error' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>
);

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : '统一身份服务暂时不可用，请稍后重试';
}
