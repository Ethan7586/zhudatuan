import React, { useEffect, useState } from 'react';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_HINT, PASSWORD_POLICY_MESSAGE, passwordMeetsPolicy } from '@shop/contract/password-policy';
import { AlertCircle, Eye, EyeOff, FileText, LoaderCircle, LogIn, ShieldCheck, UserPlus, X } from 'lucide-react';
import { automaticL6DisplayName } from '../services/consumerRegistration';
import { loginCanonicalStorefrontEntry } from '../services/canonicalIdentity';
import {
  createCanonicalMember,
  resolveCanonicalStorefrontRegistration,
  type CanonicalStorefrontRegistration,
} from '../services/canonicalRegistration';

type IdentityMode = 'login' | 'register';

export const ConsumerIdentityPage: React.FC<{ application: string }> = ({ application }) => {
  const [mode, setMode] = useState<IdentityMode>('login');
  const [context, setContext] = useState<CanonicalStorefrontRegistration | null>(null);
  const [contextError, setContextError] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [policy, setPolicy] = useState<'terms' | 'privacy' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setContext(null);
    setContextError('');
    void resolveCanonicalStorefrontRegistration(application, controller.signal)
      .then((resolved) => {
        setContext(resolved);
        document.title = `${resolved.organizationName}登录`;
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setContextError(messageOf(error));
      });
    return () => controller.abort();
  }, [application]);

  const switchMode = (next: IdentityMode) => {
    setMode(next);
    setFormError('');
    setConfirmPassword('');
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const result = await loginCanonicalStorefrontEntry(mobile, password, application);
      window.location.assign(result.redirectUrl);
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (context === null) return setFormError(contextError || '商城注册入口正在读取，请稍后重试');
    if (!passwordMeetsPolicy(password)) return setFormError(PASSWORD_POLICY_MESSAGE);
    if (password !== confirmPassword) return setFormError('两次输入的密码不一致');
    if (!acceptedTerms) return setFormError('请先阅读并同意服务协议与隐私政策');
    setSubmitting(true);
    setFormError('');
    try {
      const created = await createCanonicalMember({
        subject: mobile,
        password,
        displayName: automaticL6DisplayName(mobile),
        applicationSlug: context.applicationSlug,
        deferPhoneVerification: true,
        termsAccepted: true,
        termsHash: context.termsHash,
        directLogin: true,
      });
      if (!created.redirectUrl) throw new Error('账号已创建，但登录会话未能建立，请直接登录');
      window.location.assign(created.redirectUrl);
    } catch (error) {
      setFormError(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  };

  const organizationName = context?.organizationName ?? '宏泰甄选';
  const busyLabel = mode === 'login' ? '正在登录…' : '正在创建账号…';

  return (
    <main className="flex min-h-screen items-center justify-center overflow-x-hidden bg-slate-50 p-4 sm:p-8">
      <section className="relative w-full max-w-[940px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--sw-brand)] to-[var(--sw-brand-dark)] shadow-2xl lg:grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden min-h-[610px] flex-col justify-between overflow-hidden p-10 text-white lg:flex">
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}brand/brand-mark.svg`} alt="" className="h-12 w-12 rounded-2xl shadow-md" />
            <div>
              <p className="text-2xl font-black tracking-tight">{organizationName}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-200">Hongtai Select</p>
            </div>
          </div>
          <div className="relative">
            <h1 className="text-5xl font-black leading-[1.08] tracking-tight">一个账号<br />直接进入商城</h1>
            <p className="mt-5 max-w-[280px] text-sm leading-7 text-blue-100">登录与注册统一由身份中心完成。注册时建立账号，首次付款时再验证手机号。</p>
          </div>
          <div className="relative border-t border-white/20 pt-5 text-xs text-blue-100">技术服务方 · 雍彻科技</div>
        </div>

        <div className="m-3 rounded-[1.6rem] bg-white p-6 shadow-xl sm:m-5 sm:p-9 lg:m-6 lg:flex lg:flex-col lg:justify-center">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-[var(--sw-brand)]">
                <ShieldCheck className="h-4 w-4" /> 统一身份中心
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{organizationName}</h2>
              <p className="mt-1 text-sm text-slate-500">手机号与密码只建立一套商城身份</p>
            </div>
            <img src={`${import.meta.env.BASE_URL}brand/brand-mark.svg`} alt="" className="h-11 w-11 rounded-xl lg:hidden" />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm" role="tablist" aria-label="登录或注册">
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')} className={`rounded-lg px-3 py-2.5 font-semibold transition ${mode === 'login' ? 'bg-white text-[var(--sw-brand)] shadow-sm' : 'text-slate-500'}`}>已有账号登录</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')} className={`rounded-lg px-3 py-2.5 font-semibold transition ${mode === 'register' ? 'bg-white text-[var(--sw-brand)] shadow-sm' : 'text-slate-500'}`}>新用户注册</button>
          </div>

          {(contextError || formError) && (
            <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError || contextError}</span>
            </div>
          )}

          <form onSubmit={mode === 'login' ? submitLogin : submitRegistration} className="space-y-4">
            <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
              {mode === 'register' ? '登录手机号（付款时验证）' : '登录手机号'}
              <input type="tel" inputMode="tel" autoComplete="tel" required value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="请输入 11 位手机号" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-[var(--sw-brand)] focus:ring-2 focus:ring-blue-100" />
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
              {mode === 'register' ? '设置密码' : '密码'}
              <span className="relative block">
                <input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? PASSWORD_MIN_LENGTH : undefined} maxLength={PASSWORD_MAX_LENGTH} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? PASSWORD_POLICY_HINT : '请输入密码'} className="w-full rounded-xl border border-slate-200 px-3.5 py-3 pr-11 text-sm outline-none transition focus:border-[var(--sw-brand)] focus:ring-2 focus:ring-blue-100" />
                <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? '隐藏密码' : '显示密码'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </span>
            </label>

            {mode === 'register' && (
              <>
                <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                  确认密码
                  <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition focus:border-[var(--sw-brand)] focus:ring-2 focus:ring-blue-100" />
                </label>
                <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">本步不发送验证码；首次付款时验证该手机号。</p>
                <label className="flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-500">
                  <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} disabled={context === null} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[var(--sw-brand)]" />
                  <span>我已阅读并同意<button type="button" disabled={context === null} onClick={() => setPolicy('terms')} className="text-[var(--sw-brand)] hover:underline disabled:text-slate-400">《用户服务协议》</button>和<button type="button" disabled={context === null} onClick={() => setPolicy('privacy')} className="text-[var(--sw-brand)] hover:underline disabled:text-slate-400">《隐私保护政策》</button></span>
                </label>
              </>
            )}

            <button type="submit" disabled={submitting || (mode === 'register' && (context === null || !acceptedTerms))} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/15 transition hover:bg-[var(--sw-brand-dark)] disabled:cursor-not-allowed disabled:bg-slate-300">
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {submitting ? busyLabel : mode === 'login' ? '登录并进入商城' : '创建账号并进入商城'}
            </button>
          </form>
        </div>
      </section>

      {policy !== null && context !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[82vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 font-bold text-slate-900"><FileText className="h-5 w-5 text-[var(--sw-brand)]" />{policy === 'terms' ? context.termsTitle : context.privacyTitle}</h3>
              <button type="button" onClick={() => setPolicy(null)} aria-label="关闭" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto whitespace-pre-wrap pr-2 text-xs leading-6 text-slate-600">{policy === 'terms' ? context.termsBody : context.privacyBody}</div>
            <button type="button" onClick={() => setPolicy(null)} className="mt-5 self-end rounded-xl bg-[var(--sw-brand)] px-5 py-2 text-xs font-semibold text-white">关闭</button>
          </div>
        </div>
      )}
    </main>
  );
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : '统一身份服务暂时不可用，请稍后重试';
}
