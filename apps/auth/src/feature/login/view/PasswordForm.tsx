import { Button } from '@shop/design';
import { ArrowRight, Building2, Eye, EyeOff, Lock, RefreshCw } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { usePasswordForm } from '../viewmodel/LoginReducer';

export function PasswordForm({
  busy,
  error,
  agreement,
  submitLabel,
  onSubmit,
  onReset,
}: Readonly<{
  busy: boolean;
  error: Readonly<Record<string, string>>;
  agreement: ReactNode;
  submitLabel: string;
  onSubmit: (subject: string, password: string) => void;
  onReset: () => void;
}>) {
  const vm = usePasswordForm(onSubmit);
  const subjectId = useId();
  const subjectErrorId = useId();
  const passwordId = useId();
  const passwordErrorId = useId();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        vm.submit();
      }}
      className="authform"
      aria-label="密码登录"
    >
      <div className="authfield">
        <label className="authlabel" htmlFor={subjectId}>
          <Building2 aria-hidden="true" />
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
      <div className="authfield authpasswordfield">
        <label className="authlabel" htmlFor={passwordId}>
          <Lock aria-hidden="true" />
          密码
        </label>
        <span className="authpassword">
          <input
            id={passwordId}
            type={vm.visible ? 'text' : 'password'}
            ref={vm.input}
            onChange={(event) => vm.setPassword(event.currentTarget.value)}
            autoComplete="current-password"
            placeholder="请输入密码"
            className="authinput"
            disabled={busy}
            aria-invalid={error.password ? true : undefined}
            aria-errormessage={error.password ? passwordErrorId : undefined}
          />
          <Button type="button" tone="quiet" onPress={vm.toggle} className="authrevealsecret" aria-label={vm.visible ? '隐藏密码' : '显示密码'}>
            {vm.visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </span>
        <Button type="button" tone="quiet" className="authfieldaction" onPress={onReset}>
          忘记密码？
        </Button>
        {error.password ? (
          <span id={passwordErrorId} className="authfieldissue" role="alert">
            {error.password}
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
