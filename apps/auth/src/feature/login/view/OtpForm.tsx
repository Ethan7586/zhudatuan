import { Button } from '@shop/design';
import { ArrowRight, Lock, RefreshCw, Smartphone } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { ChallengeStatus, CodeField, type Challenge } from '../../challenge';
import type { ActionResult } from '../../../shared/model/ActionResult';
import { useOtpForm } from '../viewmodel/LoginReducer';

export function OtpForm({
  busy,
  error,
  agreement,
  submitLabel,
  onChallenge,
  onSubmit,
}: Readonly<{
  busy: boolean;
  error: Readonly<Record<string, string>>;
  agreement: ReactNode;
  submitLabel: string;
  onChallenge: (subject: string) => Promise<ActionResult<Challenge>>;
  onSubmit: (subject: string, challenge: string, code: string) => void;
}>) {
  const vm = useOtpForm(busy, onChallenge, onSubmit);
  const subjectId = useId();
  const subjectErrorId = useId();
  const codeId = useId();
  const codeErrorId = useId();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        vm.submit();
      }}
      className="authform"
      aria-label="验证码登录"
    >
      <div className="authfield">
        <label className="authlabel" htmlFor={subjectId}>
          <Smartphone aria-hidden="true" />
          登录账号或已绑定手机号
        </label>
        <input
          id={subjectId}
          value={vm.subject}
          onChange={(event) => vm.setSubject(event.target.value)}
          autoComplete="username"
          placeholder="输入登录账号或已绑定手机号"
          className="authinput"
          disabled={busy}
          aria-invalid={error.subject ? true : undefined}
          aria-errormessage={error.subject ? subjectErrorId : undefined}
        />
        {error.subject ? (
          <span id={subjectErrorId} className="authfieldissue" role="alert">
            {error.subject}
          </span>
        ) : null}
      </div>
      <div className="authfield">
        <label className="authlabel" htmlFor={codeId}>
          <Lock aria-hidden="true" />
          短信验证码
        </label>
        <span className="authcodegroup">
          <CodeField id={codeId} inputRef={vm.codeRef} value={vm.code} busy={busy} invalid={Boolean(error.code)} {...(error.code ? { errorId: codeErrorId } : {})} onChange={vm.setCode} />
          <Button type="button" onPress={() => void vm.send()} isDisabled={busy || vm.sending || vm.seconds > 0} className="authcodebutton">
            {vm.sending ? '发送中…' : vm.seconds > 0 ? `${vm.seconds}s 后重发` : '获取验证码'}
          </Button>
        </span>
        {vm.challenge ? <ChallengeStatus challenge={vm.challenge} /> : null}
        {error.code ? (
          <span id={codeErrorId} className="authfieldissue" role="alert">
            {error.code}
          </span>
        ) : null}
      </div>
      {agreement}
      <Button type="submit" tone="primary" isDisabled={busy} className="authfull">
        {busy ? <RefreshCw className="authspin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {busy ? '正在安全登录…' : submitLabel}
      </Button>
    </form>
  );
}
