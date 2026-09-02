import { Button, Form } from '@shop/design';
import { useEffect, useMemo, useRef } from 'react';
import { clearSecretInput, SecretState } from '../../../shared/security/SecretState';

export function InvitationProof({ busy, method, onSubmit }: Readonly<{ busy: boolean; method: 'otp' | 'sso'; onSubmit: (code: string) => Promise<void> }>) {
  const input = useRef<HTMLInputElement>(null);
  const secret = useMemo(() => new SecretState(), []);
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
    <Form label="邀请码安全验证" className="invitationproofform" onSubmit={(event) => void submit(event)}>
      <label htmlFor="invitationProof">短信验证码</label>
      <input ref={input} id="invitationProof" onChange={(event) => secret.set(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="输入 6 位验证码" disabled={busy} />
      <Button type="submit" tone="primary" isDisabled={busy}>{busy ? '验证中…' : '完成安全验证'}</Button>
    </Form>
  );
}
