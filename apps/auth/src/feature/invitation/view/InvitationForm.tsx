import { Button } from '@shop/design';
import { ArrowRight, KeyRound, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useInvitationForm } from '../viewmodel/InvitationViewModel';

export function InvitationForm({
  busy,
  error,
  agreement,
  onSubmit,
}: Readonly<{
  busy: boolean;
  error?: string;
  agreement: ReactNode;
  onSubmit: (code: string) => Promise<void>;
}>) {
  const vm = useInvitationForm(busy, onSubmit);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await vm.submit();
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="authform" aria-label="企业邀请验证">
      <label className="authfield">
        <span className="authlabel">
          <KeyRound aria-hidden="true" />
          企业邀请码
        </span>
        <input
          ref={vm.input}
          onChange={(event) => vm.setCode(event.currentTarget.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          placeholder="粘贴企业福利管理员提供的邀请码"
          className="authinput authsecretinput"
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'invitation-hint invitation-error' : 'invitation-hint'}
          aria-errormessage={error ? 'invitation-error' : undefined}
        />
      </label>
      {error ? (
        <span id="invitation-error" className="authfieldissue" role="alert">
          {error}
        </span>
      ) : null}
      <p id="invitation-hint" className="authhint">
        邀请码仅用于本次验证，不会写入网址、浏览器存储或分析数据。
      </p>
      {agreement}
      <Button type="submit" tone="primary" isDisabled={busy} className="authfull">
        {busy ? <RefreshCw className="authspin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {busy ? '正在安全验证…' : '验证邀请码，继续'}
      </Button>
    </form>
  );
}
