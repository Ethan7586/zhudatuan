import { ArrowRight, KeyRound, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { clearSecretInput, SecretState } from '../../shared/security/SecretState';

export function InvitationForm({
  busy,
  accepted,
  onSubmit,
}: Readonly<{
  busy: boolean;
  accepted: boolean;
  onSubmit: (code: string) => Promise<void>;
}>) {
  const input = useRef<HTMLInputElement>(null);
  const secret = useMemo(() => new SecretState(), []);
  useEffect(() => () => clearSecretInput(input.current, secret), [secret]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = secret.take().trim();
    try {
      await onSubmit(code);
    } finally {
      clearSecretInput(input.current, secret);
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <label className="block space-y-1.5 text-xs font-medium text-slate-700">
        <span className="flex items-center gap-1">
          <KeyRound className="h-3.5 w-3.5 text-slate-400" />
          企业邀请码
        </span>
        <input
          ref={input}
          onChange={(event) => secret.set(event.currentTarget.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          placeholder="粘贴企业福利管理员提供的邀请码"
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm transition-all focus:border-[var(--sw-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
          disabled={busy}
          aria-describedby="invitation-hint"
        />
      </label>
      <p id="invitation-hint" className="text-[11px] leading-5 text-slate-400">
        邀请码仅用于本次验证，不会写入网址、浏览器存储或分析数据。
      </p>
      <button
        type="submit"
        disabled={!accepted || busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-medium text-white shadow-md shadow-blue-500/10 transition-all hover:bg-[var(--sw-brand-dark)] disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {busy ? '验证中...' : '使用邀请码登录'}
      </button>
    </form>
  );
}
