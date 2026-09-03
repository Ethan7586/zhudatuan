import { ArrowRight, Building2, Eye, EyeOff, Lock, RefreshCw, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';

export function PasswordForm({
  busy,
  error,
  onSubmit,
  onReset,
  onInvitation,
}: Readonly<{
  busy: boolean;
  error: Readonly<Record<string, string>>;
  onSubmit: (subject: string, password: string) => void;
  onReset: () => void;
  onInvitation: () => void;
}>) {
  const [subject, setSubject] = useState('');
  const password = useMemo(() => new Secret(), []);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => () => clearSecretInput(passwordInput.current, password), [password]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(subject, password.take());
        clearSecretInput(passwordInput.current, password);
      }}
      className="authform"
    >
      <label className="authfield">
        <span className="authlabel">
          <Building2 aria-hidden="true" />
          登录账号或已绑定手机号
        </span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
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
          密码
        </span>
        <span className="authpassword">
          <input
            type={visible ? 'text' : 'password'}
            ref={passwordInput}
            onChange={(event) => password.set(event.currentTarget.value)}
            autoComplete="current-password"
            placeholder="请输入密码"
            className="authinput"
            disabled={busy}
            aria-invalid={error.password ? true : undefined}
          />
          <button type="button" onClick={() => setVisible((value) => !value)} className="authrevealsecret" aria-label={visible ? '隐藏密码' : '显示密码'}>
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </span>
        {error.password && <span className="authfieldissue">{error.password}</span>}
      </label>
      <div className="authsecondaryactions">
        <button type="button" onClick={onReset} className="authtextbutton">
          忘记密码？
        </button>
        <button
          type="button"
          onClick={onInvitation}
          className="authregister"
        >
          <UserCheck aria-hidden="true" />
          新用户注册
        </button>
      </div>
      <p className="authregisterhint">持企业邀请码创建员工商城账号</p>
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
