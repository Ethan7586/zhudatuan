import { ArrowRight, Lock, RefreshCw, Smartphone } from 'lucide-react';
import { CodeField } from '../../challenge/view/CodeField';
import type { ActionResult } from '../../../shared/ui/ActionResult';
import { useOtpForm } from '../viewmodel/LoginReducer';

export function OtpForm({
  busy,
  error,
  onChallenge,
  onSubmit,
}: Readonly<{
  busy: boolean;
  error: Readonly<Record<string, string>>;
  onChallenge: (subject: string) => Promise<ActionResult<Readonly<{ id: string; resendSeconds: number }>>>;
  onSubmit: (subject: string, challenge: string, code: string) => void;
}>) {
  const vm = useOtpForm(busy, onChallenge, onSubmit);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        vm.submit();
      }}
      className="authform"
    >
      <label className="authfield">
        <span className="authlabel">
          <Smartphone aria-hidden="true" />
          登录账号或已绑定手机号
        </span>
        <input
          value={vm.subject}
          onChange={(event) => vm.setSubject(event.target.value)}
          autoComplete="username"
          placeholder="输入登录账号或已绑定手机号"
          className="authinput"
          disabled={busy}
          aria-invalid={error.subject ? true : undefined}
        />
        {error.subject && <span className="authfieldissue">{error.subject}</span>}
      </label>
      <label className="authfield">
        <span className="authlabel">
          <Lock aria-hidden="true" />
          短信验证码
        </span>
        <span className="authcodegroup">
          <CodeField inputRef={vm.codeRef} value={vm.code} busy={busy} onChange={vm.setCode} />
          <button
            type="button"
            onClick={() => void vm.send()}
            disabled={busy || vm.sending || vm.seconds > 0}
            className="authcodebutton"
          >
            {vm.sending ? '发送中…' : vm.seconds > 0 ? `${vm.seconds}s 后重发` : '获取验证码'}
          </button>
        </span>
        {error.code && <span className="authfieldissue">{error.code}</span>}
      </label>
      <button
        type="submit"
        disabled={busy}
        className="authprimary"
      >
        {busy ? <RefreshCw className="authspin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {busy ? '验证中...' : '登录'}
      </button>
    </form>
  );
}
