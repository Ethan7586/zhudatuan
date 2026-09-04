import { ArrowRight, KeyRound, RefreshCw } from 'lucide-react';
import { useInvitationForm } from '../../login';

export function InvitationForm({
  busy,
  onSubmit,
}: Readonly<{
  busy: boolean;
  onSubmit: (code: string) => Promise<void>;
}>) {
  const vm = useInvitationForm(busy, onSubmit);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await vm.submit();
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="authform">
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
          aria-describedby="invitation-hint"
        />
      </label>
      <p id="invitation-hint" className="authhint">
        邀请码仅用于本次验证，不会写入网址、浏览器存储或分析数据。
      </p>
      <button type="submit" disabled={busy} className="authprimary">
        {busy ? <RefreshCw className="authspin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {busy ? '验证中...' : '使用邀请码登录'}
      </button>
    </form>
  );
}
