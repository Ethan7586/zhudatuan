import { ArrowRight, Building2, Eye, EyeOff, Lock, RefreshCw, UserCheck } from 'lucide-react';
import { useState } from 'react';

export function PasswordForm({
  busy,
  accepted,
  error,
  onSubmit,
  onReset,
  onInvitation,
}: Readonly<{
  busy: boolean;
  accepted: boolean;
  error: Readonly<Record<string, string>>;
  onSubmit: (subject: string, password: string) => void;
  onReset: () => void;
  onInvitation: () => void;
}>) {
  const [subject, setSubject] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(subject, password);
      }}
      className="space-y-3"
    >
      <label className="block space-y-1.5 text-xs font-medium text-slate-700">
        <span className="flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5 text-slate-400" />
          登录账号或已绑定手机号
        </span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          autoComplete="username"
          placeholder="输入登录账号或已绑定手机号"
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm transition-all focus:border-[var(--sw-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
          disabled={busy}
        />
        {error.subject && <span className="text-[11px] text-rose-500">{error.subject}</span>}
      </label>
      <label className="block space-y-1.5 text-xs font-medium text-slate-700">
        <span className="flex items-center gap-1">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          密码
        </span>
        <span className="relative block">
          <input
            type={visible ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="请输入密码"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2 pr-10 text-sm transition-all focus:border-[var(--sw-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
            disabled={busy}
          />
          <button type="button" onClick={() => setVisible((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={visible ? '隐藏密码' : '显示密码'}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
        {error.password && <span className="text-[11px] text-rose-500">{error.password}</span>}
      </label>
      <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
        <button type="button" onClick={onReset} className="transition-colors hover:text-[var(--sw-brand)]">
          忘记密码？
        </button>
        <button
          type="button"
          onClick={onInvitation}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-950 bg-slate-950 px-4 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800"
        >
          <UserCheck className="h-4 w-4" />
          新用户注册
        </button>
      </div>
      <p className="-mt-1 text-right text-[11px] leading-4 text-slate-400">持企业邀请码创建员工商城账号</p>
      <button
        type="submit"
        disabled={!accepted || busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-medium text-white shadow-md shadow-blue-500/10 transition-all hover:bg-[var(--sw-brand-dark)] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {busy ? '验证中...' : '登录'}
      </button>
    </form>
  );
}
