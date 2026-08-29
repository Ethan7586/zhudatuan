import { Button } from '@shop/design';
import type { Dispatch, SetStateAction } from 'react';
import {
  formatDate,
  mainlandMobileInput,
  mainlandMobileValid,
  type MobileEnrollmentFlow,
} from './OwnerTransferModel';
import { Boundary } from './OwnerTransferState';

export function OwnerTransferMobileEnrollment({ enrollment, busy, canManage, onChange, onVerifyPassword,
  onRequestCode, onBind, onLogin }: Readonly<{
  enrollment: MobileEnrollmentFlow;
  busy: boolean;
  canManage: boolean;
  onChange: Dispatch<SetStateAction<MobileEnrollmentFlow | undefined>>;
  onVerifyPassword: () => void;
  onRequestCode: () => void;
  onBind: () => void;
  onLogin: () => void;
}>) {
  const update = (change: Partial<MobileEnrollmentFlow>) => onChange((current) => current === undefined
    ? current : { ...current, ...change, error: undefined });
  if (!canManage) return <Boundary title="无法完成 Canonical 手机绑定"
    message="当前会话缺少 identity.mobile.manage capability；初次绑定保持关闭，请先修复 self 权限后重新登录。" danger />;
  return <section className="ownermobileenrollment" aria-labelledby="ownermobileheading">
    <div><p className="ownermobileeyebrow">CANONICAL FIRST-FACTOR ENROLLMENT</p>
      <h3 id="ownermobileheading">先绑定 Canonical 安全手机号</h3></div>
    <Boundary title="仅限尚未绑定手机号的账户"
      message="先验证当前密码，再验证新手机号。完成后该号码会成为密码登录手机号和 Owner Step-Up 接收号码；已有手机号的换绑不在这里进行。" />
    {enrollment.error === undefined ? null : <p className="ownertransfererror" role="alert">{enrollment.error}</p>}
    {enrollment.stage === 'password' ? <PasswordStep enrollment={enrollment} busy={busy} update={update}
      onContinue={onVerifyPassword} /> : null}
    {enrollment.stage === 'entry' ? <MobileStep enrollment={enrollment} busy={busy} update={update}
      onContinue={onRequestCode} /> : null}
    {enrollment.stage === 'verify' ? <CodeStep enrollment={enrollment} busy={busy} update={update}
      onContinue={onBind} /> : null}
    {enrollment.stage === 'binding' ? <p className="ownertransferchallenge" role="status">正在验证并写入 Canonical 身份档案…</p> : null}
    {enrollment.stage === 'relogin' ? <div className="ownermobilerelogin" role="status">
      <strong>手机号已通过验证并写入 Canonical 身份档案</strong>
      <p>敏感输入已从本页内存清空。凭证版本已经轮换，请使用新手机号和原密码重新登录，再继续 Owner Step-Up。</p>
      <Button tone="primary" onPress={onLogin}>使用新手机号重新登录</Button>
    </div> : null}
  </section>;
}

function PasswordStep({ enrollment, busy, update, onContinue }: Readonly<{
  enrollment: MobileEnrollmentFlow;
  busy: boolean;
  update: (change: Partial<MobileEnrollmentFlow>) => void;
  onContinue: () => void;
}>) {
  return <div className="ownertransfercommand"><label htmlFor="ownercurrentpassword">当前账户密码
    <input id="ownercurrentpassword" type="password" autoComplete="current-password" maxLength={128}
      value={enrollment.password} onChange={(event) => update({ password: event.target.value })} /></label>
    <small>密码只用于本次服务端校验，不写入 URL、localStorage 或 sessionStorage。</small>
    <EnrollmentFooter busy={busy} disabled={enrollment.password.length === 0} label="验证当前密码" onContinue={onContinue} />
  </div>;
}

function MobileStep({ enrollment, busy, update, onContinue }: Readonly<{
  enrollment: MobileEnrollmentFlow;
  busy: boolean;
  update: (change: Partial<MobileEnrollmentFlow>) => void;
  onContinue: () => void;
}>) {
  return <div className="ownertransfercommand"><p className="ownertransferchallenge" role="status">当前密码已验证。请输入本人中国大陆手机号。</p>
    <label htmlFor="ownermobile">中国大陆手机号
      <input id="ownermobile" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="例如 13800138000"
        maxLength={11} value={enrollment.mobile}
        onChange={(event) => update({ mobile: mainlandMobileInput(event.target.value) })} /></label>
    <EnrollmentFooter busy={busy} disabled={!mainlandMobileValid(enrollment.mobile)} label="获取绑定验证码" onContinue={onContinue} />
  </div>;
}

function CodeStep({ enrollment, busy, update, onContinue }: Readonly<{
  enrollment: MobileEnrollmentFlow;
  busy: boolean;
  update: (change: Partial<MobileEnrollmentFlow>) => void;
  onContinue: () => void;
}>) {
  return <div className="ownertransfercommand"><p className="ownertransferchallenge" role="status">验证码已发送到 {enrollment.maskedMobile ?? '待绑定手机号'}，
    有效期至 {formatDate(enrollment.challenge?.expiresAt ?? '')}。</p>
    <label htmlFor="ownermobilecode">6 位手机验证码
      <input id="ownermobilecode" value={enrollment.code} inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} pattern="[0-9]{6}" onChange={(event) => update({
          code: event.target.value.replace(/\D/g, '').slice(0, 6),
        })} /></label>
    <EnrollmentFooter busy={busy} disabled={!/^\d{6}$/.test(enrollment.code)} label="验证并绑定手机号" onContinue={onContinue} />
  </div>;
}

function EnrollmentFooter({ busy, disabled, label, onContinue }: Readonly<{
  busy: boolean;
  disabled: boolean;
  label: string;
  onContinue: () => void;
}>) {
  return <footer><Button tone="primary" isDisabled={busy || disabled} onPress={onContinue}>
    {busy ? '正在校验…' : label}</Button></footer>;
}
