import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import type { AuthClient } from '../../entity/authentication/AuthClient';
import { challengeNotice } from '../../shared/challenge/ChallengePolicy';
import { useChallengeCooldown } from '../../shared/challenge/useChallengeCooldown';

export function PasswordResetDialog({ client, onClose, onComplete }: Readonly<{ client: AuthClient; onClose: () => void; onComplete: () => void }>) {
  const [form, setForm] = useState({ mobile: '', challenge: '', code: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const cooldown = useChallengeCooldown();
  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const value = await client.challenge({ destination: form.mobile, purpose: 'password_reset' });
      setForm((current) => ({ ...current, challenge: value.id, code: '' }));
      cooldown.start();
      setNotice(challengeNotice(true));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(form.code)) return setError('请输入 6 位验证码');
    if (form.password !== form.confirm) return setError('两次输入的密码不一致');
    setBusy(true);
    setError('');
    try {
      await client.resetPassword(form.challenge, form.code, form.password);
      onComplete();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-md space-y-4 rounded-3xl border bg-white p-7 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--sw-brand)]">Password Recovery</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">找回密码</h3>
            <p className="mt-1 text-xs text-slate-500">验证绑定手机号后重置密码，所有旧设备会立即下线。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭找回密码" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <input
          value={form.mobile}
          onChange={(event) => {
            setForm({ ...form, mobile: event.target.value, challenge: '' });
            cooldown.clear();
          }}
          autoComplete="username"
          placeholder="登录账号或已绑定手机号"
          className={style}
        />
        <div className="flex gap-2">
          <input
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.replace(/\D/g, '').slice(0, 6) })}
            autoComplete="one-time-code"
            inputMode="numeric"
            placeholder="6位验证码"
            className={`${style} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || cooldown.seconds > 0}
            className="min-w-28 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-[var(--sw-brand)] disabled:bg-slate-100 disabled:text-slate-400"
          >
            {cooldown.seconds > 0 ? `${cooldown.seconds}s 后重发` : '获取验证码'}
          </button>
        </div>
        <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" placeholder="新密码（12位以上，含大小写、数字和符号）" className={style} />
        <input type="password" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} autoComplete="new-password" placeholder="确认新密码" className={style} />
        {notice && (
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy || !form.challenge} className="authprimary flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-bold disabled:bg-slate-300">
          {busy && <RefreshCw className="h-4 w-4 animate-spin" />}重置密码并下线全部设备
        </button>
      </form>
    </div>
  );
}
const style = 'w-full rounded-xl border px-3.5 py-2.5 text-sm';
function message(cause: unknown) {
  return cause instanceof Error ? cause.message : '身份服务暂时不可用';
}
