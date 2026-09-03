import { useEffect, useMemo, useRef } from 'react';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';

export function InvitationProof({ busy, method, onSubmit }: Readonly<{ busy: boolean; method: 'otp' | 'sso'; onSubmit: (code: string) => Promise<void> }>) {
  const input = useRef<HTMLInputElement>(null);
  const secret = useMemo(() => new Secret(), []);
  useEffect(() => {
    input.current?.focus();
    return () => clearSecretInput(input.current, secret);
  }, [secret]);
  if (method === 'sso') return <p className="enrollmentnotice">正在跳转到企业身份提供方完成验证…</p>;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = secret.take();
    try { await onSubmit(code); }
    finally {
      clearSecretInput(input.current, secret);
      requestAnimationFrame(() => input.current?.focus());
    }
  };
  return (
    <form aria-label="邀请码安全验证" className="invitationproofform" onSubmit={(event) => void submit(event)}>
      <label htmlFor="invitationProof">短信验证码</label>
      <input ref={input} id="invitationProof" onChange={(event) => secret.set(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="输入 6 位验证码" disabled={busy} />
      <button className="authprimary" type="submit" disabled={busy}>{busy ? '验证中…' : '完成安全验证'}</button>
    </form>
  );
}
