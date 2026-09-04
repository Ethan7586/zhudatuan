import { Button } from '@shop/design';
import { ArrowRight, Building2, Eye, EyeOff, Lock, RefreshCw, UserCheck } from 'lucide-react';
import { usePasswordForm } from '../viewmodel/LoginReducer';

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
  const vm = usePasswordForm(onSubmit);
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
          <Building2 aria-hidden="true" />
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
          密码
        </span>
        <span className="authpassword">
          <input
            type={vm.visible ? 'text' : 'password'}
            ref={vm.input}
            onChange={(event) => vm.setPassword(event.currentTarget.value)}
            autoComplete="current-password"
            placeholder="请输入密码"
            className="authinput"
            disabled={busy}
            aria-invalid={error.password ? true : undefined}
          />
          <Button tone="quiet" onPress={vm.toggle} className="authrevealsecret" aria-label={vm.visible ? '隐藏密码' : '显示密码'}>
            {vm.visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </span>
        {error.password && <span className="authfieldissue">{error.password}</span>}
      </label>
      <div className="authsecondaryactions">
        <Button tone="quiet" onPress={onReset}>
          忘记密码？
        </Button>
        <Button tone="strong" onPress={onInvitation}>
          <UserCheck aria-hidden="true" />
          新用户注册
        </Button>
      </div>
      <p className="authregisterhint">持企业邀请码创建员工商城账号</p>
      <Button type="submit" tone="primary" isDisabled={busy} className="authfull">
        {busy ? <RefreshCw className="authspin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {busy ? '验证中...' : '登录'}
      </Button>
    </form>
  );
}
