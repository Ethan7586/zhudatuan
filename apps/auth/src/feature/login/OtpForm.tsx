import { ArrowRight, Lock, RefreshCw, Smartphone } from 'lucide-react';
import { useRef, useState } from 'react';
import { useChallengeCooldown } from '../../shared/challenge/useChallengeCooldown';

export function OtpForm({
  busy,
  accepted,
  error,
  onChallenge,
  onSubmit,
}: Readonly<{
  busy: boolean;
  accepted: boolean;
  error: Readonly<Record<string, string>>;
  onChallenge: (subject: string) => Promise<Readonly<{ id: string; resendSeconds: number }>>;
  onSubmit: (subject: string, challenge: string, code: string) => void;
}>) {
  const [subject, setSubject] = useState('');
  const [challenge, setChallenge] = useState('');
  const [challengeSubject, setChallengeSubject] = useState('');
  const [code, setCode] = useState('');
  const cooldown = useChallengeCooldown();
  const codeRef = useRef<HTMLInputElement>(null);
  const send = async () => {
    const result = await onChallenge(subject);
    setChallenge(result.id);
    setChallengeSubject(subject.trim());
    setCode('');
    cooldown.start(result.resendSeconds);
    requestAnimationFrame(() => codeRef.current?.focus());
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(subject, challengeSubject === subject.trim() ? challenge : '', code);
      }}
      className="space-y-3"
    >
      <label className="block space-y-1.5 text-xs font-medium text-slate-700">
        <span className="flex items-center gap-1">
          <Smartphone className="h-3.5 w-3.5 text-slate-400" />
          登录账号或已绑定手机号
        </span>
        <input
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setChallenge('');
            setCode('');
            cooldown.clear();
          }}
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
          短信验证码
        </span>
        <span className="flex gap-2">
          <input
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 位验证码"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm tracking-[0.2em] transition-all focus:border-[var(--sw-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--sw-brand)]"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || cooldown.seconds > 0}
            className="min-w-28 rounded-xl border border-[var(--sw-brand)] px-3 text-xs font-semibold text-[var(--sw-brand)] transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {cooldown.seconds > 0 ? `${cooldown.seconds}s 后重发` : '获取验证码'}
          </button>
        </span>
        {error.code && <span className="text-[11px] text-rose-500">{error.code}</span>}
      </label>
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
