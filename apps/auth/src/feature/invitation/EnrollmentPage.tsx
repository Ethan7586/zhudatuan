import { CheckCircle2, FileText, RefreshCw, UserCheck, X } from 'lucide-react';
import { useState } from 'react';
import type { EnrollmentState } from '../../entity/authentication/AuthenticationState';
import type { AuthClient } from '../../entity/authentication/AuthClient';
import { challengeNotice } from '../../shared/challenge/ChallengePolicy';
import { useChallengeCooldown } from '../../shared/challenge/useChallengeCooldown';

interface EnrollmentForm {
  readonly displayName: string;
  readonly mobile: string;
  readonly code: string;
  readonly password: string;
  readonly confirm: string;
}
const EMPTY: EnrollmentForm = Object.freeze({ displayName: '', mobile: '', code: '', password: '', confirm: '' });

export function EnrollmentPage({
  client,
  enrollment,
  onComplete,
  onClose,
}: Readonly<{
  client: AuthClient;
  enrollment: EnrollmentState;
  onComplete: (input: Readonly<{ subject: string; challenge: string; code: string; password: string; displayName: string }>) => Promise<void>;
  onClose: () => void;
}>) {
  const [form, setForm] = useState<EnrollmentForm>(EMPTY);
  const [challenge, setChallenge] = useState('');
  const [challengeMobile, setChallengeMobile] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [policy, setPolicy] = useState<'terms' | 'privacy' | null>(null);
  const [busy, setBusy] = useState<'code' | 'submit' | null>(null);
  const cooldown = useChallengeCooldown();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const update = (key: keyof EnrollmentForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'mobile') {
      setChallenge('');
      setChallengeMobile('');
      cooldown.clear();
    }
    setError('');
  };
  const send = async () => {
    if (!/^\+?\d{8,15}$/.test(form.mobile.trim())) return setError('请输入有效的手机号');
    setBusy('code');
    setError('');
    try {
      const result = await client.challenge(form.mobile, 'enrollment');
      setChallenge(result.id);
      setChallengeMobile(form.mobile.trim());
      cooldown.start();
      setNotice(challengeNotice());
    } catch (cause) {
      setError(message(cause, '验证码发送失败'));
    } finally {
      setBusy(null);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challenge || challengeMobile !== form.mobile.trim()) return setError('请为当前手机号重新获取验证码');
    if (!/^\d{6}$/.test(form.code)) return setError('请输入 6 位短信验证码');
    if (!accepted) return setError('请先阅读并同意本次邀请绑定的服务协议与隐私政策');
    if (!strong(form.password)) return setError('密码须为 12–128 位，并同时包含大小写字母、数字和符号');
    if (form.password !== form.confirm) return setError('两次输入的密码不一致');
    setBusy('submit');
    setError('');
    try {
      await onComplete({ subject: form.mobile, challenge, code: form.code, password: form.password, displayName: form.displayName });
    } catch (cause) {
      setError(message(cause, '注册失败'));
    } finally {
      setBusy(null);
      setForm(EMPTY);
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="enrollment-title">
      <form onSubmit={(event) => void submit(event)} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sw-brand)]">Member Registration</p>
            <h3 id="enrollment-title" className="mt-1 text-2xl font-bold text-slate-950">
              注册员工会员
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">手机号验证后建立普通员工会员；管理员与 Owner 不开放自助注册。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="关闭注册">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="姓名">
            <input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} maxLength={60} required placeholder="请输入真实姓名" className={inputClass} />
          </Field>
          <div className="space-y-1.5 text-xs font-medium text-slate-700">
            <span className="flex items-center justify-between">
              企业邀请
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                已验证
              </span>
            </span>
            <div className={`${inputClass} bg-slate-50 text-slate-500`}>有效至 {new Date(enrollment.expiresAt).toLocaleString()}</div>
          </div>
          <Field label="登录手机号" wide>
            <input value={form.mobile} onChange={(event) => update('mobile', event.target.value)} inputMode="tel" autoComplete="tel" required placeholder="用于登录、验证与找回密码" className={inputClass} />
          </Field>
          <Field label="手机验证码" wide>
            <span className="flex gap-2">
              <input
                value={form.code}
                onChange={(event) => update('code', event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="输入 6 位验证码"
                className={`${inputClass} min-w-0 flex-1 tracking-[0.22em]`}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy !== null || cooldown.seconds > 0}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-[var(--sw-brand)] disabled:bg-slate-100 disabled:text-slate-400"
              >
                {busy === 'code' ? '发送中…' : cooldown.seconds > 0 ? `${cooldown.seconds}s 后重发` : '获取验证码'}
              </button>
            </span>
          </Field>
          <Field label="设置密码">
            <input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} autoComplete="new-password" required placeholder="12位以上，含大小写、数字和符号" className={inputClass} />
          </Field>
          <Field label="确认密码">
            <input type="password" value={form.confirm} onChange={(event) => update('confirm', event.target.value)} autoComplete="new-password" required placeholder="再次输入密码" className={inputClass} />
          </Field>
        </div>
        {notice && (
          <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
            {error}
          </p>
        )}
        <label className="mt-5 flex cursor-pointer items-start gap-2 text-xs leading-5 text-slate-500">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 accent-[var(--sw-brand)]" />
          <span>
            我已阅读并同意
            <button type="button" onClick={() => setPolicy('terms')} className="text-[var(--sw-brand)] hover:underline">
              《用户服务协议》
            </button>
            和
            <button type="button" onClick={() => setPolicy('privacy')} className="text-[var(--sw-brand)] hover:underline">
              《隐私保护政策》
            </button>
            ，并确认使用本人手机号注册。
          </span>
        </label>
        <button
          type="submit"
          disabled={busy !== null || !challenge || !accepted}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/15 disabled:bg-slate-300"
        >
          {busy === 'submit' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}创建普通员工会员账号
        </button>
        <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">密码和验证码不会写入浏览器长期存储。自助注册只开通消费商城，后台权限须由管理员另行授予。</p>
      </form>
      {policy && <PolicyDialog enrollment={enrollment} kind={policy} onClose={() => setPolicy(null)} />}
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--sw-brand)]';
function Field({ label, wide = false, children }: React.PropsWithChildren<{ label: string; wide?: boolean }>) {
  return (
    <label className={`space-y-1.5 text-xs font-medium text-slate-700 ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      {children}
    </label>
  );
}
function strong(value: string) {
  return value.length >= 12 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}
function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}
function PolicyDialog({ enrollment, kind, onClose }: Readonly<{ enrollment: EnrollmentState; kind: 'terms' | 'privacy'; onClose: () => void }>) {
  const selected = kind === 'terms' ? [enrollment.policy.termsTitle, enrollment.policy.termsBody] : [enrollment.policy.privacyTitle, enrollment.policy.privacyBody];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="flex items-center gap-2 text-base font-bold text-slate-900">
            <FileText className="h-5 w-5 text-[var(--sw-brand)]" />
            {selected[0]}
          </span>
          <button type="button" onClick={onClose} aria-label="关闭注册条款">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto whitespace-pre-wrap pr-2 text-xs leading-6 text-slate-600">{selected[1]}</div>
        <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl bg-[var(--sw-brand)] px-5 py-2 text-xs font-semibold text-white">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
