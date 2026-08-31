import { ArrowRight, Lock, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { clearSecretInput, SecretState } from '../../shared/security/SecretState';

export function InvitationProof({
  busy,
  method,
  onSubmit,
}: Readonly<{
  busy: boolean;
  method: 'otp' | 'sso';
  onSubmit: (code: string) => Promise<void>;
}>) {
  const input = useRef<HTMLInputElement>(null);
  const secret = useMemo(() => new SecretState(), []);
  useEffect(() => {
    const element = input.current;
    element?.focus();
    return () => clearSecretInput(element, secret);
  }, [secret]);
  if (method === 'sso') return <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-700">正在跳转到企业身份提供方完成验证…</p>;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = secret.take();
    try {
      await onSubmit(code);
    } finally {
      clearSecretInput(input.current, secret);
      requestAnimationFrame(() => input.current?.focus());
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <label className="block space-y-1.5 text-xs font-medium text-slate-700">
        <span className="flex items-center gap-1">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          短信验证码
        </span>
        <input
          ref={input}
          onChange={(event) => secret.set(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="输入 6 位验证码"
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm tracking-[0.22em] outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
          disabled={busy}
        />
      </label>
      <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-medium text-white disabled:bg-slate-300">
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {busy ? '验证中...' : '完成安全验证'}
      </button>
    </form>
  );
}
